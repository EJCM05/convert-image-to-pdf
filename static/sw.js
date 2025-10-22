/*
 * Este es el Service Worker.
 * Es un script que el navegador ejecuta en segundo plano.
 * Su trabajo principal es interceptar peticiones de red (como recargar la página)
 * y responder desde el caché si el usuario está offline.
 */

const CACHE_NAME = 'IMG2PDF-v1';

// 1. Lista de archivos "del armazón" (App Shell) que queremos cachear.
const FILES_TO_CACHE = [
    '/', // La página principal (index.html)
    '/static/camera.html',
    '/static/home.html',
    '/static/my_pdfs.html',
    '/static/manifest.json', // El manifiesto
    '/static/css/style.css', // CSS
    '/static/app.js'      // JavaScript
    // ¡No es necesario cachear sw.js!
    // Las imágenes de iconos se cachearán automáticamente si es necesario.
];

// 2. Evento 'install': Se dispara cuando el SW se instala por primera vez.
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Instalando...');

    // Espera hasta que el cache esté listo.
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[ServiceWorker] Pre-cacheando el App Shell...');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                console.log('[ServiceWorker] App Shell cacheado con éxito.');
                // Forzar al SW a activarse inmediatamente
                return self.skipWaiting();
            })
    );
});

// 3. Evento 'activate': Se dispara después de 'install'.
// Es un buen lugar para limpiar cachés antiguos si tienes varias versiones.
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Activando...');
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                // Si el caché no es el actual, bórralo
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Borrando caché antiguo:', key);
                    return caches.delete(key);
                }
            }));
        })
        .then(() => {
            // Tomar control de la página inmediatamente
            return self.clients.claim();
        })
    );
});

// 4. Evento 'fetch': ¡El más importante!
// Se dispara CADA VEZ que la página hace una petición de red (fetch).
self.addEventListener('fetch', (event) => {
    // Solo nos interesan las peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Estrategia: "Cache, cayendo a Red" (Cache falling back to Network)
    // 1. Intenta buscar la respuesta en el caché.
    // 2. Si está, la sirve desde el caché.
    // 3. Si no está, va a la red a buscarla.
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Si la respuesta está en el caché, la devolvemos
                if (cachedResponse) {
                    console.log('[ServiceWorker] Sirviendo desde caché:', event.request.url);
                    return cachedResponse;
                }

                // Si no, vamos a la red (fetch)
                console.log('[ServiceWorker] Buscando en red:', event.request.url);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // (Opcional) Guardar la respuesta nueva en el caché para la próxima vez
                        // Hay que clonar la respuesta porque solo se puede consumir una vez
                        let responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        // Devolver la respuesta de red original
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[ServiceWorker] Fallo de fetch:', error);
                        // Aquí podrías devolver una página "offline.html" personalizada
                    });
            })
    );
});
