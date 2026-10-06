/**
 * Where the dock's labels go (`components/01-frame.md` F10 §2; spec 01.5): beside the icons
 * when the dock fits that way, else under them. Labels are always shown (RA-20); only their
 * place changes, without animation (F10 §7).
 *
 * The dock is centred in the band and must keep 12 px from the page pill at the band's
 * trailing end, 16 px in, so its room is the band less 16 px each side and the pill and its
 * 12 px clearance mirrored on both sides. A narrow window (compact) always stacks, as the
 * phone's dock does. When even stacked labels touch the pill, the pill rises above the dock
 * (`DockBand.tsx`, spec 01.6).
 *
 * The width with labels beside is measured once per locale while they are beside, then kept, so
 * the dock can return beside once the band has room for it again (no hidden copy is measured).
 */
import type { SizeClass } from './size-class';

export type DockLabelForm = 'beside' | 'under';

/** The band's inset on each side and the pill's clearance (F10 §2, spec 01.6). */
export const DOCK_EDGE = 16;
export const PILL_CLEARANCE = 12;

/** The widest the dock may be in a band `band` px wide with a pill `pill` px wide (0: none). */
export function dockRoom(band: number, pill: number): number {
  const beside = pill > 0 ? pill + PILL_CLEARANCE : 0;
  return band - 2 * DOCK_EDGE - 2 * beside;
}

export interface LabelFormInput {
  readonly size: SizeClass;
  /** The dock's width with labels beside, measured in this locale; null until measured. */
  readonly besideWidth: number | null;
  /** `dockRoom()` now. */
  readonly room: number;
}

/** Beside while that fits (or until it has been measured), under otherwise; compact stacks. */
export function dockLabelForm({ size, besideWidth, room }: LabelFormInput): DockLabelForm {
  if (size === 'compact') return 'under';
  if (besideWidth === null) return 'beside';
  return besideWidth <= room ? 'beside' : 'under';
}
