/**
 * Where focus goes when a sheet or a popover opens (system-audit-2026-10 §3.8, I-46): opened by
 * a pointer or a finger, the surface itself takes focus, so no focus ring lights and no touch
 * keyboard rises, as on iPadOS and macOS; opened from the keyboard, the field the opener named
 * (or the first one) takes it, ready to type. A button the opener named keeps its focus either
 * way: focusing it from a pointer shows no ring (`:focus-visible`), and Enter still reaches it.
 *
 * How it was opened comes from Base UI's open type when the opener was its trigger, and from
 * the last input on the window otherwise (`shell/frame/input-modality.ts`): a sheet opened from
 * a menu item, a command or a shortcut has no trigger of its own.
 */
import type { Dialog } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';

import { inputTracker, lastInput } from '../shell/frame/input-modality';

// Listen from the start, so the press that opens the first sheet or popover is already seen.
if (typeof window !== 'undefined') inputTracker();

/** Base UI's `initialFocus`: a flag, an element's ref, or a function of how it opened. */
export type InitialFocus = ComponentProps<typeof Dialog.Popup>['initialFocus'];

/** How Base UI says a popup opened: `mouse`, `touch`, `pen`, `keyboard`, or '' from script. */
export type OpenType = Parameters<Extract<InitialFocus, (openType: never) => unknown>>[0];

/** Whether the surface opening now was opened by a mouse, a finger or a pen. */
export function openedByPointer(openType = ''): boolean {
  if (openType === 'keyboard') return false;
  if (openType === 'mouse' || openType === 'touch' || openType === 'pen') return true;
  const last = lastInput();
  return last !== undefined && last !== 'keyboard';
}

/** Whether focusing `element` lights the ring at once and raises a touch keyboard. */
export function isTextEntry(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return !/^(button|checkbox|color|file|hidden|image|radio|range|reset|submit)$/.test(
      element.type,
    );
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** What an `initialFocus` function answers: an element, the default (true, null) or nothing. */
export type FocusAnswer = ReturnType<Extract<InitialFocus, (openType: never) => unknown>>;

/**
 * `target` with the pointer rule laid over it, called from a popup's `initialFocus` function
 * as it opens: a text field it names, or the default first control, gives way to `surface`
 * when a pointer opened it.
 */
export function resolveInitialFocus(
  target: InitialFocus,
  openType: OpenType,
  surface: HTMLElement | null,
): FocusAnswer {
  const resolved =
    typeof target === 'function'
      ? target(openType)
      : typeof target === 'object'
        ? target.current
        : (target ?? true);
  if (!openedByPointer(openType)) return resolved;
  if (resolved instanceof HTMLElement) {
    return isTextEntry(resolved) ? (surface ?? resolved) : resolved;
  }
  // The default (`true`, or `null`: the first tabbable) becomes the surface.
  if (resolved === true || resolved === null) return surface ?? true;
  return resolved;
}
