const CACHE_NAME = 'utt-loko-v1';
const STATIC_CACHE = 'utt-loko-static-v1';
const DYNAMIC_CACHE = 'utt-loko-dynamic-v1';

// Assets à pré-cacher
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles.css',
  '/dashboard.css',
  '/script.js',
  '/dashboard.js',
  '/firebase-index.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(err => console.error('[SW] Erreur cache:', err))
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de fetch : Cache First, puis Network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes Firebase (Firestore, Auth, etc.)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    return;
  }

  // Ignorer les requêtes Cloudinary
  if (url.hostname.includes('cloudinary')) {
    return;
  }

  // Stratégie spécifique pour les pages HTML
  if (request.destination === 'document') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          // Retourner le cache ou fetcher
          const fetchPromise = fetch(request)
            .then(networkResponse => {
              // Mettre à jour le cache
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                  cache.put(request, clone);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // Si offline, retourner le cache ou la page offline
              return response || caches.match('/offline.html');
            });

          return response || fetchPromise;
        })
    );
    return;
  }

  // Stratégie Cache First pour les assets statiques
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) return response;

        return fetch(request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // Mettre en cache les nouvelles ressources
            const clone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, clone);
            });

            return networkResponse;
          })
          .catch(() => {
            // Fallback pour les images
            if (request.destination === 'image') {
              return new Response(
                `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
                  <rect fill="#1b2b21" width="100" height="100"/>
                  <text fill="#7aac88" x="50%" y="50%" text-anchor="middle" font-size="14">Offline</text>
                </svg>`,
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Gestion des notifications push (optionnel)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification UTT LOKO',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'utt-loko',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'UTT LOKO', options)
  );
});

// Gestion des clics sur notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/dashboard.html')
    );
  }
});

// Sync en arrière-plan pour les pointages hors-ligne
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-clockins') {
    event.waitUntil(syncPendingClockins());
  }
});

async function syncPendingClockins() {
  // Récupérer les pointages en attente depuis IndexedDB
  // et les envoyer quand la connexion revient
  console.log('[SW] Sync des pointages en attente...');
}
