/** Re-scores out/data/measurements.json (aggregate.ts) against token changes; writes out/data/projection.json. */
import { readFileSync, writeFileSync } from 'node:fs';
import { apcaContrast } from '../../apps/web/src/styles/apca.ts';
import * as C from './color.ts';
import { OUT } from './pw.ts';
const D = `${OUT}/data/`;
const J = (f: string) => JSON.parse(readFileSync(D + f, 'utf8'));
const M = J('measurements.json');
const P = C.parseHex;
const lc = (t: string, b: string) => apcaContrast(P(t) as any, P(b) as any);
const cr = (a: string, b: string) => C.contrast(P(a), P(b));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const counted = (s: any) => !s.behind && !s.covered && !s.exempt && s.wcagMedian !== null;
const isText = (s: any) => s.kind !== 'icon';
const pct = (a: number, b: number) => (b ? r1((100 * a) / b) : null);
const S = M.samples.filter(counted);
const ed = (v: string) => (v === 'phone' ? 'compact' : 'full');

// 1. pass rates per standard x theme x edition x contrast
const slices: any[] = [];
for (const theme of ['light', 'dark'])
  for (const edition of ['full', 'compact'])
    for (const contrast of ['no-preference', 'more']) {
      const f = (s: any) =>
        s.theme === theme && ed(s.viewport) === edition && s.contrast === contrast;
      const t = S.filter((s: any) => f(s) && isText(s));
      const i = S.filter((s: any) => f(s) && !isText(s));
      const vs = M.variants.filter(
        (v: any) => v.theme === theme && ed(v.viewport) === edition && v.contrast === contrast,
      );
      const rings = vs.flatMap((v: any) => v.focus ?? []).filter((x: any) => x.visible);
      const sel = vs
        .flatMap((v: any) => v.controls ?? [])
        .filter((x: any) => x.kind === 'selected');
      slices.push({
        theme,
        edition,
        contrast,
        nText: t.length,
        nIcon: i.length,
        nRing: rings.length,
        nSel: sel.length,
        AA: pct(t.filter((s: any) => s.passAA).length, t.length),
        AAA: pct(t.filter((s: any) => s.passAAA).length, t.length),
        Bronze: pct(t.filter((s: any) => s.passAPCABronze).length, t.length),
        Lc90: pct(t.filter((s: any) => Math.abs(s.apcaMedian) >= 90).length, t.length),
        Icon3: pct(i.filter((s: any) => s.wcagMedian >= 3).length, i.length),
        F1411: pct(rings.filter((x: any) => x.pass1411).length, rings.length),
        F2413: pct(rings.filter((x: any) => x.pass2413).length, rings.length),
        Sel3: pct(sel.filter((x: any) => x.pass3).length, sel.length),
      });
    }
// 2. histograms (text, std + more pooled; per theme)
const wBins = [1, 3, 4.5, 7, 10, 15, 21.01];
const aBins = [0, 15, 30, 45, 60, 75, 90, 106.1];
const hist: any = {};
for (const theme of ['light', 'dark']) {
  const t = S.filter((s: any) => s.theme === theme && isText(s));
  hist[theme] = {
    n: t.length,
    wcag: wBins
      .slice(0, -1)
      .map(
        (lo, k) => t.filter((s: any) => s.wcagMedian >= lo && s.wcagMedian < wBins[k + 1]).length,
      ),
    apca: aBins
      .slice(0, -1)
      .map(
        (lo, k) =>
          t.filter(
            (s: any) => Math.abs(s.apcaMedian) >= lo && Math.abs(s.apcaMedian) < aBins[k + 1],
          ).length,
      ),
    medianW: r2([...t.map((s: any) => s.wcagMedian)].sort((a, b) => a - b)[t.length >> 1]),
    medianA: r1(
      [...t.map((s: any) => Math.abs(s.apcaMedian))].sort((a, b) => a - b)[t.length >> 1],
    ),
  };
}
// 3. glass ranges
const gv = J('glass-variability.json');
const glass: any[] = [];
for (const theme of ['dark', 'light'])
  for (const piece of ['top strip', 'capsule', 'page pill', 'menu']) {
    const rows = gv
      .filter((x: any) => x.theme === theme)
      .flatMap((x: any) => x.rows.filter((r: any) => r.piece === piece && !r.disabled));
    const w = rows.map((r: any) => r.wcagMedian).sort((a: number, b: number) => a - b);
    const a = rows.map((r: any) => Math.abs(r.apcaMedian)).sort((a: number, b: number) => a - b);
    glass.push({
      theme,
      piece,
      n: rows.length,
      min: w[0],
      med: w[w.length >> 1],
      max: w[w.length - 1],
      aMin: r1(a[0]),
      aMed: r1(a[a.length >> 1]),
    });
  }
