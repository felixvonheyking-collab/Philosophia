/*
 * Philosophia – Service Worker
 *
 * Macht die App vollständig offline lauffähig: alle Dateien liegen nach dem
 * ersten Besuch im Browser-Cache. Ohne Netz startet Philosophia trotzdem.
 *
 * WICHTIG bei Änderungen: VERSION hochzählen. Nur dann merkt der Browser,
 * dass eine neue Fassung bereitliegt, lädt sie nach und meldet sie in der App.
 */

const VERSION = '2026-08-31-7';
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
  './eigene-zitate.js',
  './forschungsfragen.js',
  './datensicherung.js',
  './fehlerauffang.js',
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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // Nicht cache.addAll benutzen: das holt die Dateien über den normalen
    // Browser-Cache. Wer die Seite kurz vorher offen hatte, bekäme dann die
    // alte Fassung in den neuen Cache gelegt – und die bliebe dort bis zur
    // nächsten Version festgefroren, obwohl der Server längst neu ausliefert.
    // Deshalb: Version an die Adresse hängen und den Cache ausdrücklich umgehen.
    await Promise.all(DATEIEN.map(async (pfad) => {
      const trenner = pfad.includes('?') ? '&' : '?';
      const antwort = await fetch(new Request(pfad + trenner + 'sw=' + VERSION, { cache: 'reload' }));
      if (!antwort.ok) throw new Error('Konnte ' + pfad + ' nicht laden (' + antwort.status + ')');
      // Unter der sauberen Adresse ablegen, ohne den Versionsanhang.
      await cache.put(pfad, antwort);
    }));
    // Schlägt hier etwas fehl, scheitert die Installation bewusst – dann bleibt
    // die bisherige, funktionierende Fassung aktiv statt einer halben neuen.
  })());
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
