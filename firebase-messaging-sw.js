// firebase-messaging-sw.js
// ⚡ Firebase Cloud Messaging — Service Worker (SDK v10, API modulaire)
// Doit être servi à la RACINE du site : /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// ── Configuration Firebase ──────────────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyCPGgtXoDUycykLaTSee0S0yY0tkeJpqKI",
  authDomain:        "data-com-a94a8.firebaseapp.com",
  projectId:         "data-com-a94a8",
  storageBucket:     "data-com-a94a8.firebasestorage.app",
  messagingSenderId: "276904640935",          // ← Sender ID (nouvelle API FCM)
  appId:             "1:276904640935:web:9cd805aeba6c34c767f682"
});

const messaging = firebase.messaging();

// ── Notifications en arrière-plan ───────────────────────────────────────────
// Déclenché quand l'app est fermée / en arrière-plan
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Message reçu en arrière-plan :', payload);

  const { title, body, icon, image } = payload.notification || {};
  const data = payload.data || {};

  const notificationTitle = title || data.title || '🔔 Lambda Workforce';
  const notificationOptions = {
    body:    body  || data.body  || 'Nouvelle publication dans le fil d\'actualité',
    icon:    icon  || data.icon  || '/icons/icon-192.png',
    image:   image || data.image || undefined,
    badge:   '/icons/badge-72.png',
    tag:     data.tag || 'lambda-post',          // regroupe les notifs similaires
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: '👁 Voir'      },
      { action: 'dismiss', title: '✕ Ignorer'    }
    ],
    data: {
      url:    data.url    || '/dashboard.html#community',
      postId: data.postId || null,
      ...data
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Clic sur la notification ────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action  = event.action;
  const url     = event.notification.data?.url || '/dashboard.html#community';

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Cherche une fenêtre déjà ouverte sur le domaine
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return;
        }
      }
      // Aucune fenêtre ouverte → ouvre l'app
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Fermeture de la notification ────────────────────────────────────────────
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification fermée', event.notification.tag);
});

// ── Install & Activate (PWA offline cache) ──────────────────────────────────
const CACHE_NAME = 'lambda-v1';
const PRECACHE = [
  '/dashboard.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Stratégie réseau : Network-first, fallback cache ───────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Ne pas intercepter les requêtes Firebase / Cloudinary
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('google') ||
      url.hostname.includes('cloudinary') ||
      url.hostname.includes('gstatic')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
