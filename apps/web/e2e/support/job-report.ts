/**
 * The V1 core-job recorder (PLAN §2.2, V1-F1…F12). A job is walked as a few named acts; each act
 * counts the presses a person makes (a click or tap, a key, one drag or typing gesture, a native
 * dialog's choice) and its wall time. The run is report-only for now (W0-q): an act that cannot
 * be completed is recorded as `blocked` with the reason instead of failing the test, and budgets
 * are written next to the counts without being enforced. Set `JOBS_STRICT=1` to turn both into
 * failures (the later wave that enforces the budgets).
 *
 * Each job writes `test-results/jobs/<project>/<id>.json` and the same facts as test annotations,
 * so the HTML report shows them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Locator, type Page, type TestInfo } from '@playwright/test';

export interface ActRecord {
  readonly name: string;
  readonly presses: number;
  readonly ms: number;
  /** The proposed budget in presses (PLAN §2.2), or null where the criterion is not a count. */
  readonly budget: number | null;
  readonly status: 'done' | 'blocked' | 'skipped';
  readonly note?: string;
}

/** Counts the presses of one act. */
export class Presses {
  count = 0;
  constructor(private readonly page: Page) {}

  /** A click, or a tap on a coarse pointer. */
  async press(target: Locator): Promise<void> {
    this.count += 1;
    if (await this.page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
      await target.tap();
    } else {
      await target.click();
    }
  }

  /** A key (or chord). */
  async key(key: string): Promise<void> {
    this.count += 1;
    await this.page.keyboard.press(key);
  }

  /** One gesture: a drag, a typed word, a pick in the file dialog. */
  async gesture(run: () => Promise<void>): Promise<void> {
    this.count += 1;
    await run();
  }

  /** A press the browser's own surface takes (the save picker, a permission prompt). */
  native(): void {
    this.count += 1;
  }
}

export class Job {
  private readonly acts: ActRecord[] = [];
  private gated: string | null = null;
  private readonly started = Date.now();

  constructor(
    readonly id: string,
    readonly title: string,
    private readonly page: Page,
    private readonly info: TestInfo,
  ) {}

  /**
   * Walks one act. `gate` makes the acts after it skip when this one is blocked (they depend on
   * its result). The error's first line is the note.
   */
  async act(
    name: string,
    budget: number | null,
    run: (p: Presses) => Promise<void>,
    options: { readonly gate?: boolean } = {},
  ): Promise<void> {
    if (this.gated) {
      this.acts.push({
        name,
        presses: 0,
        ms: 0,
        budget,
        status: 'skipped',
        note: `needs "${this.gated}"`,
      });
      return;
    }
    const presses = new Presses(this.page);
    const t0 = Date.now();
    try {
      await run(presses);
      this.acts.push({ name, presses: presses.count, ms: Date.now() - t0, budget, status: 'done' });
    } catch (error) {
      const note = (error instanceof Error ? error.message : String(error))
        .split('\n')
        .find((line) => line.trim() !== '')
        ?.trim();
      this.acts.push({
        name,
        presses: presses.count,
        ms: Date.now() - t0,
        budget,
        status: 'blocked',
        ...(note ? { note: note.slice(0, 300) } : {}),
      });
      // What the page looked like where the act stopped, next to the report.
      const dir = join(process.cwd(), 'test-results', 'jobs', this.info.project.name);
      mkdirSync(dir, { recursive: true });
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40);
      await this.page
        .screenshot({ path: join(dir, `${this.id}-${slug}.png`) })
        .catch(() => undefined);
      if (options.gate) this.gated = name;
    }
  }

  /** The acts that could not be completed, as "name: reason" (for a test that must pass). */
  blocked(): string[] {
    return this.acts.filter((a) => a.status === 'blocked').map((a) => `${a.name}: ${a.note ?? ''}`);
  }

  /** Records an act the job cannot walk yet, with the reason. */
  skip(name: string, budget: number | null, note: string): void {
    this.acts.push({ name, presses: 0, ms: 0, budget, status: 'skipped', note });
  }

  /** Writes the report and the annotations; throws only under `JOBS_STRICT=1`. */
  finish(): void {
    const report = {
      id: this.id,
      title: this.title,
      project: this.info.project.name,
      totalMs: Date.now() - this.started,
      acts: this.acts,
    };
    const dir = join(process.cwd(), 'test-results', 'jobs', this.info.project.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${this.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
    for (const act of this.acts) {
      const budget = act.budget === null ? 'n/a' : `<= ${act.budget}`;
      this.info.annotations.push({
        type: `${this.id} ${act.name}`,
        description: `${act.status} | ${act.presses} presses (budget ${budget}) | ${act.ms} ms${act.note ? ` | ${act.note}` : ''}`,
      });
    }
    if (process.env.JOBS_STRICT) {
      const bad = this.acts.filter(
        (a) => a.status === 'blocked' || (a.budget !== null && a.presses > a.budget),
      );
      if (bad.length > 0) {
        throw new Error(`${this.id}: ${bad.map((a) => `${a.name} (${a.status})`).join(', ')}`);
      }
    }
  }
}
