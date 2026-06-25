const CACHE_VERSION = "lekkedeal-v212";
const APP_SHELL = [
    "./",
    "index.html",
    "reviews.html",
    "runtime-config.js",
    "src/css/styles.css",
    "src/css/modules/foundation.css",
    "src/css/modules/catalog-and-filters.css",
    "src/css/modules/footer-and-modals.css",
    "src/css/modules/responsive-layout.css",
    "src/css/modules/hero-and-navigation.css",
    "src/css/modules/hero-stats-and-effects.css",
    "src/css/modules/brand-assets-and-forms.css",
    "src/css/modules/interaction-and-responsive-fixes.css",
    "src/css/modules/reviews.css",
    "src/css/modules/authentication.css",
    "src/js/dealCatalogApplication.js",
    "src/js/reviewsPageApplication.js",
    "src/js/api/client.js",
    "src/js/api/authentication-api.js",
    "src/js/api/saved-deals-api.js",
    "src/js/api/reviews-api.js",
    "src/js/dealFilteringWorker.js",
    "src/js/modules/application-shell.js",
    "src/js/modules/authentication-interface.js",
    "src/js/modules/icons.js",
    "src/js/modules/application-config.js",
    "src/js/modules/countdown.js",
    "src/js/modules/deal-normalization.js",
    "src/js/modules/dom-element-references.js",
    "src/js/modules/filter-interface.js",
    "src/js/modules/html-partials.js",
    "src/js/modules/image-viewer.js",
    "src/js/modules/image-handling.js",
    "src/js/modules/price-checks.js",
    "src/js/modules/saved-deals-storage.js",
    "src/js/modules/share.js",
    "src/js/modules/text-sanitization.js",
    "src/js/modules/templates.js",
    "src/js/modules/interface-formatting.js",
    "src/js/modules/reviews-storage.js",
    "src/js/modules/reviews-rendering.js",
    "src/js/modules/private-submissions-interface.js",
    "src/js/api/submissions-api.js",
    "src/components/icons.svg",
    "src/html/site-header.html",
    "src/html/reviews-header.html",
    "src/html/home-hero-and-stats.html",
    "src/html/deal-catalog.html",
    "src/html/site-footer.html",
    "src/html/deal-modals.html",
    "manifest.webmanifest",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    "assets/icon.png",
    "assets/favicon-32.png",
    "assets/apple-touch-icon.png",
    "assets/pwa/icon-192.png",
    "assets/pwa/icon-512.png",
    "assets/pwa/maskable-192.png",
    "assets/pwa/maskable-512.png",
    "assets/logo.png",
    "assets/banner.png",
    "assets/no-image-lekkie.png",
    "assets/retailers/icons/builders.ico",
    "assets/retailers/icons/computer-mania.svg",
    "assets/retailers/icons/everymonday.jpg",
    "assets/retailers/icons/expertstores.ico",
    "assets/retailers/icons/firstshop.png",
    "assets/retailers/icons/geewiz.ico",
    "assets/retailers/icons/hifi-corp.webp",
    "assets/retailers/icons/incredible.webp",
    "assets/retailers/icons/leroy-merlin.png",
    "assets/retailers/icons/loot.ico",
    "assets/retailers/icons/makro.webp",
    "assets/retailers/icons/onedayonly.ico",
    "assets/retailers/icons/tafelberg.ico",
    "assets/retailers/icons/woolworths.png",
    "assets/retailers/icons/wootware.ico"
];
const DATA_URL = "data/all_deals.json";
const DEALS_CACHE_KEY = new Request(new URL(DATA_URL, self.location.origin));

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.pathname.endsWith(DATA_URL)) {
        event.respondWith(networkFirstDeals(request));
        return;
    }

    if (request.destination === "image") {
        event.respondWith(cacheFirst(request));
        return;
    }

    if (url.origin === self.location.origin) {
        if (request.destination === "document" || ["script", "style", "worker"].includes(request.destination)) {
            event.respondWith(networkFirst(request));
            return;
        }
        event.respondWith(staleWhileRevalidate(request));
    }
});

async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);
    return cached || network;
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw error;
    }
}

async function networkFirstDeals(request) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            await cache.put(DEALS_CACHE_KEY, response.clone());
            return response;
        }
        const cached = await cache.match(DEALS_CACHE_KEY);
        return cached ? markOfflineResponse(cached) : response;
    } catch (error) {
        const cached = await cache.match(DEALS_CACHE_KEY);
        if (cached) return markOfflineResponse(cached);
        throw error;
    }
}

async function markOfflineResponse(response) {
    const headers = new Headers(response.headers);
    headers.set("X-LekkeDeal-Offline", "true");
    return new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
}





















































