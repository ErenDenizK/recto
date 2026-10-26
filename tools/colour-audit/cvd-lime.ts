/** Colour-blind pair check (Machado 2009) and the lime numbers. Writes data/cvd.json, data/lime.json. */
import { writeFileSync } from 'node:fs';
import * as C from './color.ts';
import { OUT } from './pw.ts';

const H = C.parseHex;
const W: C.RGB = [255, 255, 255];
const mix = (fg: C.RGB, a: number, bg: C.RGB) => C.over([...fg, a], bg);
const multiply = (a: C.RGB, b: C.RGB): C.RGB => [0, 1, 2].map((i) => (a[i] * b[i]) / 255) as C.RGB;
const screen = (a: C.RGB, b: C.RGB): C.RGB =>
  [0, 1, 2].map((i) => 255 - ((255 - a[i]) * (255 - b[i])) / 255) as C.RGB;
const darkPage = H('#0d0f12'); // the sample cover's ground, measured near #0a0f10 … #121519

type Pair = { group: string; theme: string; a: string; b: string; ca: C.RGB; cb: C.RGB };
const pairs: Pair[] = [];
const add = (group: string, theme: string, a: string, ca: C.RGB, b: string, cb: C.RGB) =>
  pairs.push({ group, theme, a, b, ca, cb });

const lime = H('#c8fb3d');
const lime800 = H('#446713');
const select = H('#4e61ed');
for (const [theme, ring] of [
  ['dark', lime],
  ['light', lime800],
] as const) {
  add(
    'selection vs current',
    theme,
    'select (page blue)',
    select,
    'accent-ring (selected page/card)',
    ring,
  );
  add('selection vs current', theme, 'select (page blue)', select, 'focus-light lime', lime);
}
add(
  'selection vs current',
  'page',
  'text selection wash on white',
  mix(select, 0.25, W),
  'find hit (multiply) on white',
  multiply(H('#749c0c'), W),
);
add(
  'selection vs current',
  'page',
  'text selection wash on white',
  mix(select, 0.25, W),
  'find current (multiply) on white',
  multiply(H('#557d00'), W),
);
add(
  'find hits',
  'page',
  'find hit on white',
  multiply(H('#749c0c'), W),
  'find current on white',
  multiply(H('#557d00'), W),
);
add(
  'find hits',
  'page',
  'find hit on dark page',
  screen(H('#506e08'), darkPage),
  'find current on dark page',
  screen(H('#5c7a0a'), darkPage),
);
add('find hits', 'page', 'find current ring', H('#243600'), 'find current halo', H('#c8fb3d'));
add(
  'find hits',
  'page',
  'find hit on white',
  multiply(H('#749c0c'), W),
  'yellow highlighter on white',
  H('#ffea00'),
);
add(
  'find hits',
  'page',
  'find hit on white',
  multiply(H('#749c0c'), W),
  'green highlighter on white',
  H('#8cf26b'),
);
const status = {
  dark: { danger: '#fd7273', warning: '#ffb756', success: '#56d1a3' },
  'dark glass': { danger: '#ffa4a4', warning: '#ffb756', success: '#56d1a3' },
  light: { danger: '#c21725', warning: '#985600', success: '#007654' },
  'light glass': { danger: '#a20519', warning: '#754100', success: '#005c41' },
} as const;
for (const [theme, s] of Object.entries(status)) {
  add('status', theme, 'danger', H(s.danger), 'warning', H(s.warning));
  add('status', theme, 'danger', H(s.danger), 'success', H(s.success));
  add('status', theme, 'warning', H(s.warning), 'success', H(s.success));
}
const tags = {
  dark: ['#7db3a4', '#c8a46e', '#c58b9d', '#9aa8ba', '#b1a1d1', '#c7967a'],
  light: ['#327f6e', '#966b21', '#945067', '#5d728e', '#7c68a1', '#965c39'],
};
const tagNames = ['sage', 'sand', 'rose', 'steel', 'lilac', 'clay'];
for (const [theme, t] of Object.entries(tags))
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++)
      add('tags', theme, `tag-${i} ${tagNames[i]}`, H(t[i]), `tag-${j} ${tagNames[j]}`, H(t[j]));
