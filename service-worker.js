const CACHE_NAME = 'elementa-engine-v17'; // Bumped: added Practice Problems module data + fixed half_cells.json missing from precache

// App shell CODE: always prefer network when online, so you never get stuck on an old
// build after a deploy. Falls back to cache only when offline.
const APP_SHELL_FILES = ['index.html', 'styles.css', 'core.js', 'features.js', 'compute.worker.js', 'manifest.json', 'theme-boot.js', 'shell.js'];

// Same-origin data: safe to bulk-precache with cache.addAll() — no CORS concerns.
const SAME_ORIGIN_DATA = [
    './data/elements.json',
    './data/compounds.json',
    './data/reactions.json',
    './data/preparations.json',
    './data/identification_test.json',
    './data/misconceptions.json',
    './data/reactivity.json',
    './data/structures.json',
    './data/half_cells.json',
    './data/problem-templates.json'
];

const SAME_ORIGIN_PRECACHE = [...APP_SHELL_FILES.map(f => `./${f}`), ...SAME_ORIGIN_DATA];

// Cross-origin CDN libs. cache.addAll() fetches in CORS mode by default — if ANY one of these
// doesn't send Access-Control-Allow-Origin (3Dmol.org doesn't), the whole install() rejects and
// the service worker never activates, silently freezing you on whatever SW was already running.
// Fix: fetch each individually in no-cors (opaque) mode, and never let one failure block another.
const CROSS_ORIGIN_LIBS = [
    'https://cdn.jsdelivr.net/npm/smiles-drawer@1.0.10/dist/smiles-drawer.min.js',
    'https://3Dmol.org/build/3Dmol-min.js'
];

function isAppShellRequest(request) {
    if (request.mode === 'navigate') return true;
    try {
        const path = new URL(request.url).pathname;
        return APP_SHELL_FILES.some(f => path === `/${f}` || path.endsWith(`/${f}`));
    } catch (e) {
        return false;
    }
}

// 1. Install Event: precache app shell (blocking) + best-effort precache CDN libs (non-blocking)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[Elementa SW] Pre-caching same-origin app shell + data');
            await Promise.allSettled(
                SAME_ORIGIN_PRECACHE.map(url =>
                    fetch(url).then(res => {
                        if (res.ok) return cache.put(url, res);
                        console.warn('[Elementa SW] Failed to precache:', url, res.status);
                    }).catch(err => console.warn('[Elementa SW] Failed to precache:', url, err))
                )
            );

            console.log('[Elementa SW] Best-effort pre-caching cross-origin CDN libs');
            await Promise.allSettled(
                CROSS_ORIGIN_LIBS.map((url) =>
                    fetch(url, { mode: 'no-cors' })
                        .then((res) => cache.put(url, res))
                        .catch((err) => console.warn('[Elementa SW] Could not precache CDN lib (will still load normally at runtime):', url, err))
                )
            );
        })
    );
});

// 2. Activate Event: Clean up old caches if we bump the version
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Elementa SW] Purging obsolete cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith('chrome-extension://')) return;

    // App shell: network-first, cache fallback only when offline.
    if (isAppShellRequest(event.request)) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Only cache real successes. Opaque (no-cors cross-origin) responses always
                    // report ok:false regardless of actual status, so they're allowed through too.
                    if (networkResponse.ok || networkResponse.type === 'opaque') {
                        const responseToCache = networkResponse.clone(); // clone eagerly, before body is read anywhere
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Data + third-party libs: stale-while-revalidate (offline-first). fetch(event.request)
    // preserves the original request's mode (cors for our JSON fetches, no-cors for <script>
    // tag CDN loads), so this stays correct for both without any extra logic.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse.ok || networkResponse.type === 'opaque') {
                        const responseToCache = networkResponse.clone(); // clone eagerly, before body is read anywhere
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
                    }
                    return networkResponse;
                })
                .catch((err) => {
                    console.warn('[Elementa SW] Network fetch failed, relying entirely on cache.', err);
                });

            return cachedResponse || fetchPromise;
        })
    );
});