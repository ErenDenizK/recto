/**
 * Which of the five presentations a sheet takes (components/07-sheets.md §1.1, §2; ADR-0031
 * §2 item 7 as amended by ADR-0033 §2.2): pure, from the sheet's kind and the window's size
 * class. Phones run the compact edition (`shell/compact/`, its own sheet), so the compact and
 * compact-height columns here serve narrow desktop windows and 400 % zoom (A-20), with the
 * functions of the wide layouts and their own placement.
 *
 * | Kind                 | compact < 600            | compact-height | medium 600–839 | expanded and up |
 * |----------------------|--------------------------|----------------|----------------|-----------------|
 * | tool (non-modal)     | bottom, 40 % · 92 %      | side 360       | side 360       | side 400        |
 * | task (modal)         | bottom at 92 %           | full           | form ≤ 640     | side 400, scrim |
 * | settings (modal)     | bottom at 92 %           | full           | form ≤ 640     | side 480, scrim |
 * | confirmation         | bottom, content ≤ 60 %   | dialog 400     | dialog 400     | dialog 400      |
 * | overlay (shortcuts)  | full                     | full           | dialog 760     | dialog 760      |
 *
 * compact-height (a window under 480 px tall and under 1000 wide) takes precedence over the
 * width class, as the table's column does. Settings on compact is 07 §1.1's "full sheet at
 * 92 %": a sheet that rises to 92 % of the window and swipes down, which is the bottom sheet
 * with one detent, so it shares the task sheet's presentation.
 */
import type { FrameClass } from '../../shell/frame/size-class';

/** What a sheet is for (07 §0, §1.1). */
export type SheetKind = 'tool' | 'task' | 'settings' | 'confirmation' | 'overlay';

/** The five presentations of 07 §0. */
export type Presentation = 'side' | 'form' | 'dialog' | 'bottom' | 'full';

export interface SheetLayout {
  readonly presentation: Presentation;
  /** Width in CSS px (the window less its gutters caps it); null fills the window. */
  readonly width: number | null;
  /** Modal: focus trapped, the rest of the page inert. Tool sheets keep the page live. */
  readonly modal: boolean;
  /** A scrim beneath (modal presentations only, 07 §3). */
  readonly scrim: boolean;
  /**
   * Bottom sheets: rest heights as fractions of the window's height, lowest first, the first
   * the one it opens at. Empty: the sheet's own content height (a confirmation, ≤ 60 %).
   */
  readonly detents: readonly number[];
  /** The axis a swipe closes along, or null where no swipe closes it (07 §2.6). */
  readonly swipe: 'down' | 'right' | null;
  /** `alertdialog` for confirmations (07 §2.8, §3.8). */
  readonly role: 'dialog' | 'alertdialog';
}

/** The compact tool sheet's two detents (07 §2.2: 0.40 and 0.92 of the window). */
export const TOOL_DETENTS = [0.4, 0.92] as const;
/** The compact task and settings sheets' one detent. */
export const TASK_DETENTS = [0.92] as const;
/** A compact confirmation is at most this share of the window tall (07 §1.1). */
export const CONFIRMATION_MAX_SHARE = 0.6;

/** Widths of 07 §2.2. */
export const SHEET_WIDTH = {
  side: 400,
  sideMedium: 360,
  settings: 480,
  form: 640,
  dialog: 400,
  overlay: 760,
} as const;

type Column = 'compact' | 'short' | 'medium' | 'wide';

function columnOf(frame: Pick<FrameClass, 'size' | 'short'>): Column {
  if (frame.short) return 'short';
  if (frame.size === 'compact') return 'compact';
  if (frame.size === 'medium') return 'medium';
  return 'wide';
}

const layout = (
  presentation: Presentation,
  width: number | null,
  modal: boolean,
  extra: Partial<Pick<SheetLayout, 'detents' | 'swipe' | 'role'>> = {},
): SheetLayout => ({
  presentation,
  width,
  modal,
  scrim: modal,
  detents: extra.detents ?? [],
  swipe: extra.swipe ?? (presentation === 'bottom' ? 'down' : null),
  role: extra.role ?? 'dialog',
});

/** The presentation of a sheet of `kind` in a window of `frame` (07 §1.1). */
export function presentationOf(
  kind: SheetKind,
  frame: Pick<FrameClass, 'size' | 'short'>,
): SheetLayout {
  const column = columnOf(frame);
  switch (kind) {
    case 'tool':
      if (column === 'compact') return layout('bottom', null, false, { detents: TOOL_DETENTS });
      // A compact-height side sheet swipes right to close (07 §2.6).
      if (column === 'short')
        return layout('side', SHEET_WIDTH.sideMedium, false, { swipe: 'right' });
      return layout('side', column === 'medium' ? SHEET_WIDTH.sideMedium : SHEET_WIDTH.side, false);
    case 'task':
    case 'settings':
      if (column === 'compact') return layout('bottom', null, true, { detents: TASK_DETENTS });
      if (column === 'short') return layout('full', null, true);
      if (column === 'medium') return layout('form', SHEET_WIDTH.form, true);
      return layout('side', kind === 'settings' ? SHEET_WIDTH.settings : SHEET_WIDTH.side, true);
    case 'confirmation':
      if (column === 'compact') return layout('bottom', null, true, { role: 'alertdialog' });
      return layout('dialog', SHEET_WIDTH.dialog, true, { role: 'alertdialog' });
    case 'overlay':
      if (column === 'compact' || column === 'short') return layout('full', null, true);
      return layout('dialog', SHEET_WIDTH.overlay, true);
  }
}

/**
 * Rest offsets of a bottom sheet, in px from its tallest position, for each detent, lowest
 * detent first; rounded to whole pixels so a resting sheet sits on the pixel grid
 * (quality-bar Q-2). `visible` is the panel's visible height at its tallest, `viewport` the
 * window's height. With no detents the sheet rests at its full height (offset 0).
 */
export function detentOffsets(
  detents: readonly number[],
  visible: number,
  viewport: number,
): number[] {
  if (detents.length === 0) return [0];
  return detents.map((share) => Math.max(0, Math.round(visible - share * viewport)));
}

/** Release speeds (px/s) of 07 §2.6 and §2.7. */
export const SWIPE_CLOSE_SPEED = 800;
export const FLING_SPEED = 300;

/**
 * Where a released swipe goes (07 §2.6): `offset` is where the panel was let go (px from its
 * tallest position, positive towards closed), `projected` where momentum carries it,
 * `velocity` its speed towards closed in px/s, `offsets` the rest offsets (`detentOffsets`)
 * and `closed` the offset at which it is wholly off screen. It closes when thrown faster than
 * 800 px/s towards closed, or when it would come to rest with less than half of its lowest
 * detent showing; otherwise it snaps to the detent nearest the projection.
 */
export function releaseTarget(
  projected: number,
  velocity: number,
  offsets: readonly number[],
  closed: number,
): { readonly close: true } | { readonly close: false; readonly offset: number } {
  const lowest = Math.max(...offsets);
  const lowestShowing = closed - lowest;
  if (velocity > SWIPE_CLOSE_SPEED || closed - projected < lowestShowing / 2) {
    return { close: true };
  }
  let best = offsets[0] ?? 0;
  for (const offset of offsets) {
    if (Math.abs(offset - projected) < Math.abs(best - projected)) best = offset;
  }
  return { close: false, offset: best };
}
