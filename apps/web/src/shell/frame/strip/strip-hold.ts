/**
 * The page strip's door (R26 concept 1, DSN-63): the flag, the hold-or-slide that opens it and
 * the pill's scrub preview. This is all that ships with the editor; the strip itself
 * (`PageStrip.tsx`) loads at the first press on the trigger, early enough that it is here by
 * the time a hold completes (Q-11: panels load on first use).
 *
 * - **Flag:** `?strip=1` turns it on, `?strip=0` off; the choice is kept in `localStorage` as
 *   the palette flag's is (`markup/palette-variant.ts`), and read once per page.
 * - **Open:** pressing and holding the trigger for `HOLD_MS`, or sliding it by `SLOP` px, opens
 *   the strip; a tap does neither and keeps today's behaviour, the menu (DSN-29). The click
 *   that ends an opening press is swallowed (`consumeStripClick`).
 * - **Keys:** ArrowUp on the trigger opens it for the keyboard (a listbox, `PageStrip.tsx`).
 */
import { labsStored } from '../../../labs/stored';
import { lazyModule } from '../../../motion/lazy';

const QUERY_PARAM = 'strip';
const STORAGE_KEY = 'pdf-editor:strip:v1';
/** A press held this long opens the strip. */
export const HOLD_MS = 320;
/** A press that travels this far (px) opens it at once. */
export const SLOP = 8;

let enabled: boolean | undefined;

/** Whether the strip is on for this page: the address, else the stored choice, else off. */
export function stripEnabled(): boolean {
  if (enabled !== undefined) return enabled;
  const asked = new URLSearchParams(location.search).get(QUERY_PARAM);
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
    if (asked === '1') localStorage.setItem(STORAGE_KEY, '1');
    else if (asked === '0') localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the address alone decides.
  }
  enabled = asked === '1' || (asked !== '0' && labsStored('strip', stored) === '1');
  return enabled;
}

/** What `PageStrip.tsx` hands back for the press that opened it. */
export interface StripSession {
  move(x: number, y: number): void;
  /** The finger or button came up: go to the page, close. */
  release(): void;
  /** Esc, a cancelled touch: close without going. */
  cancel(): void;
}

export interface StripInit {
  readonly trigger: HTMLElement;
  /** The strip lies along x (desktop, tablet) or y (the phone's rail). */
  readonly axis: 'x' | 'y';
  /** Opened by a press (true) or by the keyboard (false). */
  readonly pointer: boolean;
  readonly x: number;
  readonly y: number;
}

const strip = lazyModule(() => import('./PageStrip'));

// The page being scrubbed to, which the pill's number follows (it rolls) while the strip is open.
let preview: number | null = null;
const listeners = new Set<() => void>();
export const stripPreview = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: (): number | null => preview,
};
export function setStripPreview(page: number | null): void {
  if (preview === page) return;
  preview = page;
  for (const listener of listeners) listener();
}

let swallow = false;
/** True once after a press that opened the strip: its click must not open the menu. */
export function consumeStripClick(): boolean {
  const was = swallow;
  swallow = false;
  return was;
}

/** The trigger's `onPointerDown`: arms the hold and slide that open the strip. */
export function holdForStrip(
  event: { readonly currentTarget: HTMLElement } & Pick<
    PointerEvent,
    'button' | 'isPrimary' | 'clientX' | 'clientY' | 'pointerId'
  >,
  axis: 'x' | 'y',
): void {
  if (!stripEnabled() || event.button !== 0 || !event.isPrimary) return;
  swallow = false;
  void strip.load().catch(() => undefined);
  const trigger = event.currentTarget;
  const { pointerId } = event;
  const sx = event.clientX;
  const sy = event.clientY;
  let x = sx;
  let y = sy;
  let state: 'armed' | 'open' | 'released' | 'cancelled' = 'armed';
  let session: StripSession | null = null;
  const stop = () => {
    clearTimeout(timer);
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', cancel);
  };
  const open = () => {
    if (state !== 'armed') return;
    state = 'open';
    swallow = true;
    strip.run(
      (mod) => {
        if (state === 'cancelled') return;
        session = mod.openPageStrip({ trigger, axis, pointer: true, x, y });
        if (state === 'released') session.release();
      },
      () => undefined,
    );
  };
  const timer = setTimeout(open, HOLD_MS);
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    x = e.clientX;
    y = e.clientY;
    if (state === 'armed' && Math.hypot(x - sx, y - sy) > SLOP) open();
    session?.move(x, y);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    stop();
    if (state === 'open') {
      state = 'released';
      session?.release();
    } else state = 'cancelled';
  };
  const cancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    stop();
    session?.cancel();
    state = 'cancelled';
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', cancel);
}

/** The trigger's `onKeyDown`: ArrowUp opens the strip for the keyboard. True when it did. */
export function keyForStrip(
  event: { readonly key: string; readonly currentTarget: HTMLElement; preventDefault(): void },
  axis: 'x' | 'y',
): boolean {
  if (!stripEnabled() || event.key !== 'ArrowUp') return false;
  event.preventDefault();
  const trigger = event.currentTarget;
  strip.run(
    (mod) => {
      mod.openPageStrip({ trigger, axis, pointer: false, x: 0, y: 0 });
    },
    () => undefined,
  );
  return true;
}
