/**
 * Static palette inventory of apps/web/src: tokens per theme (resolved), usage counts, hard-coded
 * colours outside tokens.css/materials.css, near-duplicates, the neutral ramps in OKLCH, the type
 * scale against the font sizes declared. Writes data/palette.json.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as C from './color.ts';
import { OUT, ROOT } from './pw.ts';

const SRC = `${ROOT}/apps/web/src`;
const tokensCss = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

function block(selectorStart: string): Map<string, string> {
  const i = tokensCss.indexOf(selectorStart);
  const open = tokensCss.indexOf('{', i);
  let depth = 1;
  let j = open + 1;
  while (depth && j < tokensCss.length) {
    if (tokensCss[j] === '{') depth++;
    else if (tokensCss[j] === '}') depth--;
    j++;
  }
  const body = tokensCss.slice(open + 1, j - 1);
  const map = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
    map.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  return map;
}
const dark = block(":root,\n[data-theme='dark']");
const lightOnly = block("[data-theme='light'] {");
const free = (() => {
  const i = tokensCss.indexOf('--font-ui');
  const start = tokensCss.lastIndexOf(':root', i);
  return block(tokensCss.slice(start, start + 6));
})();
const light = new Map([...dark, ...lightOnly]);

function resolve(map: Map<string, string>, v: string, depth = 0): string {
  if (depth > 12) return v;
  return v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, n, fb) => {
    const r = map.get(n) ?? free.get(n) ?? fb ?? '';
    return resolve(map, r, depth + 1);
  });
}
function evalColour(v: string): C.RGBA | null {
  v = v.trim();
  const mix = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/.exec(v);
  if (mix) {
    const a = evalColour(mix[1]);
    const b = evalColour(mix[3]);
    const t = +mix[2] / 100;
    if (!a || !b) return null;
    return [a[0] * t + b[0] * (1 - t), a[1] * t + b[1] * (1 - t), a[2] * t + b[2] * (1 - t), 1];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+%?))?\s*\)$/.exec(
    v,
  );
  if (rgb) {
    const a = rgb[4] ? (rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])) : 1;
    return [+rgb[1], +rgb[2], +rgb[3], a];
  }
  if (/^#[0-9a-f]{3,8}$/i.test(v) || /^oklch\(/.test(v)) return C.parseCss(v);
  if (v === '#000000' || v === 'black') return [0, 0, 0, 1];
  return null;
}
interface Tok {
  name: string;
  raw: string;
  hex: string;
  alpha: number;
  composite: string; // over the theme's canvas
  oklch: { L: number; C: number; H: number };
}
function tokens(map: Map<string, string>): Tok[] {
  const canvas = evalColour(resolve(map, 'var(--canvas)'))!;
  const out: Tok[] = [];
  for (const [name, raw] of map) {
    if (name.endsWith('-rgb')) continue;
    const c = evalColour(resolve(map, raw));
    if (!c) continue;
    const rgb: C.RGB = [c[0], c[1], c[2]];
    const comp = C.over(c, [canvas[0], canvas[1], canvas[2]]);
    const o = C.oklch(comp);
    out.push({
      name,
      raw,
      hex: C.hex(rgb),
      alpha: C.round(c[3], 3),
      composite: C.hex(comp),
      oklch: { L: C.round(o.L, 3), C: C.round(o.C, 3), H: C.round(o.H, 1) },
    });
  }
  return out;
}
const tokDark = tokens(dark);
const tokLight = tokens(light);

// Usage counts across src (CSS modules, tsx/ts inline), excluding the token and generated files.
function walk(d: string, acc: string[] = []): string[] {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (f === 'node_modules' || f === 'paraglide') continue;
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(css|tsx?|html)$/.test(f) && !/\.test\.|\.spec\./.test(f)) acc.push(p);
  }
  return acc;
}
const files = walk(SRC);
const usage = new Map<string, { css: number; ts: number; files: Set<string> }>();
const hard: { file: string; line: number; value: string; context: string }[] = [];
const fontSizes = new Map<string, { count: number; files: Set<string> }>();
const EXCLUDE = new Set(['styles/tokens.css', 'styles/materials.css']);
for (const f of files) {
  const rel = relative(SRC, f);
  const text = readFileSync(f, 'utf8');
  const isCss = f.endsWith('.css');
  for (const m of text.matchAll(/var\((--[\w-]+)/g)) {
    const u = usage.get(m[1]) ?? { css: 0, ts: 0, files: new Set() };
    if (isCss) u.css++;
    else u.ts++;
    u.files.add(rel);
    usage.set(m[1], u);
  }
  if (EXCLUDE.has(rel)) continue;
  const lines = text.split('\n');
  let inComment = false;
  lines.forEach((ln, i) => {
    let code = ln;
    if (isCss) {
      if (inComment) {
        const e = code.indexOf('*/');
        if (e < 0) return;
        code = code.slice(e + 2);
        inComment = false;
      }
      code = code.replace(/\/\*.*?\*\//g, '');
      const s = code.indexOf('/*');
      if (s >= 0) {
        code = code.slice(0, s);
        inComment = true;
      }
    } else {
      // Only string literals and template literals in TS: skip comments.
      if (/^\s*(\*|\/\/|\/\*)/.test(code)) return;
      code = code.replace(/\/\/.*$/, '');
    }
    for (const m of code.matchAll(
      /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\([^)]*\)/g,
    )) {
      const v = m[0];
      if (/^#[0-9a-f]+$/i.test(v) && ![3, 4, 6, 8].includes(v.length - 1)) continue;
      if (!isCss && !/['"`]/.test(code)) continue;
      if (/var\(--/.test(v) && /rgb\(var\(--[\w-]+-rgb\)/.test(v)) continue; // token alpha recipe
      hard.push({ file: rel, line: i + 1, value: v, context: code.trim().slice(0, 140) });
    }
    if (isCss) {
      for (const m of code.matchAll(/font-size\s*:\s*([^;]+);?/g)) {
        const v = m[1].trim();
        const e = fontSizes.get(v) ?? { count: 0, files: new Set() };
        e.count++;
        e.files.add(rel);
        fontSizes.set(v, e);
      }
      for (const m of code.matchAll(/\bfont\s*:\s*([^;]+);?/g)) {
        const v = 'font: ' + m[1].trim();
        const e = fontSizes.get(v) ?? { count: 0, files: new Set() };
        e.count++;
        e.files.add(rel);
        fontSizes.set(v, e);
      }
    }
  });
}

function nearDupes(list: Tok[]) {
  const opaque = list.filter((t) => t.alpha === 1);
  const pairs: { a: string; b: string; hexA: string; hexB: string; dE: number }[] = [];
  for (let i = 0; i < opaque.length; i++)
    for (let j = i + 1; j < opaque.length; j++) {
      const a = opaque[i];
      const b = opaque[j];
      if (a.hex === b.hex) continue; // identical values are aliases, listed separately
      const d = C.deltaE2000(C.parseHex(a.hex), C.parseHex(b.hex));
      if (d < 2) pairs.push({ a: a.name, b: b.name, hexA: a.hex, hexB: b.hex, dE: C.round(d, 2) });
    }
  const exact = new Map<string, string[]>();
  for (const t of opaque) exact.set(t.hex, [...(exact.get(t.hex) ?? []), t.name]);
  return {
    pairs: pairs.sort((x, y) => x.dE - y.dE),
    sameValue: [...exact].filter(([, n]) => n.length > 1).map(([hex, names]) => ({ hex, names })),
  };
}
function ramp(list: Tok[], prefix: RegExp) {
  const r = list
    .filter((t) => prefix.test(t.name))
    .sort((a, b) => +a.name.replace(/\D/g, '') - +b.name.replace(/\D/g, ''));
  const steps = r.slice(1).map((t, i) => C.round(t.oklch.L - r[i].oklch.L, 3));
  const mean = steps.reduce((a, b) => a + b, 0) / (steps.length || 1);
  const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / (steps.length || 1));
  return {
    colours: r.map((t) => ({
      name: t.name,
      hex: t.hex,
      ...t.oklch,
      Y: C.round(C.relLum(C.parseHex(t.hex)), 4),
    })),
    stepsL: steps,
    meanStep: C.round(mean, 3),
    sdStep: C.round(sd, 3),
    cv: C.round(Math.abs(sd / mean), 2),
  };
}

const allTokenNames = new Set([...dark.keys(), ...lightOnly.keys(), ...free.keys()]);
const colourTokenNames = new Set([...tokDark, ...tokLight].map((t) => t.name));
const usageRows = [...colourTokenNames]
  .map((n) => {
    const u = usage.get(n);
    return {
      name: n,
      uses: u ? u.css + u.ts : 0,
      css: u?.css ?? 0,
      ts: u?.ts ?? 0,
      files: u?.files.size ?? 0,
    };
  })
  .sort((a, b) => b.uses - a.uses);

const typeScale = [...free]
  .filter(([n]) => /^--type-[\w-]+$/.test(n) && !n.endsWith('-lh'))
  .map(([n, v]) => ({ name: n, fine: v }));
const hardByValue = new Map<string, number>();
for (const h of hard)
  hardByValue.set(h.value.toLowerCase(), (hardByValue.get(h.value.toLowerCase()) ?? 0) + 1);

const out = {
  generatedFrom: 'apps/web/src (static), tokens.css §1 dark and §2 light blocks',
  tokenCounts: { dark: tokDark.length, light: tokLight.length, allNamesInFile: allTokenNames.size },
  tokens: { dark: tokDark, light: tokLight },
  usage: usageRows,
  unused: usageRows.filter((r) => r.uses === 0).map((r) => r.name),
  hardCoded: {
    count: hard.length,
    files: new Set(hard.map((h) => h.file)).size,
    byValue: [...hardByValue].sort((a, b) => b[1] - a[1]),
    items: hard,
  },
  nearDuplicates: { dark: nearDupes(tokDark), light: nearDupes(tokLight) },
  neutralRamp: { dark: ramp(tokDark, /^--n\d+$/), light: ramp(tokLight, /^--n\d+$/) },
  limeRamp: ramp(tokDark, /^--lime-\d+$/),
  typeScale,
  fontSizeDeclarations: [...fontSizes]
    .map(([v, e]) => ({ value: v, count: e.count, files: e.files.size }))
    .sort((a, b) => b.count - a.count),
};
writeFileSync(`${OUT}/data/palette.json`, JSON.stringify(out, null, 1));
console.log(
  'tokens dark',
  tokDark.length,
  'light',
  tokLight.length,
  'hard-coded',
  hard.length,
  'in',
  out.hardCoded.files,
  'files',
);
console.log('unused colour tokens', out.unused.length, out.unused.slice(0, 30).join(' '));
console.log(
  'near-dupes dark',
  out.nearDuplicates.dark.pairs.length,
  JSON.stringify(out.nearDuplicates.dark.pairs.slice(0, 12)),
);
console.log(
  'near-dupes light',
  out.nearDuplicates.light.pairs.length,
  JSON.stringify(out.nearDuplicates.light.pairs.slice(0, 12)),
);
console.log(
  'neutral dark steps',
  out.neutralRamp.dark.stepsL.join(' '),
  'cv',
  out.neutralRamp.dark.cv,
);
console.log(
  'neutral light steps',
  out.neutralRamp.light.stepsL.join(' '),
  'cv',
  out.neutralRamp.light.cv,
);
console.log(
  'neutral dark',
  out.neutralRamp.dark.colours.map((c) => `${c.name} ${c.L} ${c.C}`).join(' | '),
);
console.log(
  'neutral light',
  out.neutralRamp.light.colours.map((c) => `${c.name} ${c.L} ${c.C}`).join(' | '),
);
console.log('lime', out.limeRamp.colours.map((c) => `${c.name} ${c.L} ${c.C} ${c.H}`).join(' | '));
console.log('type scale', JSON.stringify(typeScale));
console.log('font-size decls', JSON.stringify(out.fontSizeDeclarations.slice(0, 40)));
console.log('hard top', JSON.stringify(out.hardCoded.byValue.slice(0, 30)));
console.log('top usage', JSON.stringify(usageRows.slice(0, 25).map((r) => r.name + ':' + r.uses)));