const tints = { yellow: '#ffea00', green: '#8cf26b', blue: '#8fd3ff', pink: '#ff9ad5' };
const tn = Object.entries(tints);
for (let i = 0; i < tn.length; i++)
  for (let j = i + 1; j < tn.length; j++)
    add('highlighter presets', 'page', tn[i][0], H(tn[i][1]), tn[j][0], H(tn[j][1]));
const inks = {
  black: '#1a1a1a',
  blue: '#1760ee',
  red: '#db1c22',
  green: '#02853c',
  purple: '#8036d3',
  orange: '#e46910',
  pink: '#e02c8a',
  cyan: '#0891c9',
};
const ik = Object.entries(inks);
for (let i = 0; i < ik.length; i++)
  for (let j = i + 1; j < ik.length; j++)
    add('pen inks', 'page', ik[i][0], H(ik[i][1]), ik[j][0], H(ik[j][1]));
add('pen inks', 'page', 'blue ink', H('#1760ee'), 'select (page blue)', select);
add('pen presets', 'page', 'red pen preset', H('#db1c22'), 'black pen preset', H('#1a1a1a'));
add('pen presets', 'page', 'redaction mark', H('#c21725'), 'red pen preset', H('#db1c22'));

const rows = pairs.map((p) => {
  const normal = C.deltaE2000(p.ca, p.cb);
  const sims = Object.fromEntries(
    C.CVD.map((k) => {
      const sa = C.simulate(p.ca, k);
      const sb = C.simulate(p.cb, k);
      return [
        k,
        {
          dE: C.round(C.deltaE2000(sa, sb), 1),
          a: C.hex(sa),
          b: C.hex(sb),
          contrast: C.round(C.contrast(sa, sb)),
        },
      ];
    }),
  );
  const minSim = Math.min(...C.CVD.map((k) => sims[k].dE));
  return {
    group: p.group,
    theme: p.theme,
    a: p.a,
    b: p.b,
    hexA: C.hex(p.ca),
    hexB: C.hex(p.cb),
    dENormal: C.round(normal, 1),
    lumContrast: C.round(C.contrast(p.ca, p.cb)),
    ...sims,
    minSimulated: minSim,
    flag: minSim < 10,
  };
});
writeFileSync(`${OUT}/data/cvd.json`, JSON.stringify(rows, null, 1));
for (const r of rows.filter((r) => r.flag || r.dENormal < 10))
  console.log(
    `${r.flag ? 'FLAG' : '    '} ${r.group} [${r.theme}] ${r.a} ${r.hexA} vs ${r.b} ${r.hexB}: normal ${r.dENormal}, P ${(r as never as Record<string, { dE: number }>).protanopia.dE} D ${(r as never as Record<string, { dE: number }>).deuteranopia.dE} T ${(r as never as Record<string, { dE: number }>).tritanopia.dE}, Y-contrast ${r.lumContrast}`,
  );
console.log('pairs', rows.length, 'flagged', rows.filter((r) => r.flag).length);

