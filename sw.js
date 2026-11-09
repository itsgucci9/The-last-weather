// v0.5 distribution patch: precache the presentation/journal modules alongside the game.
const CACHE = "tlw-v05-74ef19494647";
const PRECACHE = [
  "./",
  "./assets/icon-mica-DWHTYB0B.svg",
  "./assets/icon-oxygen-DGs1wsA1.svg",
  "./assets/icon-salvage-C9sOx2rC.svg",
  "./assets/icon-storm-CiNomIX5.svg",
  "./assets/icon-suit-Bdf1yH4E.svg",
  "./assets/index-CLRWfudF.css",
  "./assets/game-v05.js",
  "./assets/expedition-v05.js",
  "./assets/polish-v05.css",
  "./assets/scene-debris-field--F1K00pD.svg",
  "./assets/scene-depot-6QfUNHso.svg",
  "./assets/scene-dry-ravine-DD1fSBOO.svg",
  "./assets/scene-glass-ridge-C7kzbMIn.svg",
  "./assets/scene-halcyon-2_mMZ9RK.svg",
  "./assets/scene-home-vector-DgaIhGTh.svg",
  "./assets/scene-impact-DrYz73dv.svg",
  "./assets/scene-known-space-BSZRhld8.svg",
  "./assets/scene-launch-A0QBPIgO.svg",
  "./assets/scene-moon-relay-CQbR2eBq.svg",
  "./assets/scene-orbit-drift-W8O0jRAb.svg",
  "./assets/scene-relay-core-CQm9Fe7r.svg",
  "./assets/scene-relay-dock-Cp2XKDte.svg",
  "./assets/scene-storm-trench-F0P5a4n5.svg",
  "./assets/scene-weather-station-B5o7iJJB.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tlw-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Cache first, so the page and its files always come from the same version.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) => {
      const lookup = req.mode === 'navigate' ? cache.match('./index.html') : cache.match(req, { ignoreSearch: true });
      return lookup.then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res && res.ok && res.type === 'basic' && req.mode !== 'navigate') cache.put(req, res.clone());
            return res;
          }),
      );
    }),
  );
});
