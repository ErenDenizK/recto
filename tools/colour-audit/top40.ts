/** Builds the merged top-40 failure list (text, icons, non-text, focus) as Markdown rows. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as C from './color.ts';
import { OUT } from './pw.ts';

type Row = Record<string, any>;
const M = JSON.parse(readFileSync(`${OUT}/data/measurements.json`, 'utf8'));
const samples: Row[] = M.samples;
const variants: Row[] = M.variants;
// Focus rings from the ring-zone re-run, when present.
const focus: Row[] = [];
for (const vp of ['desk', 'tablet', 'phone']) {
  const f = `${OUT}/data/raw/${vp}-focus.json`;
  if (!existsSync(f)) continue;
  for (const r of JSON.parse(readFileSync(f, 'utf8')).results)
    for (const x of r.focus ?? [])
      focus.push({ ...x, state: r.state, viewport: vp, theme: r.theme, contrast: r.contrast });
}
// The ring zone is a rectangle, so it undercounts a round control's ring at the diagonals: a band
// counts when its pixels changed by >= 3:1 cover at least half the rectangular perimeter.
for (const f of focus) {
  f.pass1411 = Math.max(f.lightStrongArea ?? 0, f.darkStrongArea ?? 0) >= 0.5 * f.perimeterCss;
  f.oneBandOnly = Math.min(f.lightStrongArea ?? 0, f.darkStrongArea ?? 0) < 0.25 * f.perimeterCss;
}
const tag = (s: Row) => `${s.viewport}/${s.theme}${s.contrast === 'more' ? '+more' : ''}`;
const last = (p: string) =>
  p
    .split(' > ')
    .slice(-1)[0]
    .replace(/\[aria-label=.*$/, '');
const counted = (s: Row) => !s.behind && !s.covered && !s.exempt && s.wcagMedian !== null;

interface Item {
  sev: number;
  kind: string;
  what: string;
  state: string;
  measured: string;
  standard: string;
  where: string;
  shot: string;
}
const items: Item[] = [];

// Text and icons, grouped by element across variants.
const g = new Map<string, Row[]>();
for (const s of samples.filter(
  (s) => counted(s) && (s.passAA === false || s.passAPCABronze === false),
)) {
  const k = `${s.kind}|${s.text}|${last(s.path)}`;
  g.set(k, [...(g.get(k) ?? []), s]);
}
for (const rows of g.values()) {
  const aaReq = (s: Row) => (s.kind === 'icon' ? 3 : s.large ? 3 : 4.5);
  const sev = (s: Row) =>
    Math.max(
      s.passAA ? 0 : 1 + ((aaReq(s) - s.wcagMedian) / aaReq(s)) * 3,
      ((s.apcaBronzeRequired - Math.abs(s.apcaMedian)) / s.apcaBronzeRequired) * 2,
    );
  const w = rows.reduce((a, b) => (sev(b) > sev(a) ? b : a));
  const tags = [...new Set(rows.map(tag))];
  const spread =
    rows.length > 1
      ? ` (range ${Math.min(...rows.map((r) => r.wcagMedian))}–${Math.max(...rows.map((r) => r.wcagMedian))}:1)`
      : '';
  items.push({
    sev: sev(w) + Math.log10(rows.length) * 0.15,
    kind: w.kind === 'icon' ? 'icon' : 'text',
    what: `"${w.text.slice(0, 34)}" ${w.kind === 'icon' ? `${w.fontSize}px icon` : `${w.fontSize}px/${w.weight}`} (${last(w.path).slice(0, 40)})`,
    state: w.state,
    measured: `fg ${w.fg} on ${w.bgMedian}: ${w.wcagMedian}:1, Lc ${Math.round(w.apcaMedian)}${spread}`,
    standard: `${w.passAA ? '' : `AA ${w.kind === 'icon' ? '3' : w.large ? '3' : '4.5'}:1 ✗; `}APCA ${w.apcaUse} Lc ${w.apcaBronzeRequired}${Math.abs(w.apcaMedian) >= w.apcaBronzeRequired ? ' ✓' : ' ✗'}`,
    where: `${tags.length} variant(s): ${tags.slice(0, 4).join(', ')}${tags.length > 4 ? '…' : ''}`,
    shot: w.shot ? `shots/${w.shot} #${w.index}` : '–',
  });
}

// Non-text: control edges and selected states (1.4.11), skipping label rows that hold a hidden input.
const controls: Row[] = variants.flatMap((v) =>
  (v.controls ?? [])
    .filter((c: Row) => c.edgeContrast !== undefined)
    .map((c: Row) => ({
      ...c,
      state: v.state,
      viewport: v.viewport,
      theme: v.theme,
      contrast: v.contrast,
      shot: v.shot,
    })),
);
const cg = new Map<string, Row[]>();
for (const c of controls.filter(
  (c) =>
    (c.kind === 'border' || c.kind === 'selected') &&
    !c.pass3 &&
    !['label', 'div', 'li', 'span'].includes(c.role),
)) {
  const k = `${c.kind}|${c.label.slice(0, 30)}|${last(c.path)}`;
  cg.set(k, [...(cg.get(k) ?? []), c]);
}
for (const rows of cg.values()) {
  const w = rows.reduce((a, b) =>
    Math.max(b.edgeContrast, b.fillContrast) < Math.max(a.edgeContrast, a.fillContrast) ? b : a,
  );
  const best = Math.max(w.edgeContrast, w.fillContrast);
  const tags = [...new Set(rows.map(tag))];
  items.push({
    sev: 1 + ((3 - best) / 3) * 2.2 + Math.log10(rows.length) * 0.15,
    kind: w.kind === 'border' ? 'control edge' : 'selected state',
    what: `${w.role} "${w.label.replace(/\n/g, ' ').slice(0, 30)}" (${last(w.path).slice(0, 36)})`,
    state: w.state,
    measured: `edge ${w.edgeBest} / fill ${w.interior} vs ${w.surround}: ${w.edgeContrast}:1 / ${w.fillContrast}:1`,
    standard: '1.4.11 3:1 ✗',
    where: `${tags.length} variant(s): ${tags.slice(0, 4).join(', ')}${tags.length > 4 ? '…' : ''}`,
    shot: w.shot ? `shots/${w.shot}` : '–',
  });
}

// Focus rings that fail 1.4.11 in the ring zone.
const fg = new Map<string, Row[]>();
for (const f of focus.filter((f) => !f.pass1411)) {
  const k = `${f.label.slice(0, 30)}|${f.role}`;
  fg.set(k, [...(fg.get(k) ?? []), f]);
}
for (const rows of fg.values()) {
  const cover = (f: Row) =>
    Math.max(f.lightStrongArea ?? 0, f.darkStrongArea ?? 0) / f.perimeterCss;
  const w = rows.reduce((a, b) => (cover(b) < cover(a) ? b : a));
  const best = 3 * Math.min(1, cover(w));
  const tags = [...new Set(rows.map(tag))];
  items.push({
    sev: 1 + ((3 - Math.min(3, best)) / 3) * 2.2 + Math.log10(rows.length) * 0.15,
    kind: 'focus ring',
    what: `${w.role} "${w.label.replace(/\n/g, ' ').slice(0, 30)}"`,
    state: w.state,
    measured: `pixels changed ≥ 3:1: light band ${w.lightStrongArea} px², dark band ${w.darkStrongArea} px² vs perimeter ${w.perimeterCss} px (p90 change ${w.lightBandP90}:1 / ${w.darkBandP90}:1)`,
    standard: '1.4.11 3:1 (one band ≥ 1 px thick) ✗',
    where: `${tags.length} variant(s): ${tags.slice(0, 4).join(', ')}${tags.length > 4 ? '…' : ''}`,
    shot: '–',
  });
}

items.sort((a, b) => b.sev - a.sev);
const md = [
  '| # | Sev | Kind | State | Element | Measured (worst variant) | Standard | Variants | Shot |',
  '|---|---|---|---|---|---|---|---|---|',
];
(process.env.KIND ? items.filter((x) => x.kind === process.env.KIND) : items)
  .slice(0, +(process.env.N ?? 40))
  .forEach((it, i) =>
    md.push(
      `| ${i + 1} | ${C.round(it.sev, 2)} | ${it.kind} | ${it.state} | ${it.what.replace(/\|/g, '/')} | ${it.measured} | ${it.standard} | ${it.where} | ${it.shot} |`,
    ),
  );
writeFileSync(`${OUT}/data/top40.md`, md.join('\n') + '\n');
console.log(md.join('\n'));
console.log(
  'total failure groups',
  items.length,
  'by kind',
  JSON.stringify(
    items.reduce((a: Record<string, number>, b) => ((a[b.kind] = (a[b.kind] ?? 0) + 1), a), {}),
  ),
);

// Focus summary from the re-run.
const P = console.log;
for (const vp of ['desk', 'tablet', 'phone'])
  for (const th of ['dark', 'light'])
    for (const ct of ['no-preference', 'more']) {
      const f = focus.filter((x) => x.viewport === vp && x.theme === th && x.contrast === ct);
      if (!f.length) continue;
      const pc = (n: number) => C.round((100 * n) / f.length, 0);
      const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
      P(
        `FOCUS ${vp} ${th} ${ct}: n ${f.length}, :focus-visible ${pc(f.filter((x) => x.visible).length)}%, 1.4.11 ${pc(f.filter((x) => x.pass1411).length)}%, 2.4.13 ${pc(f.filter((x) => x.pass2413).length)}%, one band only ${pc(f.filter((x) => x.oneBandOnly).length)}%, light p90 med ${med(f.map((x) => x.lightBandP90))}, dark p90 med ${med(f.map((x) => x.darkBandP90))}`,
      );
    }
focus
  .filter((x) => !x.pass1411)
  .forEach((f) =>
    P(
      `  ring fail ${tag(f)} ${f.state} "${f.label.replace(/\n/g, ' ').slice(0, 26)}" ${f.role} strongL ${f.lightStrongArea} strongD ${f.darkStrongArea} per ${f.perimeterCss} p90 ${f.lightBandP90}/${f.darkBandP90} vis ${f.visible}`,
    ),
  );
