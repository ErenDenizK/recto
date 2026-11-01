/**
 * The opening from the desk as a small state machine (DSN-87, `masa.md` §2.7; DSN-64): lift,
 * hold, grow, settle back. No DOM and no timers, so every path is tested without a browser
 * (`open-motion.test.ts`); `library-transition.ts` runs the effects.
 *
 * ```
 * lifted ──left──────────────▶ left ──(work done + page ready)──▶ flying ──landed──▶ done
 *    │                          │ └─returned / 15 s─▶ (unveil) settling
 *    ├─ work ended, Home still ─▶ settling ──landed──▶ done
 *    └─ 15 s ──────────────────▶ settling
 * ```
 *
 * - **lifted**: the tile's cover is cloned and lifted over it; the desk stays visible and live
 *   underneath. After `BUSY_MS` the tile shows its busy ring and "Opening report-v2.pdf" is
 *   announced (once).
 * - **left**: Home unmounted, so the open succeeded. The clone and a still copy of the desk stay
 *   over the window while the reader mounts, a reopen finishes and a resume settles.
 * - **flying**: the clone grows into the reader's page on `glide` and dissolves at the end.
 * - **settling**: the open was cancelled, refused or failed (or took past `HOLD_CAP_MS`): the
 *   clone settles back into its tile on `smooth` and is removed; the view never changed.
 * - **Interruptible**: a press while an opening runs is ignored (`canLift`); Home coming back
 *   during the flight ends it at once (`returned`).
 */

/** The busy ring and the announcement wait this long after the press (ms). */
export const BUSY_MS = 400;
/** A hold longer than this fails (ms): the clone settles back, or the flight dissolves. */
export const HOLD_CAP_MS = 15_000;
/** The lifted cover's scale (`quick`, MOT-19's slight bounce allowed). */
export const LIFT_SCALE = 1.02;

export type OpenPhase = 'lifted' | 'left' | 'flying' | 'settling' | 'done';

export interface OpenState {
  readonly phase: OpenPhase;
  /** The busy ring and the announcement have shown. */
  readonly busy: boolean;
  /** The open action has resolved or failed. */
  readonly worked: boolean;
}

export type OpenEvent =
  /** Milliseconds since the press. */
  | { readonly type: 'time'; readonly ms: number }
  /** Home unmounted: the reader is coming. */
  | { readonly type: 'left' }
  /** Home is back before the flight ended (a cancel, `0`, a second view change). */
  | { readonly type: 'returned' }
  /** The open action resolved or rejected. */
  | { readonly type: 'worked' }
  /** The reader's page is laid out and settled (the caller checks). */
  | { readonly type: 'ready' }
  /** The open landed where there is no page to fly to (the Pages grid, Compare). */
  | { readonly type: 'nowhere' }
  /** The flight or the settle ended. */
  | { readonly type: 'landed' };

export type OpenEffect =
  | 'ring'
  | 'announce'
  /** Take the still copy of the desk before it unmounts. */
  | 'veil'
  /** Remove the still copy of the desk (the view never changed). */
  | 'unveil'
  | 'fly'
  | 'settle'
  /** The wait ended with no page: dissolve the clone and the copy. */
  | 'dissolve'
  | 'finish';

export const lifted: OpenState = { phase: 'lifted', busy: false, worked: false };

export interface OpenStep {
  readonly state: OpenState;
  readonly effects: readonly OpenEffect[];
}

const stay = (state: OpenState): OpenStep => ({ state, effects: [] });

/** One transition. Events that do not apply in a phase change nothing. */
export function step(state: OpenState, event: OpenEvent): OpenStep {
  const { phase } = state;
  if (phase === 'done') return stay(state);
  switch (event.type) {
    case 'time': {
      if (phase === 'flying' || phase === 'settling') return stay(state);
      if (event.ms >= HOLD_CAP_MS) {
        return phase === 'left'
          ? { state: { ...state, phase: 'flying' }, effects: ['dissolve'] }
          : { state: { ...state, phase: 'settling' }, effects: ['settle'] };
      }
      if (event.ms >= BUSY_MS && !state.busy) {
        return { state: { ...state, busy: true }, effects: ['ring', 'announce'] };
      }
      return stay(state);
    }
    case 'left':
      return phase === 'lifted'
        ? { state: { ...state, phase: 'left' }, effects: ['veil'] }
        : stay(state);
    case 'worked': {
      const next = { ...state, worked: true };
      // The action ended with Home still showing: refused, cancelled or several files.
      return phase === 'lifted'
        ? { state: { ...next, phase: 'settling' }, effects: ['settle'] }
        : { state: next, effects: [] };
    }
    case 'ready':
      return phase === 'left' && state.worked
        ? { state: { ...state, phase: 'flying' }, effects: ['fly'] }
        : stay(state);
    case 'nowhere':
      return phase === 'left'
        ? { state: { ...state, phase: 'flying' }, effects: ['dissolve'] }
        : stay(state);
    case 'returned':
      if (phase === 'left') {
        return { state: { ...state, phase: 'settling' }, effects: ['unveil', 'settle'] };
      }
      return phase === 'flying'
        ? { state: { ...state, phase: 'done' }, effects: ['finish'] }
        : stay(state);
    case 'landed':
      return phase === 'flying' || phase === 'settling'
        ? { state: { ...state, phase: 'done' }, effects: ['finish'] }
        : stay(state);
  }
}

/** Whether a press may start an opening: one runs at a time (`canLift(null)`). */
export const canLift = (current: OpenState | null): boolean =>
  current === null || current.phase === 'done';
