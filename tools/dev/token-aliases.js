#!/usr/bin/env node
/**
 * The token alias codemod (migration step 11 of components/09-primitives.md §32;
 * docs/design/system-audit-2026-10.md §4 "Platform"): rewrites every retired token name in the
 * web app's styles and scripts to the name it stood for. Names only: a value never changes here.
 * `tokens.css` no longer defines the old names, so a branch that still uses one fails
 * `tokens.test.ts` ("reads no undefined token"); run this after a rebase to fix it:
 *
 *   node tools/dev/token-aliases.js          rewrites the files in place
 *   node tools/dev/token-aliases.js --check  lists what it would change, exits 1 if anything
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Each retired name and the token it read. */
export const RENAMES = {
  '--surface-0': '--canvas',
  '--surface-1': '--surface-frame',
  '--surface-2': '--surface-raised',
  '--surface-3': '--surface-on',
  '--accent-highlight': '--select-wash',
  '--accent-highlight-strong': '--select-wash-strong',
  '--font-sans': '--font-ui',
  '--text-xs': '--type-caption',
  '--text-sm': '--type-footnote',
  '--text-md': '--type-body',
  '--text-lg': '--type-callout',
  '--radius-1': '--radius-xs',
  '--radius-2': '--radius-sm',
  '--radius-3': '--radius-md',
  '--radius-round': '--radius-capsule',
  '--radius-pill': '--radius-capsule',
  '--icon-chrome': '--icon-sm',
  '--icon-toolbar': '--icon-md',
  '--control-height': '--control-h',
  '--bar-button': '--control-h',
  '--chip-h': '--control-h-sm',
};

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const web = join(root, 'apps/web');
const DIRS = ['src', 'test', 'harness', 'e2e'].map((dir) => join(web, dir));
/** The token files themselves describe the retirement; they are edited by hand. */
const SKIP = new Set(
  ['src/styles/tokens.css', 'src/styles/token-registry.ts', 'src/styles/tokens.test.ts'].map(
    (file) => join(web, file),
  ),
);
const pattern = new RegExp(
  `(?<![\\w-])(${Object.keys(RENAMES)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\w-])`,
  'g',
);

function* files(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'paraglide') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(css|ts|tsx|js|mjs)$/.test(name) && !SKIP.has(path)) yield path;
  }
}

const check = process.argv.includes('--check');
let changed = 0;
for (const dir of DIRS) {
  for (const path of files(dir)) {
    const source = readFileSync(path, 'utf8');
    let count = 0;
    const next = source.replace(pattern, (name) => {
      count++;
      return RENAMES[name];
    });
    if (count === 0) continue;
    changed++;
    console.log(`${relative(root, path)}: ${count}`);
    if (!check) writeFileSync(path, next);
  }
}
if (check && changed > 0) process.exit(1);
