import React from 'react';

const palettes = {
  city: { sky: ['#E7DCC6', '#D4C4A6'], far: '#C3B394', mid: '#A8926E', ground: '#C9B896', edge: '#8C7858', build: '#8F836C', buildDk: '#7A6F5A', win: '#E0C37A' },
  shop: { sky: ['#2A1C16', '#4A3024'], far: '#3A281C', mid: '#5A3C28', ground: '#3A2A20', edge: '#2A1C14', build: '#6A4A30', buildDk: '#4A3220', win: '#E0B45A' },
  water: { sky: ['#1A2430', '#2A3848'], far: '#1C3040', mid: '#243848', ground: '#1A2830', edge: '#0E181E', build: '#3A4A40', buildDk: '#2A3830', win: '#C9A84A' },
  space: { sky: ['#070814', '#101426'], far: '#12162A', mid: '#161A30', ground: '#0A0C16', edge: '#05060C', build: '#8A9198', buildDk: '#5A6068', win: '#5CC8D8' },
  office: { sky: ['#D8D8D4', '#B8B8B4'], far: '#C0C0BA', mid: '#A8A8A2', ground: '#8A8A86', edge: '#6A6A66', build: '#9AA0A6', buildDk: '#7A8086', win: '#B6E08A' },
  village: { sky: ['#D8E0E6', '#C4C8C0'], far: '#B8C0B0', mid: '#8A9A7A', ground: '#C8C0B0', edge: '#8A8070', build: '#A09080', buildDk: '#807060', win: '#F3EDE3' },
  desert: { sky: ['#E8D8B8', '#D0B888'], far: '#C8B07A', mid: '#B89860', ground: '#C8A868', edge: '#A88850', build: '#8A7A54', buildDk: '#6A5A3C', win: '#E8D8B0' },
  night: { sky: ['#1A1420', '#2A2030'], far: '#2A2234', mid: '#3A2A40', ground: '#241C28', edge: '#161018', build: '#4A3A48', buildDk: '#322830', win: '#C0392B' },
};

export function backdropKind(text = '') {
  const v = String(text).toLowerCase();
  if (/(space|hull|station|orbit|eva)/.test(v)) return 'space';
  if (/(office|hold music|headset|fluorescent|billing)/.test(v)) return 'office';
  if (/(gulf|marsh|flood|river|water|boat|crate)/.test(v)) return 'water';
  if (/(shop|clock|candle|walnut|victorian)/.test(v)) return 'shop';
  if (/(village|wedding|grave|pine|mountain-village)/.test(v)) return 'village';
  if (/(desert|expedition|railway|map|parchment)/.test(v)) return 'desert';
  if (/(racetrack|neon|betting|night,|cigarette)/.test(v)) return 'night';
  if (/(green line|city|plaster|mail|ceasefire)/.test(v)) return 'city';
  return 'city';
}

export const PaperBackdrop = ({ kind = 'city', frame = 0, width = 1920, height = 1080 }) => {
  const p = palettes[kind] || palettes.city;
  const drift = Math.sin(frame / 40) * 6;
  return (
    <svg width={width} height={height} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id={`sky-${kind}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="100%" stopColor={p.sky[1]} />
        </linearGradient>
        <filter id={`grain-${kind}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.14 0" />
        </filter>
      </defs>
      <rect width="1920" height="1080" fill={`url(#sky-${kind})`} />
      <path d="M0 430 C 180 390, 320 470, 520 420 C 740 360, 900 450, 1140 400 C 1360 350, 1580 430, 1920 380 L 1920 1080 L 0 1080 Z" fill={p.far} transform={`translate(0 ${drift * 0.4})`} />
      <path d="M0 520 C 220 470, 400 560, 680 500 C 920 450, 1180 560, 1460 500 C 1680 460, 1800 540, 1920 510 L 1920 1080 L 0 1080 Z" fill={p.mid} transform={`translate(0 ${drift})`} />
      <path d="M0 760 L 1920 730 L 1920 1080 L 0 1080 Z" fill={p.ground} />
      <path d="M0 758 C 200 780, 400 740, 700 770 C 1000 800, 1300 740, 1920 768 L 1920 800 L 0 810 Z" fill={p.edge} opacity="0.55" />
      <g transform="translate(120, 360)">
        <path d="M0 400 L 0 80 L 40 50 L 220 50 L 260 90 L 260 400 Z" fill={p.build} />
        <path d="M0 80 L 40 50 L 40 400 L 0 400 Z" fill={p.buildDk} />
        <rect x="50" y="110" width="36" height="50" fill={p.win} />
        <rect x="110" y="110" width="36" height="50" fill="#D9C9A0" />
        <rect x="170" y="110" width="36" height="50" fill={p.win} />
        <rect x="50" y="190" width="36" height="50" fill="#D9C9A0" />
        <rect x="110" y="190" width="36" height="50" fill={p.win} />
        <rect x="170" y="270" width="36" height="50" fill="#D9C9A0" />
      </g>
      <g transform="translate(1480, 300)">
        <path d="M20 430 L 20 40 L 70 0 L 260 0 L 300 50 L 300 430 Z" fill={p.build} />
        <path d="M20 40 L 70 0 L 70 430 L 20 430 Z" fill={p.buildDk} />
        <rect x="90" y="70" width="42" height="58" fill={p.win} />
        <rect x="170" y="70" width="42" height="58" fill="#D7C49A" />
        <rect x="90" y="170" width="42" height="58" fill="#D7C49A" />
        <rect x="170" y="270" width="42" height="58" fill={p.win} />
      </g>
      <rect width="1920" height="1080" filter={`url(#grain-${kind})`} style={{ mixBlendMode: 'multiply' }} />
    </svg>
  );
};
