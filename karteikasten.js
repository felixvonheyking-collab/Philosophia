/*
 * Philosophia – Karteikasten (Leitner-System)
 *
 * Bisher war das Quiz ein Zufallsgenerator: Fragen kamen gemischt, unabhängig
 * davon, ob man sie längst sicher beherrscht oder gerade zum dritten Mal
 * falsch beantwortet hat. Ein Karteikasten macht daraus echtes Behalten.
 *
 * Das Prinzip (nach Sebastian Leitner, "So lernt man lernen", 1972):
 * Jede Karte sitzt in einem Fach. Wird sie gewusst, rückt sie ein Fach weiter
 * und taucht erst nach einem längeren Abstand wieder auf. Wird sie nicht
 * gewusst, fällt sie zurück in Fach 1 und kommt bald erneut. Was sitzt,
 * kostet also kaum Zeit; was wackelt, wird häufig geübt.
 *
 * Abstände je Fach (in Tagen): 1 → 3 → 7 → 16 → 35
 *
 * Alles bleibt im localStorage dieses Browsers, wie im Rest der App.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Check, X, RotateCcw, Flame, Sparkles } from 'lucide-react';
import { CardShell, Chip } from './ui-bausteine.js';
import { QUIZ } from './daten-quiz.js';
import { BEGRIFFE } from './daten-begriffe.js';
import { ZITATE } from './daten-zitate.js';

const h = React.createElement;

/* ---------------------------------------------------------------- Konstanten */

export const INTERVALLE = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
export const HOECHSTES_FACH = 5;

const SPEICHER_STAND = 'philoapp_karteikasten';
const SPEICHER_EINSTELLUNGEN = 'philoapp_karteikasten_einstellungen';
const SPEICHER_STREAK = 'philoapp_karteikasten_streak';

const FARBEN = {
  grund: '#1B1F2A',
  gold: '#C9A25D',
  bordeaux: '#8B3A3A',
  pergament: '#EDE6D6',
  grau: '#4A4E58',
  gruen: '#2d6a4f',
  panel: '#232838'
};

/* ------------------------------------------------------------------- Speicher */

function lies(schluessel, ersatz) {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh === null ? ersatz : JSON.parse(roh);
  } catch (e) {
    return ersatz;
  }
}

function schreib(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
    return true;
  } catch (e) {
    return false;
  }
}

export const ladeStand = () => lies(SPEICHER_STAND, {});
export const speichereStand = (stand) => schreib(SPEICHER_STAND, stand);

export const ladeEinstellungen = () => ({
  neuProTag: 10,
  quellen: { quiz: true, begriffe: true, zitate: true },
  ...lies(SPEICHER_EINSTELLUNGEN, {})
});
export const speichereEinstellungen = (e) => schreib(SPEICHER_EINSTELLUNGEN, e);

export const ladeStreak = () => lies(SPEICHER_STREAK, { tage: 0, letzterTag: null });
export const speichereStreak = (s) => schreib(SPEICHER_STREAK, s);

/* ----------------------------------------------------------------------- Datum */

