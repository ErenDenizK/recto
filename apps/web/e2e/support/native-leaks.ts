/**
 * No browser default leaks (quality-bar.md Q-14; spec redesign D0-3, D0-QA): every control draws
 * its own states from the shared tokens, so none of the browser's own furniture shows through.
 * The primitives' browser-mode suites render each state; this is the app-wide sweep:
 *
 * - **The tap highlight** is transparent on the root (`styles/reset.css`) and on every visible
 *   control (it is inherited: a control that sets its own colour would bring the blue back).
 *   Engines without the property (Firefox) report nothing and are passed by.
 * - **Native controls**: no visible `select` with the browser's arrow (`appearance` other than
 *   `none`), no `input type="number"` (its spinners differ per engine; `ui/NumberField`
 *   replaces it), and no native checkbox, radio, range or colour box.
 * - **The native focus ring** (`outline-style: auto`, every engine's default) on no Tab stop:
 *   `focusStops` presses Tab through a state and reads each element that takes focus.
 */
import type { Page } from '@playwright/test';

export interface Leak {
  readonly state: string;
  readonly problem: string;
}

/** Interactive elements, as the bar audit names them. */
const CONTROL = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="option"]',
  '[role="slider"]',
].join(', ');

/** Sweeps the page as it is now for the leaks above (all but the focus ring). */
export async function nativeLeaks(page: Page, state: string): Promise<Leak[]> {
  const problems = await page.evaluate((selector) => {
    const found: string[] = [];
    const visible = (el: Element): boolean => {
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) return false;
      if (box.bottom <= 0 || box.right <= 0 || box.top >= innerHeight || box.left >= innerWidth) {
        return false;
      }
      if (el.closest('[inert], [hidden], [aria-hidden="true"]')) return false;
      // Clipped away wholly: the input Base UI's slider keeps for assistive technology.
      if (getComputedStyle(el).clipPath === 'inset(50%)') return false;
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const name = (el: Element): string => {
      const label =
        el.getAttribute('aria-label') ??
        el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 24) ??
        '';
      return `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;
    };
    const tap = (el: Element) =>
      getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color');
    const clear = (colour: string) =>
      colour === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(colour.trim());
    const supported = tap(document.documentElement) !== '';
    if (supported && !clear(tap(document.documentElement))) {
      found.push(`the root's tap highlight is ${tap(document.documentElement)}`);
    }
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el)) continue;
      if (supported && !clear(tap(el))) {
        found.push(`${name(el)} has the tap highlight ${tap(el)}`);
      }
      const appearance = getComputedStyle(el).appearance;
      if (el instanceof HTMLSelectElement && appearance !== 'none') {
        found.push(`${name(el)} shows the browser's select (appearance: ${appearance})`);
      }
      if (el instanceof HTMLInputElement) {
        if (el.type === 'number') found.push(`${name(el)} is a native number field (spinners)`);
        if (['checkbox', 'radio', 'range', 'color'].includes(el.type) && appearance !== 'none') {
          found.push(`${name(el)} is a native ${el.type} (appearance: ${appearance})`);
        }
      }
    }
    return found;
  }, CONTROL);
  return problems.map((problem) => ({ state, problem }));
}

/**
 * Presses Tab up to `max` times from where focus is, and reports each stop that shows the
 * browser's own focus ring (`outline-style: auto`). Stops when focus comes back to an element
 * it has already visited (a trapped sheet's cycle) or leaves the document.
 */
export async function focusStops(
  page: Page,
  state: string,
  max = 40,
): Promise<{ readonly stops: number; readonly leaks: Leak[] }> {
  const leaks: Leak[] = [];
  let stops = 0;
  await page.evaluate(() => {
    (window as unknown as { __tabStops: Element[] }).__tabStops = [];
  });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const visited = (window as unknown as { __tabStops: Element[] }).__tabStops;
      if (visited.includes(el)) return null;
      visited.push(el);
      const label =
        el.getAttribute('aria-label') ??
        el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 24) ??
        '';
      return {
        name: `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`,
        outline: getComputedStyle(el).outlineStyle,
      };
    });
    if (!stop) break;
    stops += 1;
    if (stop.outline === 'auto') {
      leaks.push({ state, problem: `${stop.name} shows the browser's focus ring` });
    }
  }
  await page.evaluate(() => {
    delete (window as unknown as { __tabStops?: Element[] }).__tabStops;
  });
  return { stops, leaks };
}
