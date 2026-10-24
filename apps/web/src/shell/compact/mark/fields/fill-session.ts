/**
 * The phone's fill flow (MOB-1; research phone-2026-10/forms.md §3 ideas 1–3, §4.1): what a
 * tap on a field does, and the run of fields the fill bar steps through until Done.
 *
 * - **A check box or radio** ticks at once (`TickIn`, one "Fill" history entry). While
 *   reading, an Undo toast follows (`toast.undo`, bound to that step, as the phone's Highlight
 *   offers Undo where there is no island); while editing the island's Undo has it.
 * - **A text or choice field** opens the flow: the editor takes the focus inside the tap, so
 *   iOS raises the keyboard (or the picker) for it; when the editors' chunk is not here yet a
 *   stand-in holds the keyboard until it is (EDN-17). The island or capsule steps away for the
 *   fill bar (`setTyping`), and the reader zooms so the field's text is 16 px at least
 *   (`requestZoom`, `fieldZoom`), the editor itself laid out at 16 px at least (`minFontPx`).
 * - **The bar's ‹ ›** commit the open editor and move to the previous or next fillable field in
 *   document order (`activeStops`, wrapping); a check box reached so waits for a tap with the
 *   keyboard down. **Done**, Enter, a tap away from the field or the keyboard's own dismissal
 *   commits and ends the flow: the zoom goes back to where it was and, while reading, the
 *   Undo toast offers the last fill.
 * - **A signature field** opens Sign (EDN-14): the editing chunk loads (EDN-21), then editing
 *   begins with Sign armed and its drawer open on the saved signatures and New.
 * - **Locked** or **read-only**: one short toast; nothing fills.
 */
import type { FormField } from '@pdf-editor/engine';
import { getActiveDocument } from '@pdf-editor/document-model';
import { flushSync } from 'react-dom';

import { whenIdle } from '../../../../annotations/edit-runner';
import { commitFieldValue } from '../../../../forms/actions';
import {
  type ActiveField,
  documentSources,
  type FieldStop,
  fieldStops,
  isFillable,
  useFormStore,
  widgetsOf,
} from '../../../../forms/form-store';
import { m } from '../../../../i18n';
import { useWorkspaceStore } from '../../../../state/workspace-store';
import { toast } from '../../../../ui/Toast';
import { canChangeActive } from '../../../../viewer/input-state';
import { requestZoom, setDrawerOpen, setTyping, useCompactStore } from '../../compact-store';
import { loadMark } from '../../mark-host';
import { holdKeyboard, releaseKeyboard } from '../keyboard-hold';
import { editorsNow, loadEditors } from './editors';
import { fieldZoom, stepStop, takesKeyboard, toggleValue } from './fill-flow';

/** The flow's toast key: a newer fill's toast replaces the last one's. */
const TOAST_KEY = 'compact-fill';

interface Session {
  /** The history's past length when the flow began: a fill since then earns the toast. */
  readonly base: number;
  /** The reader's zoom before the flow zoomed in, to go back to on Done. */
  zoomBefore: number | null;
  /** The field the flow was last on. */
  last: ActiveField;
}

let session: Session | null = null;
/** The last Undo toast the flow showed: a new flow puts it away (the bar takes its place). */
let lastToast: string | null = null;
/** CSS px per point of the pages as last laid out (one scale for every page). */
let pageScale = 1;
const listeners = new Set<() => void>();

function publish(): void {
  for (const listener of listeners) listener();
}

/** The flow is open (the fill bar shows). */
export function isFilling(): boolean {
  return session !== null;
}