// 4. cvd
const cvd = J('cvd.json').map((x: any) => ({
  group: x.group,
  theme: x.theme,
  a: x.a,
  b: x.b,
  hexA: x.hexA,
  hexB: x.hexB,
  n: x.dENormal,
  p: x.protanopia.dE,
  d: x.deuteranopia.dE,
  t: x.tritanopia.dE,
  min: x.minSimulated,
  lum: x.lumContrast,
  flag: x.flag,
}));
// 5. neutral ramp
const pal = J('palette.json');
const ramp: any = {};
for (const th of ['light', 'dark']) {
  const cs = pal.neutralRamp[th].colours;
  ramp[th] = cs.map((c: any, k: number) => ({
    name: c.name,
    hex: c.hex,
    L: c.L,
    dE: k ? r2(C.deltaE2000(P(cs[k - 1].hex), P(c.hex))) : null,
  }));
}
// 6. lime + brands
const lime = J('lime.json');
// 7. focus by viewport
const focus: any[] = [];
for (const vp of ['desk', 'tablet', 'phone'])
  for (const theme of ['light', 'dark'])
    for (const contrast of ['no-preference', 'more']) {
      const rings = M.variants
        .filter((v: any) => v.viewport === vp && v.theme === theme && v.contrast === contrast)
        .flatMap((v: any) => v.focus ?? [])
        .filter((x: any) => x.visible);
      focus.push({
        vp,
        theme,
        contrast,
        n: rings.length,
        p1411: pct(rings.filter((x: any) => x.pass1411).length, rings.length),
        p2413: pct(rings.filter((x: any) => x.pass2413).length, rings.length),
      });
    }
// 8. non-text by kind
const nontext: any[] = [];
for (const kind of ['border', 'selected', 'glass', 'disabled'])
  for (const theme of ['light', 'dark'])
    for (const contrast of ['no-preference', 'more']) {
      const cs = M.variants
        .filter((v: any) => v.theme === theme && v.contrast === contrast)
        .flatMap((v: any) => v.controls ?? [])
        .filter((x: any) => x.kind === kind);
      nontext.push({
        kind,
        theme,
        contrast,
        n: cs.length,
        pass: pct(cs.filter((x: any) => x.pass3).length, cs.length),
      });
    }

// 9. proposals: the role split and the text ladder
const lightSurf: [string, string][] = [
  ['white', '#ffffff'],
  ['n1', '#fdfdff'],
  ['n2', '#f6f7f9'],
  ['n3', '#eff0f3'],
  ['n4', '#e6e8eb'],
  ['n5', '#dee0e4'],
  ['n6', '#d5d7dc'],
];
const darkSurf: [string, string][] = [
  ['n1', '#08090c'],
  ['n2', '#101215'],
  ['n3', '#17191e'],
  ['n4', '#1f2227'],
  ['n5', '#272a30'],
  ['n6', '#303339'],
  ['menu/white', '#444549'],
  ['seg', '#4b4c50'],
  ['capsule/white', '#515255'],
];
const pair = (fg: string, bg: string) => ({
  fg,
  bg,
  wcag: r2(cr(fg, bg)),
  lc: r1(Math.abs(lc(fg, bg))),
});
const grid = (fg: string, surf: [string, string][]) =>
  surf.map(([k, v]) => ({ k, ...pair(fg, v) }));
