/** Merges data/raw/*.json into data/measurements.json and prints the numbers for the report. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as C from './color.ts';
import { OUT } from './pw.ts';

type Row = Record<string, any>;
const variants: Row[] = [];
const samples: Row[] = [];
const errors: Row[] = [];
for (const vp of ['desk', 'tablet', 'phone']) {
  const f = `${OUT}/data/raw/${vp}.json`;
  if (!existsSync(f)) continue;
  const d = JSON.parse(readFileSync(f, 'utf8'));
  errors.push(...d.errors.map((e: Row) => ({ ...e, viewport: vp })));
  const ff = `${OUT}/data/raw/${vp}-focus.json`;
  const fresh = existsSync(ff) ? JSON.parse(readFileSync(ff, 'utf8')).results : [];
  for (const r of d.results) {
    const again = fresh.find(
      (x: Row) => x.state === r.state && x.theme === r.theme && x.contrast === r.contrast,
    );
    if (again) r.focus = again.focus;
    const { samples: ss, ...rest } = r;
    variants.push({ ...rest, sampleCount: ss.length });
    ss.forEach((s: Row, i: number) =>
      samples.push({
        state: r.state,
        viewport: vp,
        edition: r.edition,
        theme: r.theme,
        contrast: r.contrast,
        glass: r.glass,
        shot: r.shot,
        index: i,
        ...s,
      }),
    );
  }
}
writeFileSync(
  `${OUT}/data/measurements.json`,
  JSON.stringify({
    generated: new Date().toISOString(),
    notes:
      'One row per text node group, field value/placeholder or icon glyph per state × viewport × theme × contrast. Colours are 8-bit sRGB hex; contrast ratios are WCAG 2.x; apca* are signed APCA Lc (0.0.98G); bg* are sampled from a screenshot with all text and icons hidden.',
    errors,
    variants,
    samples,
  }),
);

const counted = (s: Row) => !s.behind && !s.covered && !s.exempt && s.wcagMedian !== null;
const isText = (s: Row) => s.kind !== 'icon';
const pct = (a: number, b: number) => (b ? C.round((100 * a) / b, 1) : null);
const P = console.log;

P(
  'variants',
  variants.length,
  'samples',
  samples.length,
  'counted',
  samples.filter(counted).length,
  'errors',
  JSON.stringify(errors),
);
P(
  'states per vp',
  ['desk', 'tablet', 'phone']
    .map(
      (v) => `${v}:${new Set(variants.filter((x) => x.viewport === v).map((x) => x.state)).size}`,
    )
    .join(' '),
);
P(
  'excluded: behind',
  samples.filter((s) => s.behind).length,
  'covered',
  samples.filter((s) => !s.behind && s.covered).length,
  'disabled',
  samples.filter((s) => !s.behind && !s.covered && s.exempt?.startsWith('disabled')).length,
  'gradient/transparent',
  samples.filter((s) => s.exempt && !s.exempt.startsWith('disabled')).length,
);
P(
  'unsettled variants',
  variants
    .filter((v) => !v.settled)
    .map((v) => `${v.state}/${v.viewport}/${v.theme}/${v.contrast}`)
    .join(', '),
);

function rates(filter: (s: Row) => boolean) {
  const t = samples.filter((s) => counted(s) && isText(s) && filter(s));
  const i = samples.filter((s) => counted(s) && !isText(s) && filter(s));
  return {
    text: t.length,
    AA: pct(t.filter((s) => s.passAA).length, t.length),
    AAA: pct(t.filter((s) => s.passAAA).length, t.length),
    AAworstPx: pct(t.filter((s) => s.passAAWorst).length, t.length),
    APCAbronze: pct(t.filter((s) => s.passAPCABronze).length, t.length),
    APCAlookup: pct(t.filter((s) => s.passAPCA).length, t.length),
    Lc90: pct(t.filter((s) => s.apcaPreferred90).length, t.length),
    icons: i.length,
    icon3: pct(i.filter((s) => s.passAA).length, i.length),
    iconAPCA: pct(i.filter((s) => s.passAPCA).length, i.length),
  };
}
P('\nPASS RATES (text AA/AAA at the median pixel; worst = every pixel; icons 3:1)');
P('ALL', JSON.stringify(rates(() => true)));
for (const vp of ['desk', 'tablet', 'phone'])
  for (const th of ['dark', 'light'])
    for (const ct of ['no-preference', 'more'])
      P(
        vp,
        th,
        ct,
        JSON.stringify(rates((s) => s.viewport === vp && s.theme === th && s.contrast === ct)),
      );
for (const th of ['dark', 'light']) P('theme', th, JSON.stringify(rates((s) => s.theme === th)));
for (const ct of ['no-preference', 'more'])
  P('contrast', ct, JSON.stringify(rates((s) => s.contrast === ct)));
for (const vp of ['desk', 'tablet', 'phone'])
  P('vp', vp, JSON.stringify(rates((s) => s.viewport === vp)));
P(
  'by tier',
  ['mat-bar', 'mat-chip', 'mat-menu', 'mat-panel', 'mat-sheet', 'mat-lit', 'mat', null]
    .map((t) => `${t}:${JSON.stringify(rates((s) => s.tier === t))}`)
    .join('\n'),
);
P(
  'by use',
  ['ui', 'body', 'display', 'placeholder']
    .map((u) => `${u}:${JSON.stringify(rates((s) => s.apcaUse === u))}`)
    .join('\n'),
);
P(
  'by state',
  [...new Set(variants.map((v) => v.state))]
    .map((st) => `${st}:${JSON.stringify(rates((s) => s.state === st))}`)
    .join('\n'),
);

// Top failures, grouped by element identity and theme/contrast.
const fails = samples.filter(
  (s) =>
    counted(s) && (s.passAA === false || s.passAPCABronze === false || s.passAAWorst === false),
);
const last = (p: string) => p.split(' > ').slice(-2).join(' > ');
const groups = new Map<string, Row[]>();
for (const s of fails) {
  const k = `${s.kind}|${s.text}|${last(s.path)}|${s.theme}|${s.contrast}`;
  groups.set(k, [...(groups.get(k) ?? []), s]);
}
const aaReq = (s: Row) => (s.kind === 'icon' ? 3 : s.large ? 3 : 4.5);
const sev = (s: Row) => {
  const aa = aaReq(s) / s.wcagMedian; // > 1 fails at the median
  const worst = aaReq(s) / s.wcagWorst;
  const apca = s.apcaBronzeRequired / Math.max(1, Math.abs(s.apcaMedian));
  return Math.max(aa * 1.2, worst * 0.6, apca * 0.8);
};
const ranked = [...groups.values()]
  .map((g) => {
    const w = g.reduce((a, b) => (sev(b) > sev(a) ? b : a));
    return {
      worst: w,
      n: g.length,
      states: [...new Set(g.map((x) => `${x.state}/${x.viewport}`))],
      severity: sev(w),
    };
  })
  .sort((a, b) => b.severity - a.severity);
P(
  '\nFAIL GROUPS',
  ranked.length,
  'AA-failing groups',
  ranked.filter((r) => r.worst.passAA === false).length,
);
ranked.slice(0, 70).forEach((r, i) => {
  const s = r.worst;
  P(
    `${i + 1}. sev ${C.round(r.severity, 2)} [${s.theme}/${s.contrast === 'more' ? 'more' : 'std'}] ${s.state}/${s.viewport} ${s.kind} "${s.text}" ${s.fontSize}px/${s.weight} role=${s.role} tier=${s.tier} fg ${s.fg} bg ${s.bgMedian} (bright ${s.bgBright}, dark ${s.bgP10Dark}) CR ${s.wcagMedian} worst ${s.wcagWorst} Lc ${s.apcaMedian} need ${s.apcaBronzeRequired}/${s.apcaRequired} AA:${s.passAA} n=${r.n} shot=${s.shot}#${s.index} path=${last(s.path)} in: ${r.states.slice(0, 6).join(',')}`,
  );
});

// Non-text.
const controls: Row[] = variants.flatMap((v) =>
  (v.controls ?? [])
    .filter((c: Row) => c.edgeContrast !== undefined)
    .map((c: Row) => ({
      ...c,
      state: v.state,
      viewport: v.viewport,
      theme: v.theme,
      contrast: v.contrast,
    })),
);
P('\nNON-TEXT');
for (const kind of ['border', 'selected', 'glass', 'disabled'])
  for (const th of ['dark', 'light'])
    for (const ct of ['no-preference', 'more']) {
      const c = controls.filter((x) => x.kind === kind && x.theme === th && x.contrast === ct);
      if (!c.length) continue;
      const e = c.map((x) => x.edgeContrast).sort((a, b) => a - b);
      P(
        kind,
        th,
        ct,
        'n',
        c.length,
        'pass3 (edge or fill)',
        pct(c.filter((x) => x.pass3).length, c.length),
        'edge median',
        e[e.length >> 1],
        'min',
        e[0],
      );
    }
const ctlGroups = new Map<string, Row>();
for (const c of controls.filter(
  (x) => !x.pass3 && (x.kind === 'border' || x.kind === 'selected'),
)) {
  const k = `${c.kind}|${c.label}|${last(c.path)}|${c.theme}|${c.contrast}`;
  const prev = ctlGroups.get(k);
  if (!prev || c.edgeContrast < prev.edgeContrast)
    ctlGroups.set(k, { ...c, n: (prev?.n ?? 0) + 1 });
  else prev.n++;
}
P('worst border/selected:');
[...ctlGroups.values()]
  .sort((a, b) => a.edgeContrast - b.edgeContrast)
  .slice(0, 40)
  .forEach((c) =>
    P(
      `  [${c.theme}/${c.contrast}] ${c.state}/${c.viewport} ${c.kind} "${c.label.replace(/\n/g, ' ')}" ${c.role} surround ${c.surround} interior ${c.interior} edge ${c.edgeBest}@${c.edgeBestOffset} edgeCR ${c.edgeContrast} fillCR ${c.fillContrast} n=${c.n} ${last(c.path)}`,
    ),
  );
P('glass rims (edge vs outside, fill vs outside):');
for (const th of ['dark', 'light'])
  for (const ct of ['no-preference', 'more']) {
    const g = controls.filter((x) => x.kind === 'glass' && x.theme === th && x.contrast === ct);
    const byTier = new Map<string, Row[]>();
    for (const x of g) byTier.set(x.tier, [...(byTier.get(x.tier) ?? []), x]);
    P(
      ' ',
      th,
      ct,
      [...byTier]
        .map(([t, xs]) => {
          const e = xs.map((x) => x.edgeContrast).sort((a, b) => a - b);
          const f = xs.map((x) => x.fillContrast).sort((a, b) => a - b);
          return `${t}: n${xs.length} edge ${e[0]}..${e[e.length >> 1]}..${e[e.length - 1]} fill ${f[0]}..${f[f.length >> 1]}..${f[f.length - 1]} ≥3: ${pct(xs.filter((x) => Math.max(x.edgeContrast, x.fillContrast) >= 3).length, xs.length)}%`;
        })
        .join(' | '),
    );
  }

const focus: Row[] = variants.flatMap((v) =>
  (v.focus ?? []).map((f: Row) => ({
    ...f,
    state: v.state,
    viewport: v.viewport,
    theme: v.theme,
    contrast: v.contrast,
  })),
);
P('\nFOCUS RINGS', focus.length);
for (const vp of ['desk', 'tablet', 'phone'])
  for (const th of ['dark', 'light'])
    for (const ct of ['no-preference', 'more']) {
      const f = focus.filter((x) => x.viewport === vp && x.theme === th && x.contrast === ct);
      if (!f.length) continue;
      P(
        vp,
        th,
        ct,
        'n',
        f.length,
        'visible',
        pct(f.filter((x) => x.visible).length, f.length),
        '1.4.11',
        pct(f.filter((x) => x.pass1411).length, f.length),
        '2.4.13',
        pct(f.filter((x) => x.pass2413).length, f.length),
        'lightBand med',
        f.map((x) => x.lightBandMedian).sort((a, b) => a - b)[f.length >> 1],
        'darkBand med',
        f.map((x) => x.darkBandMedian).sort((a, b) => a - b)[f.length >> 1],
      );
    }
focus
  .filter((x) => !x.pass1411 || !x.visible)
  .slice(0, 30)
  .forEach((f) =>
    P(
      `  FAIL [${f.theme}/${f.contrast}] ${f.state}/${f.viewport} "${f.label.replace(/\n/g, ' ')}" ${f.role} visible=${f.visible} light ${f.lightBandMedian} (${f.lightBandArea}px²) dark ${f.darkBandMedian} (${f.darkBandArea}px²) area/perim ${f.areaOverPerimeter}`,
    ),
  );

// Lime usage, measured.
const LIME: C.RGB = [200, 251, 61];
const near = (h: string | null, d = 6) => !!h && C.deltaE2000(C.parseHex(h.slice(0, 7)), LIME) < d;
const limeText = samples.filter((s) => counted(s) && near(s.fg));
const onLime = samples.filter((s) => counted(s) && near(s.bgMedian, 8));
P(
  '\nLIME as text/icon colour:',
  limeText.length,
  [
    ...new Set(
      limeText.map(
        (s) =>
          `${s.theme}/${s.contrast}:${s.kind}:"${s.text}" on ${s.bgMedian} CR ${s.wcagMedian} Lc ${s.apcaMedian} (${s.state})`,
      ),
    ),
  ]
    .slice(0, 25)
    .join('\n  '),
);
P(
  'LIME behind text/icon:',
  onLime.length,
  [
    ...new Set(
      onLime.map(
        (s) =>
          `${s.theme}/${s.contrast}:${s.kind}:"${s.text}" fg ${s.fg} on ${s.bgMedian} CR ${s.wcagMedian} Lc ${s.apcaMedian} (${s.state})`,
      ),
    ),
  ]
    .slice(0, 25)
    .join('\n  '),
);
const limeEdges = controls.filter((c) => near(c.edgeBest, 10) || near(c.interior, 8));
P(
  'LIME edges/fills (controls):',
  limeEdges.length,
  [
    ...new Set(
      limeEdges.map(
        (c) =>
          `${c.theme}/${c.contrast}:${c.kind}:"${c.label.replace(/\n/g, ' ').slice(0, 20)}" edge ${c.edgeBest} interior ${c.interior} vs ${c.surround} CR ${c.edgeContrast}/${c.fillContrast} (${c.state}/${c.viewport})`,
      ),
    ),
  ]
    .slice(0, 30)
    .join('\n  '),
);
P('LIME area % of screen by state (dark std | light std):');
for (const st of [...new Set(variants.map((v) => v.state))]) {
  const g = (th: string, vp: string) =>
    variants.find(
      (v) =>
        v.state === st && v.theme === th && v.contrast === 'no-preference' && v.viewport === vp,
    )?.limeArea.share ?? '-';
  P(
    `  ${st}: desk ${g('dark', 'desk')} | ${g('light', 'desk')}; tablet ${g('dark', 'tablet')} | ${g('light', 'tablet')}; phone ${g('dark', 'phone')} | ${g('light', 'phone')}`,
  );
}

// Sizes.
P('\nSIZES');
for (const vp of ['desk', 'tablet', 'phone']) {
  const t = samples.filter((s) => s.viewport === vp && isText(s) && !s.behind && !s.covered);
  const hist = new Map<number, number>();
  for (const s of t) hist.set(s.fontSize, (hist.get(s.fontSize) ?? 0) + 1);
  const sizes = [...hist].sort((a, b) => a[0] - b[0]);
  P(vp, 'min', sizes[0]?.[0], 'hist', sizes.map(([k, v]) => `${k}:${v}`).join(' '));
  const small = t.filter((s) => s.fontSize === sizes[0]?.[0]);
  P(
    '  smallest:',
    [...new Set(small.map((s) => `"${s.text}" (${s.state}, ${last(s.path)})`))]
      .slice(0, 8)
      .join('; '),
  );
}
const weights = new Map<number, number>();
for (const s of samples.filter((s) => isText(s)))
  weights.set(s.weight, (weights.get(s.weight) ?? 0) + 1);
P(
  'weights',
  [...weights]
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v}`)
    .join(' '),
);
const fam = new Map<string, number>();
for (const s of samples.filter((s) => isText(s))) fam.set(s.family, (fam.get(s.family) ?? 0) + 1);
P('families', JSON.stringify([...fam]));
const fgs = new Map<string, number>();
for (const s of samples.filter((s) => counted(s)))
  fgs.set(
    `${s.theme}:${(s.fg ?? '').slice(0, 7)}`,
    (fgs.get(`${s.theme}:${(s.fg ?? '').slice(0, 7)}`) ?? 0) + 1,
  );
P(
  'distinct measured fg colours',
  fgs.size,
  JSON.stringify([...fgs].sort((a, b) => b[1] - a[1]).slice(0, 40)),
);
