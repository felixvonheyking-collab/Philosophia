/*
 * Philosophia – Forschungsfragen
 *
 * Der Gedanke: Beim Lesen entstehen Fragen, die über das hinausgehen, was in
 * der App steht. Die App selbst kann nicht recherchieren — sie liegt als Datei
 * auf einem Webspace und hat kein Modell hinter sich. Was sie kann: Fragen
 * sammeln, damit sie nicht verlorengehen.
 *
 * Der Ablauf:
 *   1. Frage hier eintragen, offline, jederzeit.
 *   2. Fragenliste als Datei sichern und in den Eingangskorb des Second Brain
 *      legen (raw/inbox/).
 *   3. Claude arbeitet sie mit echten Quellen ab und legt eine Antwortdatei zurück.
 *   4. Antwortdatei hier einlesen — danach steht alles offline zur Verfügung.
 *
 * Nichts davon braucht einen Schlüssel, einen Server oder eine Verbindung.
 */

import React, { useState, useMemo } from 'react';
import { HelpCircle, Check, X, Trash2, Download, Upload, ChevronDown } from 'lucide-react';
import { CardShell, Chip } from './ui-bausteine.js';

const h = React.createElement;

const SPEICHER = 'philoapp_forschungsfragen';
export const FRAGEN_KENNUNG = 'philosophia-fragen';
export const ANTWORTEN_KENNUNG = 'philosophia-antworten';

const FARBEN = {
  grund: '#1B1F2A', gold: '#C9A25D', bordeaux: '#8B3A3A',
  pergament: '#EDE6D6', grau: '#4A4E58', gruen: '#2d6a4f'
};

/* ------------------------------------------------------------------ Speicher */

export function ladeFragen() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    const wert = roh ? JSON.parse(roh) : [];
    return Array.isArray(wert) ? wert.filter((f) => f && typeof f.frage === 'string' && f.frage.trim()) : [];
  } catch (e) {
    return [];
  }
}

export function speichereFragen(liste) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(liste));
    return true;
  } catch (e) {
    return false;
  }
}

function kennung() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function heuteISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* --------------------------------------------------------- Aus- und Einlesen */

export function baueFragendatei(fragen) {
  const offen = fragen.filter((f) => f.status !== 'beantwortet');
  return {
    kennung: FRAGEN_KENNUNG,
    version: 1,
    app: 'Philosophia',
    erstellt: new Date().toISOString(),
    hinweis: 'Diese Datei in raw/inbox/ des Second Brain legen. Claude beantwortet die Fragen mit Quellenangabe und legt eine Antwortdatei zurück.',
    fragen: offen.map((f) => ({ id: f.id, frage: f.frage, kontext: f.kontext || '', gestellt: f.gestellt }))
  };
}

// Nimmt die Antwortdatei entgegen und ordnet die Antworten den Fragen zu.
export function pruefeAntwortdatei(objekt) {
  const fehler = [];
  if (!objekt || typeof objekt !== 'object' || Array.isArray(objekt)) {
    return { gueltig: false, fehler: ['Die Datei enthält keine lesbaren Daten.'] };
  }
  if (objekt.kennung !== ANTWORTEN_KENNUNG) {
    fehler.push('Das ist keine Antwortdatei für Philosophia.');
  }
  if (!Array.isArray(objekt.antworten) || objekt.antworten.length === 0) {
    fehler.push('In der Datei stehen keine Antworten.');
  } else {
    objekt.antworten.forEach((a, i) => {
      if (!a || typeof a.id !== 'string') fehler.push('Antwort ' + (i + 1) + ' hat keine Zuordnung.');
      else if (typeof a.antwort !== 'string' || !a.antwort.trim()) fehler.push('Antwort zu „' + a.id + '“ ist leer.');
    });
  }
  return { gueltig: fehler.length === 0, fehler };
}

