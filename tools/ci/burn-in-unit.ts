/**
 * Runs the given unit test files (repo-relative paths from changed-tests.ts) five times each in
 * the package they belong to, with that package's own Vitest config, no retries and one worker.
 * Stops at the first failing repeat and says which one.
 *
 *   node --experimental-strip-types tools/ci/burn-in-unit.ts <path>...
 *
 * Vitest treats a file filter as a substring of the test's path, so each file is passed as an
 * absolute path: `src/a.test.ts` cannot also pick up `src/other/a.test.ts`. (`a.test.ts` is
 * still a prefix of `a.test.tsx`; the extra file would only be burned in too.)
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groupByPackage } from './changed-tests.ts';

const REPEATS = 5;
const root = fileURLToPath(new URL('../../', import.meta.url));

for (const [dir, files] of groupByPackage(process.argv.slice(2))) {
  const cwd = resolve(root, dir);
  const filters = files.map((file) => resolve(cwd, file));
  for (let i = 1; i <= REPEATS; i++) {
    console.log(`::group::Burn-in ${dir}, repeat ${i} of ${REPEATS}`);
    const run = spawnSync(
      'pnpm',
      ['exec', 'vitest', 'run', '--maxWorkers=1', '--retry=0', ...filters],
      { cwd, stdio: 'inherit' },
    );
    console.log('::endgroup::');
    if (run.status !== 0) {
      console.log(
        `::error::Burn-in failed in ${dir} on repeat ${i} of ${REPEATS}: ${files.join(' ')}`,
      );
      process.exit(1);
    }
  }
}
