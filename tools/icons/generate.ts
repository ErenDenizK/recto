/**
 * Writes `apps/web/src/ui/icons.generated.tsx` from `manifest.json` and @phosphor-icons/core
 * (ADR-0027 §2.6; components/09-primitives.md §30). The build and the tests never run it: they
 * use the committed output.
 *
 *   pnpm icons                       # regenerate
 *   pnpm icons:check                 # exit 1 if the committed file is not what it would write
 *   pnpm icons --source <dir>        # read the set from an unpacked @phosphor-icons/core
 *
 * The set is read from the installed @phosphor-icons/core (its `assets/regular` and
 * `assets/fill`), or from `--source` / `PHOSPHOR_CORE_DIR`, an unpacked copy of the same
 * package; its version must be the manifest's. Nothing is fetched. A name that is not in the
 * set, a missing fill twin or a Lucide table entry that points at no icon fails the run, with
 * every miss listed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildIcons, type Manifest, renderModule } from './icons.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const OUTPUT = join(root, 'apps/web/src/ui/icons.generated.tsx');

function fail(lines: readonly string[]): never {
  for (const line of lines) console.error(`icons: ${line}`);
  process.exit(1);
}

/** The unpacked package: `--source`, `PHOSPHOR_CORE_DIR`, or the installed dependency. */
function sourceDir(args: readonly string[], pkg: string): string {
  const flag = args.indexOf('--source');
  const given = flag >= 0 ? args[flag + 1] : process.env.PHOSPHOR_CORE_DIR;
  if (given) return resolve(given);
  try {
    // The package's exports do not list package.json; its entry sits in dist/.
    return resolve(dirname(fileURLToPath(import.meta.resolve(pkg))), '..');
  } catch {
    fail([`${pkg} is not installed; install it, or pass --source <dir> (an unpacked copy of it)`]);
  }
}

const args = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(join(here, 'manifest.json'), 'utf8')) as Manifest;
const dir = sourceDir(args, manifest.source.package);
const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
  name?: string;
  version?: string;
};
if (meta.name !== manifest.source.package || meta.version !== manifest.source.version) {
  fail([
    `${dir} holds ${meta.name ?? '?'} ${meta.version ?? '?'}, the manifest wants ` +
      `${manifest.source.package} ${manifest.source.version}`,
  ]);
}

const { icons, errors } = buildIcons(manifest, (weight, file) => {
  const path = join(dir, 'assets', weight, `${file}.svg`);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
});
if (errors.length > 0) fail(errors);

const formatted = execFileSync(
  join(root, 'node_modules/.bin/biome'),
  ['format', `--stdin-file-path=${OUTPUT}`],
  { cwd: root, input: renderModule(manifest, icons), encoding: 'utf8' },
);

if (args.includes('--check')) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== formatted) {
    fail(['apps/web/src/ui/icons.generated.tsx is stale: run `pnpm icons` and commit it']);
  }
  console.log(`icons: ${icons.size} icons, up to date`);
} else {
  writeFileSync(OUTPUT, formatted);
  console.log(`icons: wrote ${icons.size} icons to apps/web/src/ui/icons.generated.tsx`);
}
