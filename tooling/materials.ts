/**
 * Writes `apps/web/src/styles/materials.css` from the coverage registry and the tier tokens of
 * `tokens.css` (components/09-primitives.md §26; docs/specs/redesign.md D3-3). The build and the
 * tests never run it: they use the committed file, and `materials.test.ts` fails when it is not
 * what this would write.
 *
 *   pnpm --filter @pdf-editor/web materials           # regenerate
 *   pnpm --filter @pdf-editor/web materials --check   # exit 1 if the committed file differs
 *
 * The output goes through Biome's formatter, as every committed CSS file does; the test compares
 * the two with whitespace folded.
 *
 * The registry and the generator belong to the app's TypeScript project, so they load at run
 * time (as `e2e/support/harness.ts` loads the registry); the shapes read here are restated.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface Registry {
  readonly COVERAGE_REGISTRY: readonly unknown[];
}
interface Generator {
  readonly materialsFrom: (entries: readonly unknown[], tokensCss: string) => string;
}

const styles = new URL('../apps/web/src/styles/', import.meta.url);
const load = async <T>(name: string): Promise<T> => (await import(new URL(name, styles).href)) as T;

const { COVERAGE_REGISTRY } = await load<Registry>('coverage-registry.ts');
const { materialsFrom } = await load<Generator>('materials-css.ts');

const output = new URL('materials.css', styles);
const raw = materialsFrom(COVERAGE_REGISTRY, readFileSync(new URL('tokens.css', styles), 'utf8'));
const css = execFileSync('pnpm', ['exec', 'biome', 'format', '--stdin-file-path=materials.css'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  input: raw,
  encoding: 'utf8',
});

if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== css) {
    console.error(
      'materials: materials.css is not what the registry and tokens.css give; run `pnpm --filter @pdf-editor/web materials`',
    );
    process.exit(1);
  }
} else {
  writeFileSync(output, css);
}