export function spieleAntwortenEin(fragen, datei) {
  const nachId = new Map(datei.antworten.map((a) => [a.id, a]));
  let zugeordnet = 0;
  const neu = fragen.map((f) => {
    const a = nachId.get(f.id);
    if (!a) return f;
    zugeordnet++;
    return {
      ...f,
      status: 'beantwortet',
      antwort: String(a.antwort),
      quellen: Array.isArray(a.quellen) ? a.quellen.filter((q) => typeof q === 'string') : [],
      beantwortet: typeof a.beantwortet === 'string' ? a.beantwortet : heuteISO()
    };
  });
  const ohneZuordnung = datei.antworten.length - zugeordnet;
  return { fragen: neu, zugeordnet, ohneZuordnung };
}

function herunterladen(inhalt, name, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ----------------------------------------------------------------- Bausteine */

function Knopf({ onClick, symbol, children, variante = 'haupt', disabled, alsLabel }) {
  const stile = {
    haupt: { background: FARBEN.bordeaux, color: FARBEN.pergament, border: '1px solid ' + FARBEN.bordeaux },
    rand: { background: 'transparent', color: FARBEN.gold, border: '1px solid ' + FARBEN.gold + '66' },
    gut: { background: FARBEN.gruen, color: '#EDE6D6', border: '1px solid ' + FARBEN.gruen }
  }[variante];
  const stil = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 16px', borderRadius: '3px', fontSize: '14px',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
    letterSpacing: '0.02em', ...stile
  };
  if (alsLabel) return h('label', { className: 'phil-sans', style: stil }, symbol, children, alsLabel);
  return h('button', { onClick, disabled, className: 'phil-sans', style: stil }, symbol, children);
}

/* ------------------------------------------------------------ Hauptkomponente */

