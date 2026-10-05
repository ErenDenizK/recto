/**
 * The first-pen hint (flows §3.4; 03-markup MK-16; 05-canvas §6): in viewing a pen acts as a
 * mouse and selects text (S1), so a person who meant to write is told how, once: "Writing? Tap
 * Markup, or let the pen write anywhere in Settings." It shows on the first pen press on a page
 * in viewing on a device with a touch screen (`showsPenHint`: never for a desktop drawing
 * tablet, never when locked, not while "Pen writes without Markup" is on), once per device
 * (`input-policy-store`'s `penHintShown`), and leaves when Markup opens. The press itself goes
 * on as a mouse press.
 *
 * Until the dock exists (D2: `markup/PenHint.tsx`, a callout above its Markup button), the hint
 * is a toast in the region at the dock band, with "Settings" (Pen and touch) as its action and
 * its ✕ as "Got it"; it is announced once, politely, by the toast API.
 */
import { m } from '../i18n';
import { openSettings } from '../settings/open-settings';
import { useInputPolicyStore } from '../state/input-policy-store';
import { isMarkupOpen, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { showsPenHint } from './hit-order';
import { pageInputNow } from './input-state';

/** The hint toast's key and test id. */
export const PEN_HINT_KEY = 'pen-hint';

/** A page of the page view: where a pen press counts. */
const PAGE = '[data-read-viewport] [data-page-id]';

/** Shows the hint for the active document; it leaves when Markup opens there. */
export function showPenHint(): void {
  useInputPolicyStore.getState().markPenHintShown();
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  const shown = { toast: '' };
  const off = useUiStore.subscribe((state) => {
    if (!isMarkupOpen(state, id)) return;
    off();
    toast.dismiss(shown.toast);
  });
  shown.toast = toast.action(
    m.pen_hint(),
    { label: m.pen_hint_settings(), run: () => openSettings({ section: 'pen' }) },
    { key: PEN_HINT_KEY, documentId: id, testId: PEN_HINT_KEY, onDismiss: off },
  );
}

/** Watches pen presses on pages (capture phase, passive: the press goes on). */
export function installPenHint(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  const onDown = (event: PointerEvent) => {
    if (event.pointerType !== 'pen') return;
    if (!(event.target instanceof Element) || event.target.closest(PAGE) === null) return;
    const policy = useInputPolicyStore.getState();
    const show = showsPenHint({
      pointerType: event.pointerType,
      maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
      state: pageInputNow(),
      penWritesWithoutMarkup: policy.penWritesWithoutMarkup,
      shown: policy.penHintShown,
    });
    if (show) showPenHint();
  };
  const options = { capture: true, passive: true } as const;
  target.addEventListener('pointerdown', onDown, options);
  return () => target.removeEventListener('pointerdown', onDown, options);
}
