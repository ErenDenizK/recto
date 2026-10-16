/**
 * The glass's runtime after the first paint (decision GLS-11): the lens on floating bars and
 * capsules. `useAppearanceRoot` loads it once the app has painted, so it is in no first closure.
 * The glass's tone follows the theme only (GLS-20): nothing here reads the page.
 */
import { lensOn } from './lens-map';
import {
  chromiumBackdropLens,
  lensAllowed,
  lensCount,
  lensOff,
  MAX_LENSES,
  REGENERATE_MS,
} from './material-lens';

/** The bars the manager lenses (GLS-11): floating M2, never docked or solid. */
const BARS = '.mat-bar:not(.mat-docked, .mat-opaque)';

/** Whether a bar is on screen and at rest (no transition or animation of its own running). */
function barReady(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) {
    return false;
  }
  if (getComputedStyle(el).opacity === '0') return false;
  return typeof el.getAnimations !== 'function' || el.getAnimations().length === 0;
}

/**
 * The lens on floating bars and capsules (GLS-11): one document-level manager, since bars
 * compose their material in CSS modules. On Chromium with a GPU only; it gives the lens to the
 * largest bars at rest on screen while the count (shared with the chips' hook) allows, takes it
 * from any that starts to move, and redraws a map after a size change. Returns its disposer.
 */
export function startBarLenses(): () => void {
  if (typeof document === 'undefined' || !chromiumBackdropLens()) return idle;
  const held = new Set<HTMLElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = (el: HTMLElement) => {
    lensOff(el);
    if (held.delete(el)) lensCount.mounted--;
  };
  const update = () => {
    const allowed = lensAllowed();
    for (const el of [...held]) {
      if (!allowed || !el.isConnected || !barReady(el)) release(el);
    }
    if (!allowed) return;
    const candidates = [...document.querySelectorAll<HTMLElement>(BARS)]
      .filter((el) => !held.has(el) && !el.classList.contains('lens') && barReady(el))
      .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight);
    for (const el of candidates) {
      if (lensCount.mounted >= MAX_LENSES) break;
      if (!lensOn(el)) continue;
      held.add(el);
      lensCount.mounted++;
      resize.observe(el);
    }
    for (const el of held) lensOn(el);
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(update, REGENERATE_MS);
  };
  const resize = new ResizeObserver(later);
  const tree = new MutationObserver(later);
  tree.observe(document.body, { subtree: true, childList: true });
  const settings = new MutationObserver(update);
  settings.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-glass', 'data-degrade', 'data-motion'],
  });
  // A bar that starts to move loses its lens at once; it may take it back once at rest.
  const moving = (event: Event) => {
    const el = event.target as HTMLElement;
    if (held.has(el) && (event.type === 'transitionrun' || event.type === 'animationstart')) {
      release(el);
    }
    later();
  };
  const kinds = ['transitionrun', 'animationstart', 'transitionend', 'animationend'] as const;
  for (const kind of kinds) document.addEventListener(kind, moving, true);
  window.addEventListener('resize', later);
  later();
  return () => {
    clearTimeout(timer);
    resize.disconnect();
    tree.disconnect();
    settings.disconnect();
    for (const kind of kinds) document.removeEventListener(kind, moving, true);
    window.removeEventListener('resize', later);
    for (const el of [...held]) release(el);
  };
}

/** A disposer with nothing to dispose. */
function idle(): void {
  // Nothing started.
}

/** Starts the bars' lenses; returns their disposer. */
export function startGlassRuntime(): () => void {
  return startBarLenses();
}
