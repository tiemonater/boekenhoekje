// Service worker: keeps a copy of the app on the phone, so it also opens without internet.
//
// - App files: try the internet first (so updates arrive straight away),
//   fall back to the saved copy when offline or when the network is very slow.
// - Google Fonts: saved copy first (they never change).
// - Book lookups and online covers: always live, never saved here.

const CACHE = "boekenhoekje-v2";
const NETWORK_TIMEOUT = 3500; // ms before we give up on a slow network and use the copy

// Everything the app needs to start. Kept up to date by tools/update-sw.py.
// FILES-START
const FILES = [
  "./",
  "css/base.css",
  "css/components.css",
  "css/theme.css",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "js/app.js",
  "js/backup.js",
  "js/books.js",
  "js/cover.js",
  "js/db.js",
  "js/format.js",
  "js/genre-chart.js",
  "js/icons.js",
  "js/image.js",
  "js/lookup.js",
  "js/scanner.js",
  "js/ui.js",
  "js/views/add.js",
  "js/views/backup.js",
  "js/views/book.js",
  "js/views/form.js",
  "js/views/home.js",
  "js/views/scan.js",
  "js/views/shelf.js",
  "lib/html5-qrcode.min.js",
  "manifest.webmanifest",
];
// FILES-END

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFont(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

// Internet first; save what we got; use the saved copy if offline or too slow.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(request, { cache: "no-cache" }).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  fromNetwork.catch(() => {}); // a late network error is fine: the copy was used
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
  try {
    const res = await Promise.race([fromNetwork, timeout]);
    if (res) return res;
  } catch { /* offline */ }
  const saved = await cache.match(request, { ignoreSearch: true });
  if (saved) return saved;
  // pages: fall back to the app itself (all screens live in index.html)
  if (request.mode === "navigate") {
    const shell = await cache.match("index.html");
    if (shell) return shell;
  }
  return fromNetwork; // nothing saved: wait for the network after all
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (isFont(url)) {
    event.respondWith(cacheFirst(request));
  }
  // anything else (Open Library, Google Books, online covers): normal internet
});