export default function ForschungsfragenAnsicht() {
  const [fragen, setFragen] = useState(ladeFragen);
  const [frage, setFrage] = useState('');
  const [kontext, setKontext] = useState('');
  const [meldung, setMeldung] = useState(null);
  const [fehler, setFehler] = useState([]);
  const [offenGeklappt, setOffenGeklappt] = useState({});

  function sichern(neu) {
    setFragen(neu);
    if (!speichereFragen(neu)) setMeldung({ gut: false, text: 'Dieser Browser lässt kein Speichern zu.' });
  }

  function hinzufuegen() {
    const t = frage.trim();
    if (!t) return;
    sichern([{ id: kennung(), frage: t, kontext: kontext.trim(), gestellt: heuteISO(), status: 'offen' }, ...fragen]);
    setFrage(''); setKontext('');
    setMeldung({ gut: true, text: 'Notiert. Sichere die Liste, wenn du sie beantwortet haben möchtest.' });
  }

  function loeschen(id) {
    sichern(fragen.filter((f) => f.id !== id));
  }

  function exportieren() {
    const datei = baueFragendatei(fragen);
    if (datei.fragen.length === 0) {
      setMeldung({ gut: false, text: 'Es sind keine offenen Fragen da.' });
      return;
    }
    herunterladen(JSON.stringify(datei, null, 2), 'fragen-philosophia-' + heuteISO() + '.json', 'application/json');
    setMeldung({ gut: true, text: datei.fragen.length + (datei.fragen.length === 1 ? ' offene Frage' : ' offene Fragen') + ' gesichert. Leg die Datei in raw/inbox/ deines Second Brain.' });
  }

  function antwortenGewaehlt(ereignis) {
    const datei = ereignis.target.files && ereignis.target.files[0];
    ereignis.target.value = '';
    if (!datei) return;
    setMeldung(null); setFehler([]);

    const leser = new FileReader();
    leser.onerror = () => setFehler(['Die Datei ließ sich nicht lesen.']);
    leser.onload = () => {
      let objekt;
      try { objekt = JSON.parse(String(leser.result)); }
      catch (e) { setFehler(['Das ist keine gültige JSON-Datei.']); return; }
      const pruefung = pruefeAntwortdatei(objekt);
      if (!pruefung.gueltig) { setFehler(pruefung.fehler); return; }
      const ergebnis = spieleAntwortenEin(fragen, objekt);
      sichern(ergebnis.fragen);
      setMeldung({
        gut: true,
        text: ergebnis.zugeordnet + (ergebnis.zugeordnet === 1 ? ' Antwort' : ' Antworten') + ' eingelesen.'
          + (ergebnis.ohneZuordnung > 0 ? ' ' + ergebnis.ohneZuordnung + ' ließ sich keiner Frage zuordnen.' : '')
      });
    };
    leser.readAsText(datei);
  }

  const offene = useMemo(() => fragen.filter((f) => f.status !== 'beantwortet'), [fragen]);
  const beantwortete = useMemo(() => fragen.filter((f) => f.status === 'beantwortet'), [fragen]);

  const feldStil = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: '2px',
    border: '1px solid #C9A25D44', background: '#FFFFFF88', color: '#23211D',
    fontSize: '14px', lineHeight: 1.6, resize: 'vertical'
  };

  return h('div', null,
    h('div', { style: { marginBottom: '18px' } },
      h('div', { className: 'phil-display', style: { fontSize: '22px', color: FARBEN.pergament } }, 'Forschungsfragen'),
      h('div', { className: 'phil-sans', style: { fontSize: '12.5px', color: FARBEN.grau, marginTop: '3px', lineHeight: 1.65, maxWidth: '64ch' } },
        'Fragen, die beim Lesen entstehen und über das hinausgehen, was hier steht. Die App selbst recherchiert nicht — sie sammelt. Sicher die Liste als Datei, leg sie in den Eingangskorb deines Second Brain, und Claude arbeitet sie mit Quellen ab. Die Antwortdatei liest du hier wieder ein; danach steht alles offline zur Verfügung.')
    ),

    meldung && h('div', {
      className: 'phil-sans',
      style: {
        marginBottom: '14px', padding: '10px 13px', borderRadius: '3px', fontSize: '13.5px', lineHeight: 1.6,
        border: '1px solid ' + (meldung.gut ? FARBEN.gruen : FARBEN.gold) + '88',
        background: (meldung.gut ? FARBEN.gruen : FARBEN.gold) + '18',
        color: meldung.gut ? '#9AD5B0' : FARBEN.gold
      }
    }, meldung.text),

    fehler.length > 0 && h('div', {
      className: 'phil-sans',
      style: { marginBottom: '14px', padding: '10px 13px', borderRadius: '3px', fontSize: '13.5px', border: '1px solid #D98C8C77', background: '#8B3A3A22', color: '#E4A6A6', lineHeight: 1.6 }
    }, h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, 'Nicht eingelesen:'), fehler.map((f, i) => h('div', { key: i }, '· ' + f))),

    // ---------- Neue Frage ----------
    h(CardShell, { style: { padding: '18px 20px 20px 44px', marginBottom: '18px' } },
      h('div', { className: 'phil-sans', style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: FARBEN.bordeaux, marginBottom: '10px' } }, 'Neue Frage'),
      h('textarea', {
        value: frage, onChange: (e) => setFrage(e.target.value), rows: 2,
        placeholder: 'z. B.: Wie verhält sich Epiktets Unterscheidung zwischen dem, was in unserer Macht steht, zu moderner Psychotherapie?',
        className: 'phil-sans', style: { ...feldStil, marginBottom: '10px' }
      }),
      h('input', {
        value: kontext, onChange: (e) => setKontext(e.target.value), type: 'text',
        placeholder: 'Woher kommt die Frage? (freiwillig)',
        className: 'phil-sans', style: { ...feldStil, marginBottom: '12px' }
      }),
      h(Knopf, { onClick: hinzufuegen, disabled: !frage.trim(), symbol: h(HelpCircle, { size: 15 }) }, 'Frage notieren')
    ),

    // ---------- Austausch ----------
    h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' } },
      h(Knopf, { onClick: exportieren, variante: 'rand', symbol: h(Download, { size: 15 }), disabled: offene.length === 0 },
        'Offene Fragen sichern' + (offene.length ? ' (' + offene.length + ')' : '')),
      h(Knopf, {
        variante: 'rand', symbol: h(Upload, { size: 15 }),
        alsLabel: h('input', { type: 'file', accept: 'application/json,.json', onChange: antwortenGewaehlt, style: { display: 'none' } })
      }, 'Antwortdatei einlesen')
    ),

    // ---------- Offene Fragen ----------
    offene.length > 0 && h('div', { style: { marginBottom: '24px' } },
      h('div', { className: 'phil-sans', style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: FARBEN.gold, marginBottom: '10px' } },
        'Offen (' + offene.length + ')'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        offene.map((f) => h(CardShell, { key: f.id, style: { padding: '16px 18px 14px 44px' } },
          h('div', { className: 'phil-display', style: { fontSize: '16px', color: FARBEN.grund, lineHeight: 1.5 } }, f.frage),
          f.kontext && h('div', { className: 'phil-sans', style: { fontSize: '12.5px', color: '#4A4E58', marginTop: '6px', fontStyle: 'italic' } }, f.kontext),
          h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px' } },
            h('span', { className: 'phil-sans', style: { fontSize: '11px', color: '#8A8F9A' } }, 'notiert am ' + f.gestellt),
            h('button', {
              onClick: () => loeschen(f.id), className: 'phil-sans',
              style: { background: 'transparent', border: 0, color: '#A8564F', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: 0 }
            }, h(Trash2, { size: 12 }), 'Löschen')
          )
        ))
      )
    ),

    // ---------- Beantwortete Fragen ----------
    beantwortete.length > 0 && h('div', null,
      h('div', { className: 'phil-sans', style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: FARBEN.gold, marginBottom: '10px' } },
        'Beantwortet (' + beantwortete.length + ')'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        beantwortete.map((f) => {
          const auf = !!offenGeklappt[f.id];
          return h(CardShell, { key: f.id, style: { padding: '16px 18px 16px 44px' } },
            h('button', {
              onClick: () => setOffenGeklappt({ ...offenGeklappt, [f.id]: !auf }),
              style: { background: 'transparent', border: 0, padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }
            },
              h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '8px' } },
                h(ChevronDown, { size: 16, style: { color: FARBEN.bordeaux, flexShrink: 0, marginTop: '3px', transform: auf ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s ease' } }),
                h('div', { className: 'phil-display', style: { fontSize: '16px', color: FARBEN.grund, lineHeight: 1.5 } }, f.frage)
              )
            ),
            auf && h('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #8B3A3A33' } },
              h('div', { className: 'phil-sans', style: { fontSize: '14px', color: '#2B2F3A', lineHeight: 1.75, whiteSpace: 'pre-wrap' } }, f.antwort),
              f.quellen && f.quellen.length > 0 && h('div', { style: { marginTop: '14px' } },
                h('div', { className: 'phil-sans', style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A8F9A', marginBottom: '4px' } }, 'Quellen'),
                h('div', { className: 'phil-sans', style: { fontSize: '12px', color: '#4A4E58', lineHeight: 1.6 } },
                  f.quellen.map((q, i) => h('div', { key: i }, '· ' + q)))
              ),
              h('div', { className: 'phil-sans', style: { fontSize: '11px', color: '#8A8F9A', marginTop: '12px' } }, 'beantwortet am ' + (f.beantwortet || '—'))
            )
          );
        })
      )
    ),

    fragen.length === 0 && h(CardShell, { style: { padding: '22px 22px 22px 44px' } },
      h('div', { className: 'phil-sans', style: { fontSize: '13.5px', color: '#4A4E58', lineHeight: 1.7 } },
        'Noch keine Frage notiert. Was dir beim Lesen unklar bleibt oder was du genauer wissen willst, kommt hierher — und geht nicht verloren.')
    )
  );
}
