/** Which changed files the burn-in jobs pick up (tools/ci/changed-tests.ts). */
import { describe, expect, it } from "vitest";

import { classify } from "./changed-tests.ts";

describe("classify", () => {
  it("picks unit tests under src and test, and top-level e2e specs", () => {
    const got = classify([
      "apps/web/src/a/b.test.tsx",
      "apps/web/test/c.test.ts",
      "apps/web/e2e/x.spec.ts",
      "apps/web/src/a/b.ts",
      "apps/web/e2e/support/helper.spec.ts",
      "apps/web/e2e/y.ts",
      "packages/engine/src/z.test.ts",
      "docs/readme.md",
    ]);
    expect(got.unit).toEqual(["src/a/b.test.tsx", "test/c.test.ts"]);
    expect(got.e2e).toEqual(["e2e/x.spec.ts"]);
  });

  it("is empty when no test changed", () => {
    expect(classify(["README.md", "apps/web/src/a.ts"])).toEqual({
      unit: [],
      e2e: [],
      e2eDropped: [],
    });
  });

  it("sorts, dedupes and caps e2e specs, reporting what was dropped", () => {
    const specs = ["f", "e", "d", "c", "b", "a", "a"].map((n) => `apps/web/e2e/${n}.spec.ts`);
    const got = classify(specs, 5);
    expect(got.e2e).toEqual(["a", "b", "c", "d", "e"].map((n) => `e2e/${n}.spec.ts`));
    expect(got.e2eDropped).toEqual(["e2e/f.spec.ts"]);
  });

  it("refuses a path a shell could misread", () => {
    expect(() => classify(["apps/web/src/a b$(x).test.ts"])).toThrow(/Unsafe/);
  });
});
