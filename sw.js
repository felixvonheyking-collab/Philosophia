/*
 * Philosophia – Service Worker
 *
 * Macht die App vollständig offline lauffähig: alle Dateien liegen nach dem
 * ersten Besuch im Browser-Cache. Ohne Netz startet Philosophia trotzdem.
 *
 * WICHTIG bei Änderungen: VERSION hochzählen. Nur dann merkt der Browser,
 * dass eine neue Fassung bereitliegt, lädt sie nach und meldet sie in der App.
 */

const VERSION = '2026-08-31-4';
const CACHE = 'philosophia-' + VERSION;

const DATEIEN = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './vendor.js',
  './philosophie-app.js',
  './ui-bausteine.js',
  './karteikasten.js',
  './datensicherung.js',
  './daten-grund.js',
  './daten-philosophen.js',
  './daten-begriffe.js',
  './daten-zitate.js',
  './daten-erklaerungen.js',
  './daten-lektuere.js',
  './daten-lernen.js',
  './daten-quiz.js',
  './daten-rhetorik.js',
  './font-cormorant-500.woff2',
  './font-cormorant-600.woff2',
  './font-cormorant-700.woff2',
  './font-sourcesans-400.woff2',
  './font-sourcesans-600.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(DATEIEN))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n.startsWith('philosophia-') && n !== CACHE)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Die Seite bittet um die Übernahme, wenn der Nutzer "Neu laden" drückt.
self.addEventListener('message', (event) => {
  if (event.data && event.data.typ === 'UEBERNIMM') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET') return;

  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;

  // Seitenaufrufe: erst Netz (damit Aktualisierungen ankommen), sonst Cache.
  if (anfrage.mode === 'navigate') {
    event.respondWith(
      fetch(anfrage)
        .then((antwort) => {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', kopie));
          return antwort;
        })
        .catch(() => caches.match('./index.html').then((treffer) => treffer || caches.match('./')))
    );
    return;
  }

  // Alles andere: erst Cache (schnell und offline-fest), sonst Netz.
  event.respondWith(
    caches.match(anfrage).then((treffer) => {
      if (treffer) return treffer;
      return fetch(anfrage).then((antwort) => {
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
        }
        return antwort;
      });
    })
  );
});
