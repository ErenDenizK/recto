/**
 * The test-only render override (docs/specs/redesign.md X36; ADR-0024 §2.4; ADR-0028 §2.1;
 * `src/state/render-quality.ts`). Every CI browser renders in software on four cores, so the app
 * would start at Glass Tinted and at the cost ladder's step 2; the default, pixel, motion and
 * matrix projects pin what they measure with
 *
 *   window.__rectoRender = { degrade: 'off', glass: 'clear', light: 'auto' }
 *
 * set by an init script before the app's first line runs. The builds Playwright serves compile
 * the override in (`RECTO_RENDER_OVERRIDE=1`, playwright.config.ts and CI's e2e build), the
 * deploy build does not. Under automation with nothing set, those builds apply the same values
 * (`navigator.webdriver`), so a spec that does not call this is pinned too; the one spec that
 * checks the real start states opts out with `withoutRenderOverride`.
 */
import type { Page } from '@playwright/test';

export interface RenderOverride {
  readonly degrade: 'off' | 'auto';
  readonly glass: 'clear' | 'tinted' | 'solid' | 'auto';
  readonly light: 'auto' | 'still' | 'off';
}

/** What the default, pixel, motion and matrix projects run with. */
export const RENDER_OVERRIDE: RenderOverride = { degrade: 'off', glass: 'clear', light: 'auto' };

/** Sets the override before the page's scripts run (every navigation of `page`). */
export async function useRenderOverride(
  page: Page,
  override: RenderOverride = RENDER_OVERRIDE,
): Promise<void> {
  await page.addInitScript((value) => {
    (window as { __rectoRender?: unknown }).__rectoRender = value;
  }, override);
}

/** Opts out: the app detects its start state and runs its ladder as on a real device. */
export async function withoutRenderOverride(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as { __rectoRender?: unknown }).__rectoRender = null;
  });
}

/** Reports `hardwareConcurrency` (and no `deviceMemory`) as a device with `cores` cores would. */
export async function emulateCores(page: Page, cores: number): Promise<void> {
  await page.addInitScript((count) => {
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {
      configurable: true,
      get: () => count,
    });
    Object.defineProperty(Navigator.prototype, 'deviceMemory', {
      configurable: true,
      get: () => undefined,
    });
  }, cores);
}