export function heuteISO(datum) {
  const d = datum ? new Date(datum) : new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${t}`;
}

export function plusTage(iso, tage) {
  const [j, m, t] = iso.split('-').map(Number);
  const d = new Date(j, m - 1, t);
  d.setDate(d.getDate() + tage);
  return heuteISO(d);
}

function tageDazwischen(vonISO, bisISO) {
  const [j1, m1, t1] = vonISO.split('-').map(Number);
  const [j2, m2, t2] = bisISO.split('-').map(Number);
  return Math.round((new Date(j2, m2 - 1, t2) - new Date(j1, m1 - 1, t1)) / 86400000);
}

/* ------------------------------------------------------------------- Kartenbau */

// Stabile Kennung aus dem Fragetext (djb2). Nötig, weil Quizfragen keine id
// haben – über einen Index wären alle Lernstände verloren, sobald irgendwo
// eine neue Frage eingefügt wird.
export function schluesselAusText(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

export function alleKarten(quellen) {
  const karten = [];

  if (quellen.quiz) {
    QUIZ.forEach((f) => karten.push({
      id: 'q:' + schluesselAusText(f.frage),
      typ: 'quiz',
      herkunft: 'Quizfrage',
      frage: f.frage,
      optionen: f.optionen,
      richtig: f.richtig,
      antwort: f.optionen[f.richtig],
      zusatz: f.kategorie
    }));
  }

  if (quellen.begriffe) {
    BEGRIFFE.forEach((b) => karten.push({
      id: 'b:' + b.id,
      typ: 'begriff',
      herkunft: 'Begriff',
      frage: `Was bedeutet „${b.begriff}“?`,
      antwort: b.erklaerung,
      zusatz: b.begriff
    }));
  }

  if (quellen.zitate) {
    ZITATE.forEach((z) => karten.push({
      id: 'z:' + z.id,
      typ: 'zitat',
      herkunft: 'Zitat',
      frage: `„${z.zitat}“ – von wem stammt das?`,
      antwort: z.name,
      zusatz: (z.themen && z.themen[0]) || ''
    }));
  }

  return karten;
}

/* --------------------------------------------------------------------- Fächer */

export function istFaellig(eintrag, heute) {
  return !eintrag || eintrag.d <= heute;
}

export function fachVerteilung(karten, stand) {
  const verteilung = { neu: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  karten.forEach((k) => {
    const e = stand[k.id];
    if (!e) verteilung.neu++;
    else verteilung[e.f] = (verteilung[e.f] || 0) + 1;
  });
  return verteilung;
}

export function bewerteKarte(stand, kartenId, gewusst, heute) {
  const tag = heute || heuteISO();
  const alt = stand[kartenId] || { f: 1, r: 0, x: 0 };
  const neuesFach = gewusst ? Math.min(alt.f + 1, HOECHSTES_FACH) : 1;
  // Falsch beantwortet heißt: heute noch einmal. Richtig heißt: Pause.
  const faellig = gewusst ? plusTage(tag, INTERVALLE[neuesFach]) : tag;
  return {
    ...stand,
    [kartenId]: {
      f: neuesFach,
      d: faellig,
      z: tag,
      r: alt.r + (gewusst ? 1 : 0),
      x: alt.x + (gewusst ? 0 : 1)
    }
  };
}

function mische(liste) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function baueStapel(karten, stand, neuProTag, heute) {
  const tag = heute || heuteISO();
  const faellig = [];
  const neu = [];
  karten.forEach((k) => {
    const e = stand[k.id];
    if (!e) neu.push(k);
    else if (e.d <= tag) faellig.push(k);
  });
  return {
    faellig: faellig.length,
    neuVerfuegbar: neu.length,
    stapel: mische(faellig).concat(mische(neu).slice(0, Math.max(0, neuProTag)))
  };
}

export function naechsteFaelligkeit(karten, stand, heute) {
  const tag = heute || heuteISO();
  let frueheste = null;
  karten.forEach((k) => {
    const e = stand[k.id];
    if (e && e.d > tag && (frueheste === null || e.d < frueheste)) frueheste = e.d;
  });
  return frueheste;
}

export function streakNachAbschluss(streak, heute) {
  const tag = heute || heuteISO();
  if (streak.letzterTag === tag) return streak;
  const gestern = plusTage(tag, -1);
  return { tage: streak.letzterTag === gestern ? streak.tage + 1 : 1, letzterTag: tag };
}

// Für die Kachel/Beschriftung in der Hauptnavigation
export function anzahlFaellig() {
  const einstellungen = ladeEinstellungen();
  const stand = ladeStand();
  const tag = heuteISO();
  return alleKarten(einstellungen.quellen).filter((k) => {
    const e = stand[k.id];
    return e && e.d <= tag;
  }).length;
}

// "Quizfragen, Begriffen und Zitaten" – aber nur die tatsächlich aktiven.
export function quellenText(quellen) {
  const namen = [];
  if (quellen.quiz) namen.push('Quizfragen');
  if (quellen.begriffe) namen.push('Begriffen');
  if (quellen.zitate) namen.push('Zitaten');
  if (namen.length <= 1) return namen[0] || '–';
  return namen.slice(0, -1).join(', ') + ' und ' + namen[namen.length - 1];
}

/* ------------------------------------------------------------------ Bausteine */

function Knopf({ onClick, symbol, children, variante = 'haupt', disabled }) {
  const stile = {
    haupt: { background: FARBEN.bordeaux, color: FARBEN.pergament, border: '1px solid ' + FARBEN.bordeaux },
    rand: { background: 'transparent', color: FARBEN.gold, border: '1px solid ' + FARBEN.gold + '77' },
    gut: { background: FARBEN.gruen, color: '#EDE6D6', border: '1px solid ' + FARBEN.gruen },
    nochmal: { background: 'transparent', color: '#D98C8C', border: '1px solid #D98C8C77' }
  }[variante];

  return h('button', {
    onClick,
    disabled,
    className: 'phil-sans',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      padding: '11px 18px', borderRadius: '3px', fontSize: '14px', cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.5 : 1, letterSpacing: '0.02em', transition: 'all 0.15s ease', ...stile
    }
  }, symbol, children);
}

function FachLeiste({ verteilung }) {
  const faecher = [1, 2, 3, 4, 5];
  return h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'stretch' } },
    h('div', {
      style: {
        flex: '1 1 60px', minWidth: '60px', padding: '8px 6px', textAlign: 'center',
        border: '1px dashed ' + FARBEN.gold + '55', borderRadius: '3px', background: '#00000022'
      }
    },
      h('div', { className: 'phil-display', style: { fontSize: '19px', color: FARBEN.gold } }, verteilung.neu),
      h('div', { className: 'phil-sans', style: { fontSize: '10px', color: FARBEN.grau, letterSpacing: '0.08em', textTransform: 'uppercase' } }, 'neu')
    ),
    faecher.map((f) => h('div', {
      key: f,
      title: `Fach ${f}: Wiederholung nach ${INTERVALLE[f]} Tag${INTERVALLE[f] === 1 ? '' : 'en'}`,
      style: {
        flex: '1 1 60px', minWidth: '60px', padding: '8px 6px', textAlign: 'center',
        border: '1px solid ' + FARBEN.gold + '33', borderRadius: '3px',
        background: `rgba(201,162,93,${0.04 + f * 0.03})`
      }
    },
      h('div', { className: 'phil-display', style: { fontSize: '19px', color: FARBEN.pergament } }, verteilung[f] || 0),
      h('div', { className: 'phil-sans', style: { fontSize: '10px', color: FARBEN.grau, letterSpacing: '0.08em', textTransform: 'uppercase' } }, 'Fach ' + f)
    ))
  );
}

/* ------------------------------------------------------------ Hauptkomponente */

export default function WiederholenAnsicht() {
  const [einstellungen, setEinstellungen] = useState(ladeEinstellungen);
  const [stand, setStand] = useState(ladeStand);
  const [streak, setStreak] = useState(ladeStreak);
  const [einstellungenOffen, setEinstellungenOffen] = useState(false);

  // Der Tagesstapel entsteht sofort beim ersten Rendern – sonst blitzt kurz
  // "nichts fällig" auf, bevor die Karten da sind.
  const [stapel, setStapel] = useState(() => {
    const e = ladeEinstellungen();
    return baueStapel(alleKarten(e.quellen), ladeStand(), e.neuProTag, heuteISO()).stapel;
  });
  const [position, setPosition] = useState(0);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(null);
  const [bilanz, setBilanz] = useState({ richtig: 0, falsch: 0 });
  const [nachgelegt, setNachgelegt] = useState(() => new Set());

  const heute = heuteISO();
  const karten = useMemo(() => alleKarten(einstellungen.quellen), [einstellungen.quellen]);
  const verteilung = useMemo(() => fachVerteilung(karten, stand), [karten, stand]);

  const neuAufbauen = useCallback((anzahlNeu) => {
    const { stapel: neuerStapel } = baueStapel(karten, stand, anzahlNeu, heute);
    setStapel(neuerStapel);
    setPosition(0);
    setAufgedeckt(false);
    setGewaehlt(null);
    setBilanz({ richtig: 0, falsch: 0 });
    setNachgelegt(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [karten, stand, heute]);

  // Ändert sich die Auswahl der Quellen oder das Tagespensum, wird neu gemischt.
  // Der erste Durchlauf entfällt – da steht der Stapel schon.
  const ersterLauf = useRef(true);
  useEffect(() => {
    if (ersterLauf.current) { ersterLauf.current = false; return; }
    const { stapel: neuerStapel } = baueStapel(karten, ladeStand(), einstellungen.neuProTag, heute);
    setStapel(neuerStapel);
    setPosition(0);
    setAufgedeckt(false);
    setGewaehlt(null);
    setBilanz({ richtig: 0, falsch: 0 });
    setNachgelegt(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [einstellungen.quellen, einstellungen.neuProTag]);

  const karte = stapel[position];
  const fertig = stapel.length > 0 && position >= stapel.length;

  function bewerten(gewusst) {
    if (!karte) return;
    const neuerStand = bewerteKarte(stand, karte.id, gewusst, heute);
    setStand(neuerStand);
    speichereStand(neuerStand);
    setBilanz((b) => ({ richtig: b.richtig + (gewusst ? 1 : 0), falsch: b.falsch + (gewusst ? 0 : 1) }));

    // Nicht gewusste Karten kommen im selben Durchgang noch einmal – aber nur einmal,
    // damit der Stapel nicht endlos wird.
    if (!gewusst && !nachgelegt.has(karte.id)) {
      setStapel((s) => s.concat([karte]));
      setNachgelegt((n) => new Set(n).add(karte.id));
    }

    const naechste = position + 1;
    setPosition(naechste);
    setAufgedeckt(false);
    setGewaehlt(null);

    if (naechste >= stapel.length + (!gewusst && !nachgelegt.has(karte.id) ? 1 : 0)) {
      const neuerStreak = streakNachAbschluss(streak, heute);
      setStreak(neuerStreak);
      speichereStreak(neuerStreak);
    }
  }

  function quizAntwort(index) {
    if (gewaehlt !== null) return;
    setGewaehlt(index);
    setAufgedeckt(true);
  }

  function quellenUmschalten(name) {
    const quellen = { ...einstellungen.quellen, [name]: !einstellungen.quellen[name] };
    // Mindestens eine Quelle muss aktiv bleiben.
    if (!quellen.quiz && !quellen.begriffe && !quellen.zitate) return;
    const neu = { ...einstellungen, quellen };
    setEinstellungen(neu);
    speichereEinstellungen(neu);
  }

  function neuProTagSetzen(anzahl) {
    const neu = { ...einstellungen, neuProTag: anzahl };
    setEinstellungen(neu);
    speichereEinstellungen(neu);
  }

  /* ------------------------------------------------------------- Kopfbereich */

  const kopf = h('div', { style: { marginBottom: '22px' } },
    h('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' } },
      h('div', null,
        h('div', { className: 'phil-display', style: { fontSize: '22px', color: FARBEN.pergament, letterSpacing: '0.02em' } }, 'Wiederholen'),
        h('div', { className: 'phil-sans', style: { fontSize: '12.5px', color: FARBEN.grau, marginTop: '3px' } },
          `${karten.length} Karten aus ${quellenText(einstellungen.quellen)} · Fächer nach Leitner`)
      ),
      streak.tage > 0 && h('div', {
        className: 'phil-sans',
        style: { display: 'flex', alignItems: 'center', gap: '6px', color: FARBEN.gold, fontSize: '13px' }
      }, h(Flame, { size: 15 }), `${streak.tage} Tag${streak.tage === 1 ? '' : 'e'} in Folge`)
    ),
    h(FachLeiste, { verteilung }),
    h('button', {
      onClick: () => setEinstellungenOffen((o) => !o),
      className: 'phil-sans',
      style: {
        marginTop: '12px', background: 'transparent', border: 0, color: FARBEN.gold,
        fontSize: '12px', cursor: 'pointer', padding: '4px 0', letterSpacing: '0.04em'
      }
    }, einstellungenOffen ? 'Einstellungen schließen' : 'Einstellungen'),
    einstellungenOffen && h('div', {
      style: { marginTop: '10px', padding: '14px', border: '1px solid ' + FARBEN.gold + '33', borderRadius: '3px', background: '#00000022' }
    },
      h('div', { className: 'phil-sans', style: { fontSize: '11px', color: FARBEN.grau, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' } }, 'Kartenquellen'),
      h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '16px' } },
        h(Chip, { active: einstellungen.quellen.quiz, onClick: () => quellenUmschalten('quiz') }, `Quizfragen (${QUIZ.length})`),
        h(Chip, { active: einstellungen.quellen.begriffe, onClick: () => quellenUmschalten('begriffe') }, `Begriffe (${BEGRIFFE.length})`),
        h(Chip, { active: einstellungen.quellen.zitate, onClick: () => quellenUmschalten('zitate') }, `Zitate (${ZITATE.length})`)
      ),
      h('div', { className: 'phil-sans', style: { fontSize: '11px', color: FARBEN.grau, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' } }, 'Neue Karten pro Tag'),
      h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
        [5, 10, 20, 40].map((n) => h(Chip, { key: n, active: einstellungen.neuProTag === n, onClick: () => neuProTagSetzen(n) }, String(n)))
      ),
      h('div', { className: 'phil-sans', style: { fontSize: '11.5px', color: FARBEN.grau, marginTop: '12px', lineHeight: 1.6 } },
        'Fach 1 wird nach einem Tag wieder gefragt, Fach 2 nach 3, dann nach 7, 16 und 35 Tagen. Was du sicher weißt, verschwindet also für Wochen; was wackelt, kommt morgen wieder.')
    )
  );

  /* ------------------------------------------------------------ Leerer Stapel */

  if (stapel.length === 0) {
    const naechste = naechsteFaelligkeit(karten, stand, heute);
    const nochNeu = karten.filter((k) => !stand[k.id]).length;
    return h('div', null, kopf,
      h(CardShell, { style: { padding: '28px 24px 28px 44px', textAlign: 'left' } },
        h('div', { className: 'phil-display', style: { fontSize: '19px', color: FARBEN.grund, marginBottom: '8px' } },
          nochNeu === 0 && naechste ? 'Alles wiederholt.' : 'Für heute ist nichts fällig.'),
        h('div', { className: 'phil-sans', style: { fontSize: '13.5px', color: '#4A4E58', lineHeight: 1.7, marginBottom: '18px' } },
          naechste
            ? `Die nächsten Karten stehen am ${naechste.split('-').reverse().join('.')} an – in ${tageDazwischen(heute, naechste)} Tag${tageDazwischen(heute, naechste) === 1 ? '' : 'en'}.`
            : 'Du hast noch keine Karte bewertet. Leg einfach los.'),
        nochNeu > 0 && h(Knopf, {
          onClick: () => neuAufbauen(einstellungen.neuProTag),
          symbol: h(Sparkles, { size: 15 })
        }, `${Math.min(nochNeu, einstellungen.neuProTag)} neue Karten lernen`)
      )
    );
  }

  /* ------------------------------------------------------------ Abschluss */

  if (fertig) {
    const nochNeu = karten.filter((k) => !stand[k.id]).length;
    return h('div', null, kopf,
      h(CardShell, { style: { padding: '28px 24px 28px 44px' } },
        h('div', { className: 'phil-display', style: { fontSize: '21px', color: FARBEN.grund, marginBottom: '10px' } }, 'Stapel geschafft.'),
        h('div', { className: 'phil-sans', style: { fontSize: '14px', color: '#4A4E58', lineHeight: 1.7, marginBottom: '6px' } },
          `${bilanz.richtig} gewusst, ${bilanz.falsch} noch nicht.`),
        h('div', { className: 'phil-sans', style: { fontSize: '13px', color: '#4A4E58', lineHeight: 1.7, marginBottom: '20px' } },
          bilanz.falsch === 0
            ? 'Alle Karten sitzen – sie kommen erst nach der jeweiligen Pause wieder.'
            : 'Die nicht gewussten Karten liegen wieder in Fach 1 und melden sich morgen.'),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          nochNeu > 0 && h(Knopf, { onClick: () => neuAufbauen(einstellungen.neuProTag), symbol: h(Sparkles, { size: 15 }) },
            `Noch ${Math.min(nochNeu, einstellungen.neuProTag)} neue Karten`),
          h(Knopf, { onClick: () => neuAufbauen(0), variante: 'rand', symbol: h(RotateCcw, { size: 15 }) }, 'Fällige erneut prüfen')
        )
      )
    );
  }

  /* ------------------------------------------------------------ Kartenansicht */

  const eintrag = stand[karte.id];
  const fach = eintrag ? eintrag.f : null;

  const fortschritt = h('div', { style: { marginBottom: '12px' } },
    h('div', {
      className: 'phil-sans',
      style: { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: FARBEN.grau, letterSpacing: '0.06em', marginBottom: '6px' }
    },
      h('span', null, `Karte ${position + 1} von ${stapel.length}`),
      h('span', null, fach ? `Fach ${fach}` : 'neue Karte')
    ),
    h('div', { style: { height: '2px', background: FARBEN.gold + '22', borderRadius: '2px', overflow: 'hidden' } },
      h('div', { style: { height: '100%', width: `${(position / stapel.length) * 100}%`, background: FARBEN.gold, transition: 'width 0.25s ease' } })
    )
  );

  const kopfzeile = h('div', {
    className: 'phil-sans',
    style: { fontSize: '10.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: FARBEN.bordeaux, marginBottom: '12px' }
  }, karte.herkunft + (karte.zusatz && karte.typ !== 'begriff' ? ' · ' + karte.zusatz : ''));

  let koerper;

  if (karte.typ === 'quiz') {
    koerper = h('div', null,
      h('div', { className: 'phil-display', style: { fontSize: '19px', color: FARBEN.grund, lineHeight: 1.45, marginBottom: '18px' } }, karte.frage),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        karte.optionen.map((option, i) => {
          const istRichtig = i === karte.richtig;
          const istGewaehlt = i === gewaehlt;
          let rahmen = '1px solid #C9A25D44';
          let hintergrund = 'transparent';
          let schrift = FARBEN.grund;
          if (aufgedeckt && istRichtig) { rahmen = '1px solid ' + FARBEN.gruen; hintergrund = FARBEN.gruen + '18'; schrift = FARBEN.gruen; }
          else if (aufgedeckt && istGewaehlt) { rahmen = '1px solid ' + FARBEN.bordeaux; hintergrund = FARBEN.bordeaux + '15'; schrift = FARBEN.bordeaux; }
          return h('button', {
            key: i,
            onClick: () => quizAntwort(i),
            disabled: aufgedeckt,
            className: 'phil-sans',
            style: {
              textAlign: 'left', padding: '11px 14px', borderRadius: '2px', border: rahmen,
              background: hintergrund, color: schrift, fontSize: '14px', lineHeight: 1.5,
              cursor: aufgedeckt ? 'default' : 'pointer', transition: 'all 0.15s ease'
            }
          }, option);
        })
      ),
      aufgedeckt && h('div', { style: { marginTop: '18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        h(Knopf, { onClick: () => bewerten(gewaehlt === karte.richtig), symbol: h(Check, { size: 15 }) }, 'Weiter'),
        h('span', { className: 'phil-sans', style: { fontSize: '12.5px', color: gewaehlt === karte.richtig ? FARBEN.gruen : FARBEN.bordeaux } },
          gewaehlt === karte.richtig ? 'Richtig – die Karte rückt ein Fach weiter.' : 'Zurück in Fach 1.')
      )
    );
  } else {
    koerper = h('div', null,
      h('div', { className: 'phil-display', style: { fontSize: '19px', color: FARBEN.grund, lineHeight: 1.5, marginBottom: aufgedeckt ? '16px' : '22px' } }, karte.frage),
      aufgedeckt && h('div', {
        className: 'phil-sans',
        style: {
          fontSize: '14px', color: '#2B2F3A', lineHeight: 1.72, paddingTop: '14px',
          borderTop: '1px solid #8B3A3A33', maxHeight: '38vh', overflowY: 'auto'
        }
      }, karte.antwort),
      !aufgedeckt
        ? h('div', { style: { marginTop: '4px' } }, h(Knopf, { onClick: () => setAufgedeckt(true), variante: 'haupt' }, 'Umdrehen'))
        : h('div', { style: { marginTop: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            h(Knopf, { onClick: () => bewerten(true), variante: 'gut', symbol: h(Check, { size: 15 }) }, 'Wusste ich'),
            h(Knopf, { onClick: () => bewerten(false), variante: 'nochmal', symbol: h(X, { size: 15 }) }, 'Nochmal')
          )
    );
  }

  return h('div', null, kopf, fortschritt,
    h(CardShell, { style: { padding: '22px 22px 24px 44px' } }, kopfzeile, koerper)
  );
}
