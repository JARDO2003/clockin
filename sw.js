const STATIC_CACHE = 'utt-loko-static-v1';
const DYNAMIC_CACHE = 'utt-loko-dynamic-v1';
const CACHE_VERSION = 'v1.2';

// Assets à pré-cacher (vérifiez que ces fichiers existent !)
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './styles.css',
  './dashboard.css',
  './script.js',
  './dashboard.js',
  './firebase-index.js',
  './manifest.json',
  './offline.html'
];

// Assets optionnels (erreurs silencieuses si manquants)
const OPTIONAL_ASSETS = [
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Mise en cache des assets essentiels...');
        
        // Cache les assets essentiels un par un pour éviter l'échec total
        const essentialPromises = STATIC_ASSETS.map(url => 
          fetch(url, { cache: 'no-store' })
            .then(response => {
              if (!response || response.status !== 200) {
                throw new Error(`Échec: ${url} (${response?.status})`);
              }
              return cache.put(url, response);
            })
            .catch(err => {
              console.warn(`[SW] Asset manquant: ${url}`, err.message);
              // Ne pas bloquer l'installation pour un fichier manquant
              return Promise.resolve();
            })
        );
        
        return Promise.all(essentialPromises);
      })
      .then(() => {
        // Essayer de cacher les assets optionnels
        return caches.open(STATIC_CACHE).then(cache => {
          const optionalPromises = OPTIONAL_ASSETS.map(url => 
            fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
          );
          return Promise.all(optionalPromises);
        });
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Erreur critique:', err);
        // Force l'installation même en cas d'erreur
        self.skipWaiting();
      })
  );
});

// Activation
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
    }).then(() => {
      console.log('[SW] Prêt à contrôler les clients');
      return self.clients.claim();
    })
  );
});

// Stratégie de fetch optimisée
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les schémas non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // Ignorer Firebase et services externes
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('cloudinary')) {
    return;
  }

  // Stratégie: Network First pour les HTML, Cache First pour le reste
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
  } else if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// Network First avec fallback cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('Network response not ok');
  } catch (err) {
    console.log('[SW] Fallback cache pour:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Si c'est une page HTML, retourner offline.html
    if (request.destination === 'document') {
      return caches.match('./offline.html') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Ressource non disponible', { status: 503 });
  }
}

// Cache First avec fallback network
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Asset manquant:', request.url);
    // Retourner une réponse vide pour les images
    if (request.destination === 'image') {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
          <rect fill="#1b2b21" width="100" height="100"/>
          <text fill="#7aac88" x="50" y="50" text-anchor="middle" font-size="12">Offline</text>
        </svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    throw err;
  }
}

// Gestion des messages du client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