/** Follows `isFilling`. */
export function subscribeFilling(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The page layers report the reader's scale as they render. */
export function notePageScale(scale: number): void {
  if (scale > 0) pageScale = scale;
}

/** The fillable stops of the active document, in document order. */
export function fillStops(): FieldStop[] {
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (!doc) return [];
  return fieldStops(doc, useFormStore.getState().sources).filter((s) => isFillable(s.field));
}

const historyLength = () => useWorkspaceStore.getState().history.past.length;
const reading = () => !useCompactStore.getState().editing;

/** Once the queued fills are in, an Undo toast for the newest while reading. */
function offerUndo(base: number): void {
  void whenIdle().then(() => {
    if (session !== null || !reading() || historyLength() <= base) return;
    lastToast = toast.undo(m.compact_fill_done(), {
      key: TOAST_KEY,
      testId: 'compact-fill-toast',
    });
  });
}

/** May fills happen? A toast says why not. */
function mayFill(field: FormField): boolean {
  if (!canChangeActive('targeted')) {
    toast.info(m.compact_fill_locked(), { key: TOAST_KEY });
    return false;
  }
  if (field.readOnly) {
    toast.info(m.compact_fill_read_only(), { key: TOAST_KEY });
    return false;
  }
  return true;
}

function begin(here: ActiveField): Session {
  if (session) return session;
  session = { base: historyLength(), zoomBefore: null, last: here };
  if (lastToast !== null) toast.dismiss(lastToast);
  lastToast = null;
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  const store = useFormStore.getState();
  if (doc) for (const source of documentSources(doc)) store.ensureSource(source);
  setTyping(true);
  installOutsidePress();
  publish();
  return session;
}

function rectOf(here: ActiveField, field: FormField) {
  return widgetsOf(field)[here.widget]?.rect;
}

/** Zooms the reader so `field` reads at 16 px at least, and brings it in. */
function reveal(here: ActiveField, field: FormField, current: Session): void {
  const rect = rectOf(here, field);
  const editors = editorsNow();
  if (!rect) return;
  const zoom = useCompactStore.getState().zoom;
  let target = zoom;
  if (takesKeyboard(field) && editors) {
    const pt = editors.fitFontSize(rect.height, 1, field.multiline === true);
    target = fieldZoom({
      zoom,
      fontPx: pt * pageScale,
      widthPx: rect.width * pageScale,
      viewWidth: window.innerWidth,
    });
  }
  if (target > zoom + 1e-3 && current.zoomBefore === null) current.zoomBefore = zoom;
  requestZoom({ pageId: here.pageId, rect, zoom: target, place: 'band' });
}

const plain = (stop: ActiveField): ActiveField => ({
  ...(stop.source === undefined ? {} : { source: stop.source }),
  ...(stop.fieldId === undefined ? {} : { fieldId: stop.fieldId }),
  name: stop.name,
  widget: stop.widget,
  pageId: stop.pageId,
});

/** The open editor's control, if it is in the document. */
const openEditor = () => document.querySelector<HTMLElement>('[data-form-editor]');

/**
 * Opens `here` in the flow, inside the press that asked (a tap on it, or ‹ ›): its editor
 * takes the focus now (the keyboard stays up), or a check box waits with the keyboard down.
 */
function open(here: ActiveField, field: FormField, at: { x: number; y: number }): void {
  const current = begin(here);
  current.last = here;
  const target = plain(here);
  if (takesKeyboard(field)) {
    const editors = editorsNow();
    if (!editors) {
      holdKeyboard(at, () => session !== null);
      void loadEditors();
    }
    flushSync(() => useFormStore.getState().setActive(target));
    const editor = openEditor();
    if (editor && document.activeElement !== editor) editor.focus({ preventScroll: true });
    else if (!editor && editors) holdKeyboard(at, () => session !== null && openEditor() === null);
  } else {
    releaseKeyboard();
    flushSync(() => useFormStore.getState().setActive(target));
    const box = document.querySelector<HTMLElement>(
      `[data-fill-target][data-page-id="${here.pageId}"][data-field-name="${CSS.escape(here.name)}"]`,
    );
    // The ring marks the stop; a programmatic focus draws no second, focus-visible ring.
    if (box) box.focus({ preventScroll: true, focusVisible: false });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  reveal(here, field, current);
}

/**
 * A press on a field's target (`FieldLayer`): ticks a check box or radio, opens a text or
 * choice field in the flow, opens Sign for a signature field. `at` is the press, client px.
 */
export function pressField(
  here: ActiveField,
  field: FormField,
  exportValue: string | undefined,
  at: { x: number; y: number },
  tick: (value: FormField['value']) => Promise<void>,
): void {
  if (field.kind === 'signature') {
    openSign();
    return;
  }
  if (field.kind === 'button' || field.kind === 'unknown') return;
  if (!mayFill(field)) return;
  if (takesKeyboard(field)) {
    editorsNow()?.commitOpenFieldEditor();
    open(here, field, at);
    return;
  }
  const next = toggleValue(field, exportValue);
  // Within the flow the box becomes its stop, with the keyboard down; else the tap is all.
  if (session) {
    editorsNow()?.commitOpenFieldEditor();
    standOn(here);
  }
  if (next === undefined) return;
  const base = historyLength();
  // Ticking on draws the tick until the page shows it; ticking off needs none.
  if (next.value === false) void commitFieldValue(here, false);
  else void tick(next.value);
  if (!session) offerUndo(base);
}

/** Makes a check box or radio the flow's stop without moving the pages. */
function standOn(here: ActiveField): void {
  if (session) session.last = here;
  releaseKeyboard();
  const editor = openEditor();
  flushSync(() => useFormStore.getState().setActive(plain(here)));
  if (editor === document.activeElement) editor?.blur();
}

/** ‹ (-1) or › (1) on the fill bar, or Tab in an editor: the neighbouring field. */
export function moveFill(direction: 1 | -1): void {
  const active = useFormStore.getState().active;
  if (!active) return;
  editorsNow()?.commitOpenFieldEditor();
  const next = stepStop(fillStops(), active, direction);
  if (!next) return;
  open(next, next.field, centreOnScreen(next));
}

/** Where a stop's widget is on screen, if its page is mounted; else the screen's middle. */
function centreOnScreen(stop: ActiveField): { x: number; y: number } {
  const el = document.querySelector(
    `[data-fill-target][data-page-id="${stop.pageId}"][data-field-name="${CSS.escape(stop.name)}"]`,
  );
  const r = el?.getBoundingClientRect();
  return r
    ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

/** Done: commits the open editor and ends the flow. */
export function doneFill(): void {
  editorsNow()?.commitOpenFieldEditor();
  const editor = openEditor();
  flushSync(() => useFormStore.getState().setActive(null));
  if (editor === document.activeElement) editor?.blur();
  end();
}

/** Ends the flow: the bar goes, the zoom returns, and while reading the Undo toast offers. */
function end(): void {
  const current = session;
  if (!current) return;
  session = null;
  removeOutsidePress();
  // A check box the bar stood on lets the focus go.
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused.closest('[data-fill-target]')) focused.blur();
  releaseKeyboard();
  setTyping(false);
  const active = useFormStore.getState().active;
  if (active) useFormStore.getState().setActive(null);
  if (current.zoomBefore !== null) {
    const stop = fillStops().find((s) => s.name === current.last.name);
    const rect = stop ? rectOf(current.last, stop.field) : undefined;
    if (rect) {
      requestZoom({
        pageId: current.last.pageId,
        rect,
        zoom: current.zoomBefore,
        place: 'stay',
      });
    }
  }
  publish();
  offerUndo(current.base);
}

/** A signature field opens Sign (EDN-14): editing with Sign armed, its drawer open. */
function openSign(): void {
  if (!canChangeActive('targeted')) {
    toast.info(m.compact_fill_locked(), { key: TOAST_KEY });
    return;
  }
  // The editing chunk is not needed to fill: it loads now, as signing needs it (EDN-21).
  void loadMark()
    .then((mark) => {
      // The reader may have left the document while the chunk loaded: then nothing opens.
      if (!canChangeActive('targeted')) return;
      if (!useCompactStore.getState().editing) mark.enterEditing();
      if (!useCompactStore.getState().editing) return;
      mark.armTool('sign');
      setDrawerOpen(true);
    })
    .catch(() => undefined);
}

// The editor closing by itself (Enter, Esc, a tap away, the keyboard dismissed) ends the flow,
// unless the same task opened another field (a tap on the next one).
useFormStore.subscribe((state, previous) => {
  if (state.active === previous.active) return;
  if (state.active !== null) {
    if (session) session.last = state.active;
    return;
  }
  if (!session) return;
  window.setTimeout(() => {
    if (session && useFormStore.getState().active === null) end();
  });
});

// Leaving the reader or the document ends the flow.
useCompactStore.subscribe((state, previous) => {
  if (state.place !== previous.place && state.place !== 'reader') end();
});
useWorkspaceStore.subscribe((state, previous) => {
  if (state.workspace.activeDocument !== previous.workspace.activeDocument) end();
});

/** A tap this far from its press is a pan, CSS px. */
const TAP_SLOP = 10;
let pressStart: { x: number; y: number } | null = null;

/**
 * A tap away from the fields and the bar ends the flow (the editor's blur does too, where the
 * browser blurs it; iOS may not for a tap on plain content). A pan does not.
 */
const onOutsideDown = (event: PointerEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  pressStart =
    target?.closest('[data-fill-keep], [data-fill-target], [data-form-editor]') == null &&
    event.isPrimary
      ? { x: event.clientX, y: event.clientY }
      : null;
};
const onOutsideUp = (event: PointerEvent) => {
  const start = pressStart;
  pressStart = null;
  if (!start || !session) return;
  if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP) return;
  doneFill();
};

function installOutsidePress(): void {
  window.addEventListener('pointerdown', onOutsideDown, { capture: true });
  window.addEventListener('pointerup', onOutsideUp, { capture: true });
}

function removeOutsidePress(): void {
  pressStart = null;
  window.removeEventListener('pointerdown', onOutsideDown, { capture: true });
  window.removeEventListener('pointerup', onOutsideUp, { capture: true });
}