const roles = {
  lightText: {
    before: grid('#c8fb3d', lightSurf),
    lime800: grid('#446713', lightSurf),
    lime900: grid('#2f490a', lightSurf),
  },
  lightFill: {
    inkOnLime: pair('#08090c', '#c8fb3d'),
    limeOnInk: pair('#c8fb3d', '#15171c'),
    edgeVsLime: pair('#446713', '#c8fb3d'),
    edgeVsN1: pair('#446713', '#fdfdff'),
    limeVsN1: pair('#c8fb3d', '#fdfdff'),
    limeVsN4: pair('#c8fb3d', '#e6e8eb'),
  },
  focus: {
    inkLight: grid('#08090c', [
      ...lightSurf,
      ['seg track', '#d0d0d2'],
      ['light bar glass', '#f3f8f8'],
    ]),
    limeDark: grid('#c8fb3d', darkSurf),
    limeLight: grid('#c8fb3d', lightSurf),
    inkDark: grid('#08090c', darkSurf.slice(0, 6)),
  },
};
const ladder = {
  dark: [
    ['n9', '#91949a', '#a8abb0'],
    ['n10', '#a1a5ab', '#b8bbc0'],
    ['n11', '#bbbec3', '#c8cbd0'],
    ['n12', '#e8e9ec', '#e8e9ec'],
  ].map(([n, b, a]) => ({
    n,
    before: b,
    after: a,
    oB: C.oklch(P(b)).L,
    oA: C.oklch(P(a)).L,
    gridB: grid(b, darkSurf),
    gridA: grid(a, darkSurf),
  })),
  lightN10: {
    before: grid('#4f535a', [...lightSurf, ['seg', '#d0d0d2']]),
    after: grid('#4a4d54', [...lightSurf, ['seg', '#d0d0d2']]),
  },
  danger: {
    before: grid('#fd7273', darkSurf.slice(2, 7)),
    after: grid('#ff9a9a', darkSurf.slice(2, 7)),
  },
  signHere: {
    before: pair('#989cc5', '#ffffff'),
    after: pair(C.hex(C.over([...P('#1a237e'), 0.75] as any, P('#ffffff'))), '#ffffff'),
  },
  note: { before: pair('#f4e27a', '#f3f8f8'), after: pair('#866b00', '#f3f8f8') },
  segEdge: {
    light: pair('#5d6067', '#d0d0d2'),
    lightN1: pair('#5d6067', '#fdfdff'),
    dark: pair('#a8abb0', '#4b4c50'),
    darkN4: pair('#a8abb0', '#1f2227'),
  },
  fieldEdge: {
    light: pair(C.hex(C.over([...P('#15171c'), 0.55] as any, P('#fdfdff'))), '#fdfdff'),
    dark: pair(C.hex(C.over([255, 255, 255, 0.4] as any, P('#1f2227'))), '#1f2227'),
  },
  dE: [
    ['#c8cbd0', '#e8e9ec'],
    ['#b8bbc0', '#c8cbd0'],
    ['#a8abb0', '#b8bbc0'],
  ].map(([a, b]) => ({ a, b, dE: r1(C.deltaE2000(P(a), P(b))) })),
};
// 10. projection: re-score the measured samples with the proposed colours on the same measured grounds
const MAP: Record<string, Record<string, string>> = {
  dark: {
    '#91949a': '#a8abb0',
    '#a1a5ab': '#b8bbc0',
    '#bbbec3': '#c8cbd0',
    '#fd7273': '#ff9a9a',
    '#1a237e@0.45': '#535a9e',
  },
  light: { '#4f535a': '#4a4d54', '#1a237e@0.45': '#535a9e', '#f4e27a': '#866b00' },
};
function rescore(s: any) {
  const nf = MAP[s.theme]?.[s.fg];
  if (!nf) return s;
  const w = cr(nf, s.bgMedian);
  const a = Math.abs(lc(nf, s.bgMedian));
  const aaNeed = isText(s) ? (s.large ? 3 : 4.5) : 3;
  return {
    ...s,
    fg: nf,
    wcagMedian: w,
    apcaMedian: a,
    passAA: w >= aaNeed,
    passAAA: isText(s) ? w >= (s.large ? 4.5 : 7) : null,
    passAPCABronze: a >= s.apcaBronzeRequired,
  };
}
const proj: any[] = [];
for (const theme of ['light', 'dark'])
  for (const vp of ['desk', 'tablet', 'phone'])
    for (const contrast of ['no-preference', 'more']) {
      const t = S.filter(
        (s: any) => s.theme === theme && s.viewport === vp && s.contrast === contrast && isText(s),
      );
      const i = S.filter(
        (s: any) => s.theme === theme && s.viewport === vp && s.contrast === contrast && !isText(s),
      );
      const tA = t.map(rescore);
      const iA = i.map(rescore);
      proj.push({
        theme,
        vp,
        contrast,
        n: t.length,
        bronzeB: pct(t.filter((s: any) => s.passAPCABronze).length, t.length),
        bronzeA: pct(tA.filter((s: any) => s.passAPCABronze).length, t.length),
        aaB: pct(t.filter((s: any) => s.passAA).length, t.length),
        aaA: pct(tA.filter((s: any) => s.passAA).length, t.length),
        aaaB: pct(t.filter((s: any) => s.passAAA).length, t.length),
        aaaA: pct(tA.filter((s: any) => s.passAAA).length, t.length),
        iconB: pct(i.filter((s: any) => s.passAPCABronze).length, i.length),
        iconA: pct(iA.filter((s: any) => s.passAPCABronze).length, i.length),
        stillFail: tA
          .filter((s: any) => !s.passAPCABronze)
          .map(
            (s: any) =>
              `${s.state}: "${String(s.text).slice(0, 28)}" ${s.fg} on ${s.bgMedian} Lc ${r1(Math.abs(s.apcaMedian))}/${s.apcaBronzeRequired}`,
          ),
      });
    }
