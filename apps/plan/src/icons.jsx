const P = {
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'M6 6l12 12M18 6L6 18',
  up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  share: 'M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  more: 'M5 12h.01M12 12h.01M19 12h.01', timeline: 'M4 6h9M8 12h10M6 18h7', columns: 'M4 5h4v14H4zM10 5h4v10h-4zM16 5h4v7h-4z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01', history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2',
  present: 'M3 4h18v12H3zM8 20h8M12 16v4', today: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M12 15h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  print: 'M7 9V3h10v6M7 18H4v-7h16v7h-3M7 14h10v7H7z', download: 'M12 4v11M7 10l5 5 5-5M5 20h14', upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  copy: 'M9 9h11v11H9zM5 15V4h11', check: 'M5 12l5 5 9-10', chevron: 'M6 9l6 6 6-6', chevronR: 'M9 6l6 6-6 6', chevronL: 'M15 6l-6 6 6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14', home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  diamond: 'M12 3l9 9-9 9-9-9z', warn: 'M12 4l9 16H3zM12 10v4M12 17h.01', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10', menu: 'M4 6h16M4 12h16M4 18h16', sidebar: 'M4 4h16v16H4zM9 4v16',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', dep: 'M5 6h6a4 4 0 0 1 4 4v8M11 14l4 4 4-4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', sparkle: 'M12 3v6M12 15v6M3 12h6M15 12h6',
}
export default function Icon({ name, size = 18, sw = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={P[name]} />
    </svg>
  )
}
