// Philosophia – Erklärungen zu Quizfragen
//
// Die 330 Quizfragen haben keine eigenen Erklärungen. Statt nach der Antwort
// nur "richtig/falsch" zu zeigen, sucht diese Datei die passende Stelle im
// vorhandenen, belegten Bestand: den Denker, um den es geht (Lebensdaten und
// Kernidee), oder den Begriff aus dem Begriffslexikon. Findet sich nichts
// Eindeutiges, bleibt die Erklärung leer – lieber nichts als etwas Falsches.

import { PHILOSOPHEN } from './daten-philosophen.js';
import { BEGRIFFE } from './daten-begriffe.js';

const klein = (s) => String(s || '').toLowerCase().normalize('NFC');

// "Immanuel Kant" -> ["immanuel kant", "kant"]; "Thomas von Aquin" -> [..., "aquin"]
function namensformen(p) {
  const klammer = (klein(p.name).match(/\(([^)]+)\)/) || [])[1];
  const voll = klein(p.name).replace(/\s*\(.*\)\s*/g, ' ').trim();
  const teile = voll.split(/\s+/).filter((w) => w.length > 2 && !['von', 'van', 'der', 'die', 'des', 'ibn', 'al-'].includes(w));
  // Vornamen allein sind zu mehrdeutig (Simone Weil / Simone de Beauvoir)
  const formen = new Set([voll]);
  if (teile.length) formen.add(teile[teile.length - 1]);
  if (klammer) formen.add(klammer.trim());
  return [...formen];
}

const NAMEN = PHILOSOPHEN.map((p) => ({ p, formen: namensformen(p) }));

function denkerIn(text) {
  const t = ' ' + klein(text).replace(/[„“"'’.,;:!?()]/g, ' ') + ' ';
  const treffer = NAMEN.filter(({ formen }) => formen.some((f) => f.length > 3 && (t.includes(' ' + f + ' ') || t.includes(' ' + f + 's '))));
  return treffer.length === 1 ? treffer[0].p : (treffer.find(({ p, formen }) => t.includes(' ' + formen[0] + ' ')) || {}).p || null;
}

function begriffIn(text) {
  const t = klein(text);
  const kandidaten = BEGRIFFE.filter((b) => b.begriff && t.includes(klein(b.begriff)));
  if (!kandidaten.length) return null;
  return kandidaten.sort((a, b) => b.begriff.length - a.begriff.length)[0];
}

const kuerzen = (s, n) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 5)) + ' …' : s);

export function erklaerungFuer(q) {
  const antwort = q.optionen[q.richtig];
  // 1. Die richtige Antwort ist ein Denker
  const pAntwort = denkerIn(antwort);
  if (pAntwort) return { philId: pAntwort.id, titel: pAntwort.name + ' (' + pAntwort.jahre + ')', text: pAntwort.kernideen.slice(0, 2).join(' ') };
  // 2. Die richtige Antwort ist ein Begriff aus dem Lexikon
  const bAntwort = BEGRIFFE.find((b) => klein(b.begriff) === klein(antwort));
  if (bAntwort) return { titel: bAntwort.begriff, text: kuerzen(bAntwort.erklaerung, 420) };
  // 3. Die Frage nennt einen Denker ("Was meinte Kant mit ...")
  const pFrage = denkerIn(q.frage);
  if (pFrage) return { philId: pFrage.id, titel: pFrage.name + ' (' + pFrage.jahre + ')', text: pFrage.kernideen.slice(0, 2).join(' ') };
  // 4. Die Frage nennt einen Begriff ("Was bezeichnet Deduktion?")
  const bFrage = begriffIn(q.frage);
  if (bFrage) return { titel: bFrage.begriff, text: kuerzen(bFrage.erklaerung, 420) };
  return null;
}
