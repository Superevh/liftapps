const P = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M6 11h12v9H6z',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 14a1.5 1.5 0 0 1 2.5-1.7L8 15',
  selection: 'M6 3l12 9-6 1 3 6-2 1-3-6-4 4z',
  rectangle: 'M4 6h16v12H4z',
  diamond: 'M12 3l9 9-9 9-9-9z',
  ellipse: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  arrow: 'M4 12h15M14 7l5 5-5 5',
  line: 'M5 12h14',
  freedraw: 'M4 20l3-1 11-11-2-2L5 17zM14 6l2 2',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  eraser: 'M8 20h12M5 16l9-9 5 5-6 6H9z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.8-2.4 2.1-2.4 3.8M12 17h.01',
  open: 'M3 7h6l2 2h10v10H3z',
  save: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z',
  duplicate: 'M8 8h12v12H8zM4 16V4h12',
  back: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  backward: 'M12 5v14M7 14l5 5 5-5',
  forward: 'M12 19V5M7 10l5-5 5 5',
  front: 'M12 20V8M7 13l5-5 5 5M5 4h14',
  close: 'M6 6l12 12M18 6L6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  drawings: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z',
  chevron: 'M7 10l5 5 5-5',
}

export default function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name]} />
    </svg>
  )
}

// Tiny previews for the property buttons.
export function Glyph({ kind, value }) {
  const s = { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', 'aria-hidden': true }
  if (kind === 'width') return <svg {...s}><path d="M3 10h14" strokeWidth={value === 1 ? 1 : value === 2 ? 2.2 : 4} /></svg>
  if (kind === 'style') return <svg {...s} strokeWidth="2"><path d="M3 10h14" strokeDasharray={value === 'dashed' ? '4 3' : value === 'dotted' ? '0.5 3' : undefined} /></svg>
  if (kind === 'rough') {
    const d = value === 0 ? 'M3 13c4-6 10-6 14 0' : value === 1 ? 'M3 13c3-5 5-6 7-2s5 2 7-3' : 'M3 12c2-6 4 2 6-3s3 5 5-1 3 2 3 2'
    return <svg {...s} strokeWidth="1.8"><path d={d} /></svg>
  }
  if (kind === 'edges') return <svg {...s} strokeWidth="1.6" strokeDasharray="2 2"><rect x="4" y="4" width="12" height="12" rx={value === 'round' ? 4 : 0} /></svg>
  if (kind === 'fill') {
    return (
      <svg {...s} strokeWidth="1.2">
        <rect x="3" y="3" width="14" height="14" rx="2" fill={value === 'solid' ? 'currentColor' : 'none'} />
        {value !== 'solid' && <path d="M3 9l6-6M3 14l11-11M6 17l11-11M11 17l6-6" />}
        {value === 'cross-hatch' && <path d="M9 17L3 11M14 17L3 6M17 14L6 3M17 9l-6-6" />}
      </svg>
    )
  }
  return null
}
