/**
 * Lists the tests a pull request adds or changes, for the burn-in jobs in
 * .github/workflows/ci.yml (lesson L13: an unstable test is caught on the PR that adds it).
 *
 *   node --experimental-strip-types tools/ci/changed-tests.ts [base] [--max-e2e N]
 *
 * `base` is any git revision to diff the working tree's HEAD against; the default `HEAD^1` is
 * the base branch tip on the merge commit that `pull_request` checkouts build, so the diff is
 * exactly the pull request's own changes. Added, modified and renamed files count; deleted
 * ones do not. Prints `unit=<paths>` and `e2e=<paths>` (space-separated, relative to
 * apps/web, the directory both runners start in) and appends the same lines to
 * $GITHUB_OUTPUT when it is set. A path with an unusual character is an error, not skipped,
 * since the lists reach a shell.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Where Vitest looks for tests in apps/web (apps/web/vitest.config.ts `include`). */
const UNIT = /^apps\/web\/((?:src|test)\/.*\.test\.tsx?)$/;
/** Playwright's testDir is apps/web/e2e; specs sit directly in it. */
const E2E = /^apps\/web\/(e2e\/[^/]+\.spec\.ts)$/;
const SAFE = /^[\w./@+-]+$/;

export interface Changed {
  unit: string[];
  e2e: string[];
  /** E2E specs left out because of the cap. */
  e2eDropped: string[];
}

/** Sorts changed repo paths into unit tests and e2e specs; `maxE2e` caps the spec list. */
export function classify(paths: readonly string[], maxE2e = Infinity): Changed {
  const unit = new Set<string>();
  const e2e = new Set<string>();
  for (const path of paths) {
    const u = UNIT.exec(path)?.[1];
    const e = E2E.exec(path)?.[1];
    const rel = u ?? e;
    if (rel === undefined) continue;
    if (!SAFE.test(rel)) throw new Error(`Unsafe test path: ${JSON.stringify(path)}`);
    (u === undefined ? e2e : unit).add(rel);
  }
  const specs = [...e2e].sort();
  return {
    unit: [...unit].sort(),
    e2e: specs.slice(0, maxE2e),
    e2eDropped: specs.slice(maxE2e),
  };
}

function changedPaths(base: string): string[] {
  const out = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=AMR", "-M", "-z", base, "HEAD"],
    { encoding: "utf8" },
  );
  return out.split("\0").filter(Boolean);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const capAt = args.indexOf("--max-e2e");
  const cap = capAt === -1 ? Infinity : Number(args.splice(capAt, 2)[1]);
  const result = classify(changedPaths(args[0] ?? "HEAD^1"), cap);
  if (result.e2eDropped.length > 0) {
    console.log(
      `E2E burn-in is limited to ${cap} specs; not burned in: ${result.e2eDropped.join(" ")}`,
    );
  }
  const lines = [`unit=${result.unit.join(" ")}`, `e2e=${result.e2e.join(" ")}`];
  console.log(lines.join("\n"));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}