const tot = (th: string | null) => {
  const t = S.filter((s: any) => isText(s) && (!th || s.theme === th));
  const tA = t.map(rescore);
  return {
    n: t.length,
    bronzeB: pct(t.filter((s: any) => s.passAPCABronze).length, t.length),
    bronzeA: pct(tA.filter((s: any) => s.passAPCABronze).length, t.length),
    aaB: pct(t.filter((s: any) => s.passAA).length, t.length),
    aaA: pct(tA.filter((s: any) => s.passAA).length, t.length),
    aaaB: pct(t.filter((s: any) => s.passAAA).length, t.length),
    aaaA: pct(tA.filter((s: any) => s.passAAA).length, t.length),
  };
};
const projTotals = { all: tot(null), light: tot('light'), dark: tot('dark') };
// lime area
const limeArea = M.variants.map((v: any) => ({
  state: v.state,
  vp: v.viewport,
  theme: v.theme,
  contrast: v.contrast,
  share: v.limeArea?.share,
}));
const out = {
  slices,
  hist,
  wBins,
  aBins,
  glass,
  cvd,
  ramp,
  lime,
  focus,
  nontext,
  roles,
  ladder,
  proj,
  projTotals,
  limeArea,
  counts: {
    variants: M.variants.length,
    samples: M.samples.length,
    counted: S.length,
    text: S.filter(isText).length,
    icons: S.filter((s: any) => !isText(s)).length,
  },
};
writeFileSync(`${OUT}/data/projection.json`, JSON.stringify(out, null, 1));
console.log(
  JSON.stringify(
    slices.map((s) => [
      s.theme,
      s.edition,
      s.contrast,
      s.nText,
      s.AA,
      s.AAA,
      s.Bronze,
      s.Lc90,
      s.Icon3,
      s.F1411,
      s.F2413,
      s.Sel3,
    ]),
  ),
);
console.log(JSON.stringify(hist));
console.log(JSON.stringify(glass));
console.log(JSON.stringify(projTotals));
for (const p of proj)
  console.log(
    p.theme,
    p.vp,
    p.contrast,
    'bronze',
    p.bronzeB,
    '->',
    p.bronzeA,
    'AA',
    p.aaB,
    '->',
    p.aaA,
    'AAA',
    p.aaaB,
    '->',
    p.aaaA,
    'icon',
    p.iconB,
    '->',
    p.iconA,
    '\n   ',
    [...new Set(p.stillFail)].slice(0, 8).join('\n    '),
  );
console.log(
  JSON.stringify(
    ladder.dark.map((d) => [
      d.n,
      d.before,
      d.after,
      r2(d.oB),
      r2(d.oA),
      d.gridA.map((g: any) => g.k + ' ' + g.wcag + '/' + g.lc).join(' '),
    ]),
  ),
);
console.log(JSON.stringify(focus));
console.log(JSON.stringify(nontext));
console.log(JSON.stringify(ramp));
