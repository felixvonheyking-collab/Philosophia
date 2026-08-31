/*
 * Philosophia – Datensicherung
 *
 * Alles, was Philosophia über dich weiß, liegt im localStorage genau dieses
 * Browsers: Favoriten, Gesprächs-Journal, Lernpfad, Bestleistungen, der
 * Challenge-Streak, eigene Formulierungen und der Karteikasten-Lernstand.
 * Das ist bequem – kein Login, keine fremden Server – hat aber einen Preis:
 * Website-Daten löschen, Browser wechseln, neues Gerät, und alles ist weg.
 *
 * Dieses Modul sichert den gesamten Bestand in eine einzige Datei und liest
 * sie wieder ein. Beim Einlesen wird erst geprüft und angezeigt, was drinsteht;
 * eingespielt wird nur auf ausdrücklichen Klick.
 */

import React, { useState } from 'react';
import { Download, Upload, Check, X, Info } from 'lucide-react';
import { CardShell } from './ui-bausteine.js';

const h = React.createElement;

export const PRAEFIX = 'philoapp_';
export const DATEI_KENNUNG = 'philosophia-sicherung';
export const DATEI_VERSION = 1;

const FARBEN = {
  grund: '#1B1F2A', gold: '#C9A25D', bordeaux: '#8B3A3A',
  pergament: '#EDE6D6', grau: '#4A4E58', gruen: '#2d6a4f'
};

// Klarnamen für die Anzeige. Unbekannte Schlüssel werden trotzdem gesichert –
// die Liste dient nur der Lesbarkeit, nicht als Filter.
const BEZEICHNUNGEN = {
  'philo-favoriten': 'Favoriten',
  'philo-lernpfad-fortschritt': 'Lernpfad-Fortschritt',
  'philo-best-scores-v2': 'Quiz-Bestleistungen',
  'challenge-status': 'Challenge-Streak',
  'rhetorik-journal': 'Gesprächs-Journal',
  'eigene-formulierungen': 'Eigene Formulierungen',
  'karteikasten': 'Karteikasten-Lernstand',
  'karteikasten_einstellungen': 'Karteikasten-Einstellungen',
  'karteikasten_streak': 'Karteikasten-Streak'
};

/* ------------------------------------------------------------------- Sammeln */

export function alleSchluessel(speicher) {
  const s = speicher || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return [];
  const treffer = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(PRAEFIX)) treffer.push(k);
  }
  return treffer.sort();
}

export function sammleDaten(speicher) {
  const s = speicher || localStorage;
  const daten = {};
  for (const k of alleSchluessel(s)) daten[k] = s.getItem(k);
  return {
    kennung: DATEI_KENNUNG,
    version: DATEI_VERSION,
    erstellt: new Date().toISOString(),
    daten
  };
}

/* --------------------------------------------------------------- Beschreiben */

// Zählt, was in einem Eintrag steckt – ohne anzunehmen, dass es JSON ist.
function umfang(rohwert) {
  try {
    const wert = JSON.parse(rohwert);
    if (Array.isArray(wert)) return { anzahl: wert.length, einheit: 'Einträge' };
    if (wert && typeof wert === 'object') return { anzahl: Object.keys(wert).length, einheit: 'Einträge' };
    return { anzahl: null, einheit: String(wert).slice(0, 40) };
  } catch (e) {
    return { anzahl: null, einheit: 'gespeichert' };
  }
}

