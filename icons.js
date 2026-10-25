// Lift Apps icon set: one small illustrated object per app on a soft tinted tile.
// Drawn on a 96px grid with a shared ink outline; colours stay inside the light AIYun palette.
const C = { iv: "#FFFBF2", go: "#E3B571", gd: "#CCA06A", br: "#8C613A", wa: "#6A472D", sg: "#A9C8AE", sa: "#EAD3AC", te: "#E2A27F", moss: "#95B99D", ink: "#4A3423" };
const K = `stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const SHADOW = (cx = 48, cy = 80, rx = 24) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.5" fill="rgba(74,52,35,.14)"/>`;

const BG = {
  honey: ["#F8E7C2", "#ECC88A"], apricot: ["#FAE2CA", "#F0BC92"], clay: ["#F1DAC6", "#DDB08C"],
  sage: ["#E1ECDF", "#B3CFB8"], moss: ["#D6E5D5", "#95B99D"], oat: ["#F4ECDD", "#DDC9A8"], blush: ["#F6E0D4", "#E6B6A0"],
};

const ART = {
  retro: { bg: "honey", art: `${SHADOW()}
    <rect x="22" y="22" width="34" height="34" rx="4" fill="${C.sg}" ${K} transform="rotate(-10 39 39)"/>
    <rect x="40" y="26" width="34" height="34" rx="4" fill="${C.go}" ${K} transform="rotate(9 57 43)"/>
    <rect x="28" y="38" width="36" height="36" rx="4" fill="${C.iv}" ${K}/>
    <path d="M35 50h22M35 57h22M35 64h13" fill="none" ${K}/>` },
  point: { bg: "apricot", art: `${SHADOW()}
    <g transform="rotate(-20 48 82)"><rect x="34" y="24" width="28" height="40" rx="4" fill="${C.sa}" ${K}/><text x="48" y="50" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${C.wa}">3</text></g>
    <g transform="rotate(20 48 82)"><rect x="34" y="24" width="28" height="40" rx="4" fill="${C.go}" ${K}/><text x="48" y="50" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="15" fill="${C.wa}">8</text></g>
    <rect x="34" y="20" width="28" height="42" rx="4" fill="${C.iv}" ${K}/><text x="48" y="48" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="18" fill="${C.br}">5</text>` },
  standup: { bg: "honey", art: `
    <path d="M48 24v-6M28 32l-4-4M68 32l4-4M20 50h-6M76 50h6" fill="none" ${K}/>
    <circle cx="48" cy="58" r="20" fill="${C.go}" ${K}/>
    <path d="M6 62 Q48 48 90 62 V96 H6Z" fill="${C.sg}" ${K}/>
    <path d="M30 70 q6-3 12 0M54 72 q6-3 12 0" fill="none" ${K}/>` },
  pulse: { bg: "blush", art: `${SHADOW(48, 80, 20)}
    <path d="M48 74 C24 60 16 46 22 35 C28 25 43 26 48 37 C53 26 68 25 74 35 C80 46 72 60 48 74Z" fill="${C.te}" ${K}/>
    <path d="M20 50h13l5-10 7 20 5-14 4 4h22" fill="none" stroke="${C.iv}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round"/>` },
  topic: { bg: "clay", art: `
    <ellipse cx="46" cy="76" rx="25" ry="4.5" fill="${C.sa}" ${K}/>
    <path d="M62 48h4a7 7 0 0 1 0 14h-5" fill="none" ${K}/>
    <path d="M28 44h34v14a17 17 0 0 1-17 17h0a17 17 0 0 1-17-17Z" fill="${C.iv}" ${K}/>
    <ellipse cx="45" cy="44" rx="17" ry="4" fill="${C.br}" ${K}/>
    <circle cx="38" cy="58" r="2.4" fill="${C.gd}"/><circle cx="45" cy="61" r="2.4" fill="${C.gd}"/><circle cx="52" cy="58" r="2.4" fill="${C.gd}"/>
    <path d="M38 34c-4-5 4-8 0-14M48 34c-4-5 4-8 0-14" fill="none" ${K}/>` },
  kudo: { bg: "apricot", art: `
    <path d="M40 52 L33 78 L41 73 L45 80 L50 56Z" fill="${C.te}" ${K}/>
    <path d="M56 52 L63 78 L55 73 L51 80 L46 56Z" fill="${C.gd}" ${K}/>
    <circle cx="48" cy="40" r="18" fill="${C.go}" ${K}/>
    <circle cx="48" cy="40" r="11" fill="${C.iv}" ${K}/>
    <path d="M48 33l2 4.6 4.7.2-3.5 3.2 1.1 4.6L48 43l-4.3 2.6 1.1-4.6-3.5-3.2 4.7-.2Z" fill="${C.gd}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/>` },
  vote: { bg: "sage", art: `
    <rect x="22" y="52" width="15" height="24" rx="3" fill="${C.sa}" ${K}/>
    <rect x="41" y="38" width="15" height="38" rx="3" fill="${C.go}" ${K}/>
    <rect x="60" y="46" width="15" height="30" rx="3" fill="${C.iv}" ${K}/>
    <path d="M16 76h64" fill="none" ${K}/>
    <circle cx="48.5" cy="24" r="9" fill="${C.iv}" ${K}/><path d="M44.5 24l3 3 5-6" fill="none" ${K}/>` },
  quiz: { bg: "blush", art: `${SHADOW(44, 80, 18)}
    <path d="M30 20h32a12 12 0 0 1 12 12v16a12 12 0 0 1-12 12H44l-14 12 2-12a12 12 0 0 1-12-12V32a12 12 0 0 1 10-12Z" fill="${C.iv}" ${K}/>
    <text x="47" y="52" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="28" fill="${C.br}">?</text>
    <path d="M76 58l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="${C.go}" ${K}/>` },
  sketch: { bg: "oat", art: `
    <path d="M14 70 c8-14 14 4 20-8 s8-10 12-8" fill="none" stroke="${C.br}" stroke-width="3.2" stroke-linecap="round"/>
    <g transform="rotate(42 60 38)">
      <rect x="54" y="12" width="12" height="38" rx="2" fill="${C.go}" ${K}/>
      <path d="M54 50 L60 63 L66 50Z" fill="${C.sa}" ${K}/>
      <path d="M58.4 59.6 L60 63 L61.6 59.6Z" fill="${C.ink}"/>
      <rect x="54" y="8" width="12" height="8" rx="2" fill="${C.te}" ${K}/>
    </g>` },
  agenda: { bg: "sage", art: `${SHADOW(48, 82, 20)}
    <rect x="44" y="20" width="8" height="7" rx="2" fill="${C.gd}" ${K}/>
    <path d="M66 32l4-4" fill="none" ${K}/>
    <circle cx="48" cy="52" r="23" fill="${C.iv}" ${K}/>
    <path d="M48 52 L48 34 A18 18 0 0 1 63.6 61 Z" fill="${C.go}"/>
    <path d="M48 52V38M48 52l9 5" fill="none" ${K}/><circle cx="48" cy="52" r="2.6" fill="${C.ink}"/>` },
  board: { bg: "clay", art: `${SHADOW(48, 80, 28)}
    <rect x="16" y="20" width="64" height="56" rx="6" fill="${C.iv}" ${K}/>
    <path d="M37.5 26v44M58.5 26v44" fill="none" stroke="${C.ink}" stroke-opacity=".25" stroke-width="2"/>
    <rect x="21" y="28" width="12" height="10" rx="2" fill="${C.go}" ${K}/><rect x="21" y="42" width="12" height="10" rx="2" fill="${C.sa}" ${K}/>
    <rect x="42" y="28" width="12" height="10" rx="2" fill="${C.sg}" ${K}/>
    <rect x="63" y="28" width="12" height="10" rx="2" fill="${C.sa}" ${K}/><rect x="63" y="42" width="12" height="10" rx="2" fill="${C.te}" ${K}/><rect x="63" y="56" width="12" height="10" rx="2" fill="${C.sg}" ${K}/>` },
  sprint: { bg: "honey", art: `
    <path d="M26 48 A22 22 0 0 1 66 36" fill="none" stroke="${C.br}" stroke-width="7" stroke-linecap="butt"/>
    <path d="M70.2 33.2 L61.8 38.8 L70.4 42.6Z" fill="${C.br}" stroke="${C.br}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M70 48 A22 22 0 0 1 30 60" fill="none" stroke="${C.sg}" stroke-width="7" stroke-linecap="butt"/>
    <path d="M34.2 57.2 L25.8 62.8 L25.6 53.4Z" fill="${C.sg}" stroke="${C.sg}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M51 34 L40 51 h8 l-4 13 l13-18 h-8 l4-12Z" fill="${C.go}" ${K}/>` },
  road: { bg: "sage", art: `
    <circle cx="26" cy="30" r="7" fill="${C.go}" ${K}/>
    <path d="M4 70 Q40 48 92 62 V96 H4Z" fill="${C.moss}" ${K}/>
    <path d="M38 96 C42 80 58 76 58 66 S64 54 68 50" fill="none" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M38 96 C42 80 58 76 58 66 S64 54 68 50" fill="none" stroke="${C.sa}" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M38 96 C42 80 58 76 58 66 S64 54 68 50" fill="none" stroke="${C.iv}" stroke-width="1.6" stroke-dasharray="3 4"/>
    <path d="M68 50V24" fill="none" ${K}/><path d="M68 24 L83 30 L68 36Z" fill="${C.go}" ${K}/>` },
  story: { bg: "oat", art: `${SHADOW(48, 80, 28)}
    <path d="M16 28 L36 22 L58 28 L80 22 V70 L58 76 L36 70 L16 76Z" fill="${C.iv}" ${K}/>
    <path d="M36 22 V70 L58 76 V28Z" fill="${C.sa}" ${K}/>
    <path d="M24 64 C32 50 44 62 52 48 S64 42 68 40" fill="none" stroke="${C.br}" stroke-width="2.4" stroke-dasharray="3 4" stroke-linecap="round"/>
    <path d="M70 50 C64 42 62 38 62 34 a8 8 0 0 1 16 0 c0 4-2 8-8 16Z" fill="${C.te}" ${K}/><circle cx="70" cy="34" r="3" fill="${C.iv}"/>` },
  plan: { bg: "apricot", art: `${SHADOW(48, 80, 28)}
    <rect x="16" y="20" width="64" height="56" rx="6" fill="${C.iv}" ${K}/>
    <path d="M16 38h64M16 57h64" fill="none" stroke="${C.ink}" stroke-opacity=".25" stroke-width="2"/>
    <path d="M30 29 C42 30 44 46 52 47 M52 47 C62 48 62 62 68 66" fill="none" stroke="${C.te}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="22" y="24" width="14" height="10" rx="2" fill="${C.go}" ${K}/><rect x="45" y="42" width="14" height="10" rx="2" fill="${C.sg}" ${K}/>
    <rect x="61" y="61" width="14" height="10" rx="2" fill="${C.sa}" ${K}/><rect x="24" y="61" width="14" height="10" rx="2" fill="${C.sa}" ${K}/>` },
  goal: { bg: "blush", art: `${SHADOW(46, 80, 22)}
    <circle cx="46" cy="50" r="25" fill="${C.iv}" ${K}/><circle cx="46" cy="50" r="16" fill="${C.te}" ${K}/>
    <circle cx="46" cy="50" r="8" fill="${C.iv}" ${K}/><circle cx="46" cy="50" r="3" fill="${C.ink}"/>
    <path d="M47 49 L74 22" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M72 16 L82 13 L79 23 L74 22Z" fill="${C.go}" ${K}/>` },
  flow: { bg: "moss", art: `${SHADOW(48, 80, 30)}
    <path d="M14 76 C28 76 30 40 44 40 S58 70 82 70 V76Z" fill="${C.iv}" ${K}/>
    <path d="M44 40 C51 40 54 54 60 62 V76 H44Z" fill="${C.go}" opacity=".9"/>
    <path d="M14 76 C28 76 30 40 44 40 S58 70 82 70" fill="none" ${K}/><path d="M12 76h72" fill="none" ${K}/>
    <rect x="58" y="16" width="24" height="22" rx="3" fill="${C.iv}" ${K}/><path d="M58 23h24" fill="none" ${K}/>
    <path d="M64 30l3.5 3.5 7-7" fill="none" ${K}/>` },
  ship: { bg: "sage", art: `
    <path d="M48 56 L48 22 L70 52Z" fill="${C.go}" ${K}/>
    <path d="M45 56 L45 32 L28 52Z" fill="${C.iv}" ${K}/>
    <path d="M16 56 L80 56 L68 70 L28 70Z" fill="${C.sa}" ${K}/>
    <path d="M4 74 q8-5 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 V96 H4Z" fill="${C.moss}" ${K}/>` },
  status: { bg: "oat", art: `
    <path d="M24 62 A24 24 0 0 1 36 41.2" fill="none" stroke="${C.sg}" stroke-width="10"/>
    <path d="M36 41.2 A24 24 0 0 1 60 41.2" fill="none" stroke="${C.go}" stroke-width="10"/>
    <path d="M60 41.2 A24 24 0 0 1 72 62" fill="none" stroke="${C.te}" stroke-width="10"/>
    <path d="M48 62 L33 50" fill="none" stroke="${C.wa}" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="62" r="5" fill="${C.wa}"/>
    <rect x="30" y="70" width="36" height="11" rx="5.5" fill="${C.iv}" ${K}/><circle cx="38" cy="75.5" r="2.6" fill="#5E9171"/><path d="M45 75.5h14" fill="none" ${K}/>` },
  incident: { bg: "clay", art: `
    <path d="M48 32 L14 20 L14 42Z" fill="${C.go}" opacity=".55"/><path d="M48 32 L82 20 L82 42Z" fill="${C.go}" opacity=".55"/>
    <path d="M40 76 L44 36 H52 L56 76Z" fill="${C.iv}" ${K}/>
    <path d="M42.6 54 H53.4 L54.3 63 H41.7Z" fill="${C.te}"/>
    <rect x="42" y="28" width="12" height="8" fill="${C.go}" ${K}/><path d="M39 28 L48 19 L57 28Z" fill="${C.wa}" ${K}/>
    <path d="M4 76 q10-6 20-2 q10 4 22 0 q12-4 22 0 q8 2 24-2 V96 H4Z" fill="${C.moss}" ${K}/>` },
  team: { bg: "honey", art: `
    <path d="M17 70 C17 54 47 54 47 70Z" fill="${C.sg}" ${K}/><circle cx="32" cy="42" r="8" fill="${C.iv}" ${K}/>
    <path d="M49 70 C49 54 79 54 79 70Z" fill="${C.sa}" ${K}/><circle cx="64" cy="42" r="8" fill="${C.iv}" ${K}/>
    <path d="M31 78 C31 58 65 58 65 78Z" fill="${C.go}" ${K}/><circle cx="48" cy="48" r="9" fill="${C.iv}" ${K}/>` },
  note: { bg: "apricot", art: `${SHADOW(48, 80, 22)}
    <rect x="26" y="18" width="44" height="58" rx="4" fill="${C.iv}" ${K}/>
    <rect x="26" y="18" width="9" height="58" rx="3" fill="${C.sa}" ${K}/>
    <path d="M58 18 V36 L62 32 L66 36 V18" fill="${C.te}" ${K}/>
    <path d="M45 42 L57 50 L47 60" fill="none" stroke="${C.br}" stroke-width="2"/>
    <circle cx="45" cy="42" r="4" fill="${C.go}" ${K}/><circle cx="57" cy="50" r="4" fill="${C.sg}" ${K}/><circle cx="47" cy="60" r="4" fill="${C.go}" ${K}/>` },
};

// Returns a complete SVG tile for an app key. Each tile gets its own gradient and clip ids.
function liftIcon(key) {
  const { bg, art } = ART[key];
  const [a, b] = BG[bg];
  const id = `li-${key}`;
  return `<svg class="licon" viewBox="0 0 96 96" aria-hidden="true">
    <defs><linearGradient id="${id}-g" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <clipPath id="${id}-c"><rect width="96" height="96" rx="24"/></clipPath></defs>
    <g clip-path="url(#${id}-c)"><rect width="96" height="96" fill="url(#${id}-g)"/>
    <ellipse cx="30" cy="8" rx="46" ry="22" fill="#FFFBF2" opacity=".4"/>${art}</g>
    <rect x=".75" y=".75" width="94.5" height="94.5" rx="23.25" fill="none" stroke="rgba(74,52,35,.12)" stroke-width="1.5"/></svg>`;
}