// ── Lime ────────────────────────────────────────────────────────────────────────────────
const surfaces: Record<string, string> = {
  white: '#ffffff',
  'light raised n1': '#fdfdff',
  'light frame n2': '#f6f7f9',
  'light canvas n4': '#e6e8eb',
  'light bar glass over white (measured)': '#fbfbfd',
  'dark canvas n1': '#08090c',
  'dark frame n3': '#17191e',
  'dark raised n4': '#1f2227',
  'dark bar glass over white (tokens: #434447)': '#434447',
  black: '#000000',
};
const limeRow = (hex: string) => {
  const c = H(hex);
  const o = C.oklch(c);
  const [L, a, b] = C.lab(c);
  return {
    hex,
    oklch: { L: C.round(o.L, 3), C: C.round(o.C, 3), H: C.round(o.H, 1) },
    chromaShareOfSrgbMax: C.round(o.C / C.maxChroma(o.L, o.H), 2),
    cielab: {
      L: C.round(L, 1),
      a: C.round(a, 1),
      b: C.round(b, 1),
      C: C.round(Math.hypot(a, b), 1),
    },
    Y: C.round(C.relLum(c), 4),
    vs: Object.fromEntries(
      Object.entries(surfaces).map(([k, s]) => [
        k,
        {
          wcag: C.round(C.contrast(c, H(s))),
          apcaAsText: C.round(C.apcaLc(c, H(s)), 1),
          apcaInkOnIt: null as number | null,
          yRatio: C.round(C.relLum(c) / Math.max(1e-4, C.relLum(H(s))), 2),
          dE: C.round(C.deltaE2000(c, H(s)), 1),
        },
      ]),
    ),
  };
};
const limeData = {
  accent: limeRow('#c8fb3d'),
  inkOnLime: {
    ink: '#08090c',
    wcag: C.round(C.contrast(H('#08090c'), lime)),
    apca: C.round(C.apcaLc(H('#08090c'), lime), 1),
    whiteOnLime: C.round(C.contrast(W, lime)),
    whiteOnLimeApca: C.round(C.apcaLc(W, lime), 1),
  },
  limeOnInk: {
    light: 'primary label lime on n12 #15171c',
    wcag: C.round(C.contrast(lime, H('#15171c'))),
    apca: C.round(C.apcaLc(lime, H('#15171c')), 1),
  },
  ramp: [
    '#effed0',
    '#e1fea1',
    '#d2fe59',
    '#c8fb3d',
    '#bbef39',
    '#a5dd34',
    '#80b128',
    '#5f8a1b',
    '#446713',
    '#2f490a',
    '#1a2d04',
  ].map((h) => ({
    hex: h,
    ...C.oklch(H(h)),
    Y: C.round(C.relLum(H(h)), 4),
    onWhite: C.round(C.contrast(H(h), W)),
    onDarkCanvas: C.round(C.contrast(H(h), H('#08090c'))),
  })),
  // Public brand accents, for scale only (values as commonly published; lane B to verify).
  brands: Object.fromEntries(
    Object.entries({
      'Recto lime': '#c8fb3d',
      'Robinhood neon (2021 brand)': '#ccff00',
      'Spotify green': '#1ed760',
      'Duolingo feather green': '#58cc02',
      'Snapchat yellow': '#fffc00',
      'Mailchimp cavendish yellow': '#ffe01b',
      'Apple systemBlue (light)': '#007aff',
      'Google blue 600': '#1a73e8',
      'Stripe blurple': '#635bff',
      'Linear indigo': '#5e6ad2',
      'X/Twitter blue': '#1d9bf0',
      'Adobe red': '#fa0f00',
      'Notion (text black)': '#191919',
    }).map(([k, h]) => {
      const c = H(h);
      const o = C.oklch(c);
      const [L, a, b] = C.lab(c);
      return [
        k,
        {
          hex: h,
          Y: C.round(C.relLum(c), 4),
          oklchL: C.round(o.L, 3),
          oklchC: C.round(o.C, 3),
          H: C.round(o.H, 0),
          labC: C.round(Math.hypot(a, b), 1),
          onWhite: C.round(C.contrast(c, W)),
          onLightCanvas: C.round(C.contrast(c, H('#e6e8eb'))),
          apcaOnWhite: C.round(C.apcaLc(c, W), 1),
          glareIndex: C.round(C.relLum(c) * o.C, 3),
        },
      ];
    }),
  ),
};
for (const [k, s] of Object.entries(surfaces)) (limeData.accent.vs[k].apcaInkOnIt = null), void s;
writeFileSync(`${OUT}/data/lime.json`, JSON.stringify(limeData, null, 1));
console.log(JSON.stringify(limeData.accent, null, 0));
console.log(JSON.stringify(limeData.inkOnLime), JSON.stringify(limeData.limeOnInk));
for (const [k, v] of Object.entries(limeData.brands))
  console.log(
    k.padEnd(30),
    v.hex,
    'Y',
    v.Y,
    'L',
    v.oklchL,
    'C',
    v.oklchC,
    'onWhite',
    v.onWhite,
    'Lc',
    v.apcaOnWhite,
    'glare',
    v.glareIndex,
  );