export function zusammenfassung(daten) {
  return Object.entries(daten || {}).map(([schluessel, rohwert]) => {
    const kurz = schluessel.startsWith(PRAEFIX) ? schluessel.slice(PRAEFIX.length) : schluessel;
    const { anzahl, einheit } = umfang(rohwert);
    return {
      schluessel,
      name: BEZEICHNUNGEN[kurz] || kurz,
      text: anzahl === null ? einheit : `${anzahl} ${einheit}`
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/* --------------------------------------------------------------------- Prüfen */

export function pruefeSicherung(objekt) {
  const fehler = [];
  if (!objekt || typeof objekt !== 'object') {
    return { gueltig: false, fehler: ['Die Datei enthält keine lesbaren Daten.'] };
  }
  if (objekt.kennung !== DATEI_KENNUNG) {
    fehler.push('Das ist keine Philosophia-Sicherung – die Kennung fehlt oder gehört zu einer anderen App.');
  }
  if (!objekt.daten || typeof objekt.daten !== 'object' || Array.isArray(objekt.daten)) {
    fehler.push('Der Datenteil der Sicherung fehlt oder ist beschädigt.');
  } else {
    const eintraege = Object.entries(objekt.daten);
    if (eintraege.length === 0) fehler.push('Die Sicherung ist leer.');
    for (const [k, v] of eintraege) {
      if (!k.startsWith(PRAEFIX)) fehler.push(`Unerwarteter Schlüssel „${k}" – gehört nicht zu Philosophia.`);
      if (typeof v !== 'string') {
        fehler.push(`Der Eintrag „${k}" hat ein unerwartetes Format.`);
      } else {
        // Die App liest jeden Wert als JSON. Steht hier etwas anderes, würde
        // sie beim nächsten Start darüber stolpern – also lieber jetzt ablehnen.
        try { JSON.parse(v); } catch (e) { fehler.push(`Der Eintrag „${k}" ist beschädigt und nicht lesbar.`); }
      }
    }
  }
  if (objekt.version && Number(objekt.version) > DATEI_VERSION) {
    fehler.push(`Die Datei stammt aus einer neueren Fassung (Version ${objekt.version}). Sie lässt sich hier möglicherweise nicht vollständig einlesen.`);
  }
  return { gueltig: fehler.length === 0, fehler };
}

/* ------------------------------------------------------------------ Einlesen */

export function spieleEin(sicherung, speicher) {
  const s = speicher || localStorage;
  const pruefung = pruefeSicherung(sicherung);
  if (!pruefung.gueltig) throw new Error(pruefung.fehler[0]);

  // Erst weg mit dem alten Bestand, damit nichts aus zwei Ständen vermischt
  // stehen bleibt – sonst behielte man Karten, die es gar nicht mehr gibt.
  for (const k of alleSchluessel(s)) s.removeItem(k);
  let anzahl = 0;
  for (const [k, v] of Object.entries(sicherung.daten)) { s.setItem(k, v); anzahl++; }
  return anzahl;
}

/* ------------------------------------------------------------------ Download */

function dateiname() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `philosophia-sicherung-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

function herunterladen(inhalt, name) {
  const blob = new Blob([inhalt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ----------------------------------------------------------------- Bausteine */

function Knopf({ onClick, symbol, children, variante = 'haupt', disabled }) {
  const stile = {
    haupt: { background: FARBEN.bordeaux, color: FARBEN.pergament, border: '1px solid ' + FARBEN.bordeaux },
    rand: { background: 'transparent', color: FARBEN.bordeaux, border: '1px solid ' + FARBEN.bordeaux + '77' },
    gut: { background: FARBEN.gruen, color: '#EDE6D6', border: '1px solid ' + FARBEN.gruen }
  }[variante];
  return h('button', {
    onClick, disabled, className: 'phil-sans',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      padding: '11px 18px', borderRadius: '3px', fontSize: '14px',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      letterSpacing: '0.02em', transition: 'all 0.15s ease', ...stile
    }
  }, symbol, children);
}

function Liste({ eintraege, leerText }) {
  if (!eintraege.length) {
    return h('div', { className: 'phil-sans', style: { fontSize: '13px', color: FARBEN.grau, fontStyle: 'italic' } }, leerText);
  }
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } },
    eintraege.map((e) => h('div', {
      key: e.schluessel, className: 'phil-sans',
      style: { display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '13.5px', color: '#2B2F3A', borderBottom: '1px dotted #8B3A3A33', paddingBottom: '4px' }
    },
      h('span', null, e.name),
      h('span', { style: { color: FARBEN.grau, whiteSpace: 'nowrap' } }, e.text)
    ))
  );
}

/* ------------------------------------------------------------ Hauptkomponente */

export default function DatenAnsicht() {
  const [meldung, setMeldung] = useState(null);
  const [angebot, setAngebot] = useState(null); // geprüfte, noch nicht eingespielte Sicherung
  const [fehler, setFehler] = useState([]);

  const aktuell = zusammenfassung(sammleDaten().daten);
  const istLeer = aktuell.length === 0;

  function exportieren() {
    const sicherung = sammleDaten();
    if (Object.keys(sicherung.daten).length === 0) {
      setMeldung({ art: 'hinweis', text: 'Es ist noch nichts gespeichert, was sich sichern ließe.' });
      return;
    }
    herunterladen(JSON.stringify(sicherung, null, 2), dateiname());
    setMeldung({ art: 'gut', text: 'Sicherung heruntergeladen. Leg sie irgendwohin, wo du sie wiederfindest.' });
  }

  function dateiGewaehlt(ereignis) {
    const datei = ereignis.target.files && ereignis.target.files[0];
    ereignis.target.value = ''; // damit dieselbe Datei erneut gewählt werden kann
    if (!datei) return;
    setMeldung(null);
    setFehler([]);
    setAngebot(null);

    const leser = new FileReader();
    leser.onerror = () => setFehler(['Die Datei konnte nicht gelesen werden.']);
    leser.onload = () => {
      let objekt;
      try {
        objekt = JSON.parse(String(leser.result));
      } catch (e) {
        setFehler(['Die Datei ist keine gültige JSON-Datei. Wurde sie vielleicht unterwegs verändert?']);
        return;
      }
      const pruefung = pruefeSicherung(objekt);
      if (!pruefung.gueltig) { setFehler(pruefung.fehler); return; }
      setAngebot(objekt);
    };
    leser.readAsText(datei);
  }

  function einspielen() {
    try {
      const anzahl = spieleEin(angebot);
      setAngebot(null);
      setMeldung({ art: 'gut', text: `${anzahl} Einträge eingespielt. Die Seite lädt gleich neu.` });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setFehler([e.message]);
    }
  }

  const abschnittTitel = (text) => h('div', {
    className: 'phil-sans',
    style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: FARBEN.bordeaux, marginBottom: '10px' }
  }, text);

  return h('div', null,
    h('div', { style: { marginBottom: '22px' } },
      h('div', { className: 'phil-display', style: { fontSize: '22px', color: FARBEN.pergament, letterSpacing: '0.02em' } }, 'Meine Daten'),
      h('div', { className: 'phil-sans', style: { fontSize: '12.5px', color: FARBEN.grau, marginTop: '3px', lineHeight: 1.6, maxWidth: '62ch' } },
        'Alles, was du in Philosophia sammelst, liegt ausschließlich in diesem Browser – kein Konto, kein Server. Das heißt auch: Website-Daten löschen, Browser wechseln oder ein neues Gerät, und der Stand ist verloren. Hier holst du ihn als Datei heraus und wieder herein.')
    ),

    meldung && h('div', {
      className: 'phil-sans',
      style: {
        marginBottom: '16px', padding: '11px 14px', borderRadius: '3px', fontSize: '13.5px',
        border: '1px solid ' + (meldung.art === 'gut' ? FARBEN.gruen : FARBEN.gold) + '88',
        background: (meldung.art === 'gut' ? FARBEN.gruen : FARBEN.gold) + '18',
        color: meldung.art === 'gut' ? '#9AD5B0' : FARBEN.gold
      }
    }, meldung.text),

    fehler.length > 0 && h('div', {
      className: 'phil-sans',
      style: {
        marginBottom: '16px', padding: '11px 14px', borderRadius: '3px', fontSize: '13.5px',
        border: '1px solid #D98C8C77', background: '#8B3A3A22', color: '#E4A6A6', lineHeight: 1.6
      }
    },
      h('div', { style: { marginBottom: fehler.length > 1 ? '6px' : 0, fontWeight: 600 } }, 'Die Datei wurde nicht eingespielt:'),
      fehler.map((f, i) => h('div', { key: i }, '· ' + f))
    ),

    // ---------- Sichern ----------
    h(CardShell, { style: { padding: '20px 22px 22px 44px', marginBottom: '16px' } },
      abschnittTitel('Sichern'),
      h('div', { style: { marginBottom: '16px' } },
        h(Liste, { eintraege: aktuell, leerText: 'Noch nichts gespeichert – sobald du etwas als Favorit markierst, ins Journal schreibst oder Karten wiederholst, steht es hier.' })
      ),
      h(Knopf, { onClick: exportieren, symbol: h(Download, { size: 15 }), disabled: istLeer }, 'Sicherung herunterladen')
    ),

    // ---------- Einlesen ----------
    h(CardShell, { style: { padding: '20px 22px 22px 44px' } },
      abschnittTitel('Einlesen'),

      !angebot && h('div', null,
        h('div', { className: 'phil-sans', style: { fontSize: '13.5px', color: '#2B2F3A', lineHeight: 1.7, marginBottom: '16px' } },
          'Wähle eine zuvor heruntergeladene Sicherungsdatei. Du siehst erst, was darin steckt – eingespielt wird nichts ohne deine Bestätigung.'),
        h('label', {
          className: 'phil-sans',
          style: {
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 18px',
            borderRadius: '3px', fontSize: '14px', cursor: 'pointer', letterSpacing: '0.02em',
            background: 'transparent', color: FARBEN.bordeaux, border: '1px solid ' + FARBEN.bordeaux + '77'
          }
        },
          h(Upload, { size: 15 }),
          'Datei auswählen',
          h('input', { type: 'file', accept: 'application/json,.json', onChange: dateiGewaehlt, style: { display: 'none' } })
        )
      ),

      angebot && h('div', null,
        h('div', { className: 'phil-sans', style: { fontSize: '13.5px', color: '#2B2F3A', lineHeight: 1.7, marginBottom: '12px' } },
          'Diese Sicherung wurde geprüft und enthält:'),
        h('div', { style: { marginBottom: '14px' } }, h(Liste, { eintraege: zusammenfassung(angebot.daten), leerText: '—' })),
        angebot.erstellt && h('div', { className: 'phil-sans', style: { fontSize: '12px', color: FARBEN.grau, marginBottom: '14px' } },
          'Erstellt am ' + new Date(angebot.erstellt).toLocaleString('de-DE')),
        h('div', {
          className: 'phil-sans',
          style: { fontSize: '13px', color: FARBEN.bordeaux, lineHeight: 1.6, marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'flex-start' }
        },
          h(Info, { size: 15, style: { flexShrink: 0, marginTop: '2px' } }),
          istLeer
            ? h('span', null, 'In diesem Browser ist noch nichts gespeichert – es geht nichts verloren.')
            : h('span', null, 'Achtung: Der aktuelle Stand in diesem Browser wird dabei vollständig ersetzt, nicht zusammengeführt. Lade ihn vorher herunter, wenn du ihn behalten willst.')
        ),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          !istLeer && h(Knopf, { onClick: exportieren, variante: 'rand', symbol: h(Download, { size: 15 }) }, 'Erst aktuellen Stand sichern'),
          h(Knopf, { onClick: einspielen, variante: 'gut', symbol: h(Check, { size: 15 }) }, 'Jetzt einspielen'),
          h(Knopf, { onClick: () => setAngebot(null), variante: 'rand', symbol: h(X, { size: 15 }) }, 'Abbrechen')
        )
      )
    )
  );
}
