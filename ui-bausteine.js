// Gemeinsame UI-Bausteine für Philosophia.
// Liegen in einer eigenen Datei, damit App und Karteikasten dieselbe
// Optik benutzen, ohne sich gegenseitig zu importieren.

import React from 'react';

export function Chip({ active, onClick, children }) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      padding: '5px 13px',
      borderRadius: '3px',
      border: active ? '1px solid #8B3A3A' : '1px solid #C9A25D55',
      background: active ? '#8B3A3A' : 'transparent',
      color: active ? '#EDE6D6' : '#C9A25D',
      fontSize: '12.5px',
      fontFamily: "'Georgia', serif",
      letterSpacing: '0.02em',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.15s ease'
    }
  }, children);
}

export function CardShell({ children, style }) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#EDE6D6',
      border: '1px solid #C9A25D33',
      borderRadius: '2px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.02)',
      position: 'relative',
      ...style
    }
  },
    /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 0,
        left: '28px',
        bottom: 0,
        width: '1px',
        background: 'repeating-linear-gradient(to bottom, #8B3A3A22 0, #8B3A3A22 2px, transparent 2px, transparent 6px)'
      }
    }),
    children
  );
}
