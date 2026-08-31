/*
 * Philosophia – Fehlerauffang
 *
 * React bricht bei einem Fehler in einer Komponente den gesamten Baum ab: Die
 * Seite wird weiß, ohne jede Erklärung. Das ist der schlechteste denkbare
 * Zustand, wenn im Browser Lernstand, Journal und Favoriten liegen – man
 * sieht nicht einmal, dass die Daten noch da sind.
 *
 * Diese Hülle fängt solche Fehler ab und zeigt stattdessen: was passiert ist,
 * einen Knopf zum Neuladen und vor allem einen Knopf, der die gespeicherten
 * Daten als Sicherungsdatei herausholt. Erst danach kommt, deutlich abgesetzt,
 * das Zurücksetzen.
 */

import React from 'react';
import { sammleDaten } from './datensicherung.js';

const h = React.createElement;

const FARBEN = { gold: '#C9A25D', pergament: '#EDE6D6', grau: '#8A8F9A', bordeaux: '#8B3A3A' };

function sicherungHerunterladen() {
  const sicherung = sammleDaten();
  const blob = new Blob([JSON.stringify(sicherung, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  a.href = url;
  a.download = `philosophia-sicherung-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function zuruecksetzen() {
  const schluessel = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('philoapp_')) schluessel.push(k);
  }
  schluessel.forEach((k) => localStorage.removeItem(k));
  window.location.reload();
}

const knopfStil = (haupt) => ({
  padding: '11px 18px', borderRadius: '3px', fontSize: '14px', cursor: 'pointer',
  fontFamily: "'Source Sans Pro', Georgia, sans-serif", letterSpacing: '0.02em',
  background: haupt ? FARBEN.gold : 'transparent',
  color: haupt ? '#1B1F2A' : FARBEN.gold,
  border: '1px solid ' + (haupt ? FARBEN.gold : FARBEN.gold + '77')
});

export default class Fehlerauffang extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fehler: null, zurueckgefragt: false };
  }

  static getDerivedStateFromError(fehler) {
    return { fehler };
  }

  componentDidCatch(fehler, info) {
    // Für die Fehlersuche in der Browser-Konsole
    console.error('Philosophia ist auf einen Fehler gestoßen:', fehler, info);
  }

  render() {
    if (!this.state.fehler) return this.props.children;

    const anzahl = Object.keys(sammleDaten().daten).length;

    return h('div', {
      style: {
        minHeight: '100vh', background: '#1B1F2A', color: FARBEN.pergament,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
      }
    },
      h('div', { style: { maxWidth: '560px', width: '100%' } },
        h('div', {
          style: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '26px', color: FARBEN.gold, marginBottom: '12px' }
        }, 'Philosophia ist stehengeblieben.'),

        h('div', {
          style: { fontFamily: "'Source Sans Pro', Georgia, sans-serif", fontSize: '14.5px', lineHeight: 1.7, marginBottom: '18px' }
        }, anzahl > 0
          ? `Deine Daten sind nicht verloren – ${anzahl} gespeicherte Einträge liegen weiterhin in diesem Browser. Hol sie dir zur Sicherheit heraus, bevor du irgendetwas anderes versuchst.`
          : 'In diesem Browser ist nichts gespeichert, es kann also nichts verloren gehen.'),

        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' } },
          anzahl > 0 && h('button', { onClick: sicherungHerunterladen, style: knopfStil(true) }, 'Daten herunterladen'),
          h('button', { onClick: () => window.location.reload(), style: knopfStil(false) }, 'Neu laden')
        ),

        h('details', { style: { marginBottom: '22px' } },
          h('summary', {
            style: { cursor: 'pointer', color: FARBEN.grau, fontSize: '12.5px', fontFamily: "'Source Sans Pro', Georgia, sans-serif", letterSpacing: '0.04em' }
          }, 'Technische Einzelheiten'),
          h('pre', {
            style: {
              marginTop: '10px', padding: '12px', background: '#00000033', borderRadius: '3px',
              color: '#D98C8C', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', maxHeight: '30vh', overflow: 'auto'
            }
          }, String(this.state.fehler && (this.state.fehler.stack || this.state.fehler.message || this.state.fehler)))
        ),

        anzahl > 0 && h('div', {
          style: { borderTop: '1px solid ' + FARBEN.bordeaux + '55', paddingTop: '16px' }
        },
          h('div', {
            style: { fontFamily: "'Source Sans Pro', Georgia, sans-serif", fontSize: '13px', color: FARBEN.grau, lineHeight: 1.6, marginBottom: '10px' }
          }, 'Bleibt der Fehler auch nach dem Neuladen, liegt er vermutlich an beschädigten gespeicherten Daten. Zurücksetzen hilft dann – löscht aber alles unwiderruflich.'),
          !this.state.zurueckgefragt
            ? h('button', {
                onClick: () => this.setState({ zurueckgefragt: true }),
                style: { ...knopfStil(false), color: '#D98C8C', border: '1px solid #D98C8C55', fontSize: '13px' }
              }, 'Gespeicherte Daten zurücksetzen')
            : h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
                h('span', {
                  style: { fontFamily: "'Source Sans Pro', Georgia, sans-serif", fontSize: '13px', color: '#D98C8C' }
                }, 'Wirklich alles löschen?'),
                h('button', {
                  onClick: zuruecksetzen,
                  style: { ...knopfStil(false), color: '#D98C8C', border: '1px solid #D98C8C', fontSize: '13px' }
                }, 'Ja, löschen'),
                h('button', {
                  onClick: () => this.setState({ zurueckgefragt: false }),
                  style: { ...knopfStil(false), fontSize: '13px' }
                }, 'Abbrechen')
              )
        )
      )
    );
  }
}
