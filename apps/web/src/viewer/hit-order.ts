/**
 * The hit router (05-canvas §6; ADR-0019 §6 kept, ADR-0029; flows §2.5, §3.1): one answer to
 * "what does this press mean". One order, annotation → form widget → link → image → text run →
 * text selection, and one matrix of what each kind of target does in each input state.
 *
 * Every page layer's root is `pointer-events: none`; only its targets are live, and only in the
 * states whose matrix row gives the kind a meaning (`liveHitKinds`). What a point on the page
 * means is resolved here, not by which layer happens to cover the page: `hitAt` takes the
 * elements under the point (`document.elementsFromPoint`) and returns the target that comes
 * first in the order, whatever their stacking. The double-click door to the paragraph editor
 * and the idle hover outline use it, so a double-click on a text box edits the text box, a
 * double-click on a link's words never opens the editor, and an outline never shows over an
 * annotation.
 *
 * The state (`inputStateOf`) replaces M8's Read and Edit: viewing (Markup closed), Markup with
 * the armed tool, and Locked, which wins over both. Whether a press may change the document is
 * the change guard's answer (`state/guard.ts`, `canChange(id, act)`); the router decides only
 * what the press is aimed at. The pointer rules live here too, as pure functions: which
 * pointers may open the paragraph editor by double-click (the double-click asymmetry, flows
 * §3.2), when an idle hover may show its outline, what a pen's eraser end and barrel button do,
 * when a press on a link becomes a text selection, which pointers draw (a drawing pointer never
 * long-presses, spec 04.11) and when the first pen in viewing gets its hint (flows §3.4).
 */
import { TEXT_LAYER_ATTR } from './text-model';
import type { ToolMode } from './tool-store';

/** The kinds of page target, first to last (05-canvas §6; links after form widgets, 05.7). */
export const HIT_ORDER = [
  'annotation',
  'form-widget',
  'link',
  'image',
  'text-run',
  'text-selection',
] as const;
export type HitKind = (typeof HIT_ORDER)[number];

/** How each kind's targets are marked in the page overlays. */
export const HIT_SELECTORS: Readonly<Record<HitKind, string>> = {
  annotation: '[data-annotation-id]',
  'form-widget': '[data-field-name], [data-created-design]',
  link: '[data-link]',
  image: '[data-image-object], [data-testid="image-selection"]',
  'text-run': '[data-text-run]',
  'text-selection': `[${TEXT_LAYER_ATTR}] > span`,
};

/**
 * Stacking of the layer roots that follow the order (CSS `z-index` inside a page's
 * overlays). The text layer stays in flow (auto). The edit text layer sits above the
 * annotation layer's targets so its editor is never covered; the order between them is
 * kept by `liveHitKinds`, which never makes both live at once.
 */
export const HIT_LAYER_Z = {
  image: 2,
  textRun: 2,
} as const;

/** The kind of target `element` belongs to, if any. */
export function hitKindOf(element: Element | null | undefined): HitKind | undefined {
  if (!element) return undefined;
  for (const kind of HIT_ORDER) if (element.closest(HIT_SELECTORS[kind])) return kind;
  return undefined;
}

export interface Hit {
  readonly kind: HitKind;
  readonly element: Element;
}

/**
 * The target that wins among `elements` (top-most first, as `elementsFromPoint` lists
 * them): the earliest kind in the order; within a kind, the top-most element.
 */
export function topHit(elements: Iterable<Element>): Hit | undefined {
  let best: Hit | undefined;
  let rank: number = HIT_ORDER.length;
  for (const element of elements) {
    const kind = hitKindOf(element);
    if (kind === undefined) continue;
    const r = HIT_ORDER.indexOf(kind);
    if (r < rank) {
      best = { kind, element };
      rank = r;
    }
  }
  return best;
}

/** The target that wins at a viewport point (live targets only: roots let the pointer through). */
export function hitAt(x: number, y: number, root: Document = document): Hit | undefined {
  return topHit(root.elementsFromPoint(x, y));
}

// ---------------------------------------------------------------------------
// Input states and the live-kind matrix
// ---------------------------------------------------------------------------

/**
 * The nine input states of the page (05-canvas §6's rows). `markup-select-pen` is a pen's
 * press in Markup with Select once "Pen draws in Markup" is on (a pen has been seen, MK-18): the
 * pen writes with the last pen, so no target takes it; a mouse at the same moment is in
 * `markup-select`.
 */
export type InputState =
  | 'viewing'
  | 'markup-select'
  | 'markup-select-pen'
  | 'markup-draw'
  | 'markup-place'
  | 'markup-image'
  | 'markup-edit-text'
  | 'markup-redact'
  | 'locked';

export const INPUT_STATES: readonly InputState[] = [
  'viewing',
  'markup-select',
  'markup-select-pen',
  'markup-draw',
  'markup-place',
  'markup-image',
  'markup-edit-text',
  'markup-redact',
  'locked',
];

/** What the router knows about the moment of a press. */
export interface InputFacts {
  /** Markup is open for the document (`docUi[id].markup`). */
  readonly markup: boolean;
  /** The armed tool (Select outside Markup: the tool store arms no other there). */
  readonly tool: ToolMode;
  /** The document may not change: locked, or no known document (fails closed). */
  readonly locked: boolean;
  /** The press is a pen's and the pen draws with Select ("Pen draws in Markup" on). */
  readonly penDraws?: boolean;
}

/** The tools that place one object at a click (T, N, the image stamp, G). */
const PLACING_TOOLS: ReadonlySet<ToolMode> = new Set<ToolMode>([
  'text-box',
  'note',
  'stamp',
  'signature',
]);

/** The input state of `facts`: Locked wins, then viewing, then the armed tool's row. */
export function inputStateOf(facts: InputFacts): InputState {
  if (facts.locked) return 'locked';
  if (!facts.markup) return 'viewing';
  switch (facts.tool) {
    case 'select':
      return facts.penDraws === true ? 'markup-select-pen' : 'markup-select';
    case 'image':
      return 'markup-image';
    case 'edit-text':
      return 'markup-edit-text';
    case 'redact':
      return 'markup-redact';
    default:
      return PLACING_TOOLS.has(facts.tool) ? 'markup-place' : 'markup-draw';
  }
}

/**
 * What a press on a kind of target means (05-canvas §6, "Live kinds per state"):
 *
 * - `select`: an annotation selects on press and shows its bar; a drag moves it only when it
 *   was selected before the press (S14).
 * - `comment`: a locked annotation opens its comment, read-only (changes nothing).
 * - `fill`: a form widget takes the focus and fills (`targeted`).
 * - `focus`: a locked form widget takes the focus and shows the Lock notice; nothing fills.
 * - `follow`: a link is followed (an internal one scrolls, a URI one asks first); a drag past
 *   the slop becomes a text selection instead (`linkDragSelects`).
 * - `menu`: an image is reached only through the page menu (right-click, long press).
 * - `transform`: with the Image tool an image selects, moves and resizes.
 * - `door`: in Markup with Select a double-click on page text opens the paragraph editor and an
 *   idle hover outlines the paragraph; the press itself goes to the text selection's spans.
 * - `edit`: with the Edit text tool a click on a run opens it.
 * - `select-text`: a drag selects text; a double-click selects a word.
 */
export type HitMeaning =
  | 'select'
  | 'comment'
  | 'fill'
  | 'focus'
  | 'follow'
  | 'menu'
  | 'transform'
  | 'door'
  | 'edit'
  | 'select-text';

type MatrixRow = Readonly<Record<HitKind, HitMeaning | null>>;

const NO_TARGET: MatrixRow = {
  annotation: null,
  'form-widget': null,
  link: null,
  image: null,
  'text-run': null,
  'text-selection': null,
};

/** The matrix, 9 states × 6 kinds (05-canvas §6). Null: the kind takes no press. */
export const HIT_MATRIX: Readonly<Record<InputState, MatrixRow>> = {
  viewing: {
    annotation: 'select',
    'form-widget': 'fill',
    link: 'follow',
    image: 'menu',
    'text-run': null,
    'text-selection': 'select-text',
  },
  'markup-select': {
    annotation: 'select',
    'form-widget': 'fill',
    link: 'follow',
    image: 'menu',
    'text-run': 'door',
    'text-selection': 'select-text',
  },
  // The pen writes with the last pen; ink never hit-tests (MK-18, S4).
  'markup-select-pen': NO_TARGET,
  // A drawing or placing tool captures the page itself; fields and links give way (the tool
  // wins, flows §3.1).
  'markup-draw': NO_TARGET,
  'markup-place': NO_TARGET,
  'markup-image': { ...NO_TARGET, image: 'transform' },
  'markup-edit-text': { ...NO_TARGET, 'text-run': 'edit' },
  // The redaction layer captures text or an area.
  'markup-redact': NO_TARGET,
  locked: {
    annotation: 'comment',
    'form-widget': 'focus',
    link: 'follow',
    image: 'menu',
    'text-run': null,
    'text-selection': 'select-text',
  },
};

/**
 * Meanings carried by the kind's own targets. A `door` goes through the text selection's
 * spans (the text layer's double-click) and a `menu` through the page menu, so neither makes
 * its kind's targets live.
 */
const TARGET_MEANINGS: ReadonlySet<HitMeaning> = new Set<HitMeaning>([
  'select',
  'comment',
  'fill',
  'focus',
  'follow',
  'transform',
  'edit',
  'select-text',
]);

/** The kinds whose meaning in `state` is carried by their own targets. */
function liveKindsOf(state: InputState): ReadonlySet<HitKind> {
  return new Set(
    HIT_ORDER.filter((kind) => {
      const meaning = HIT_MATRIX[state][kind];
      return meaning !== null && TARGET_MEANINGS.has(meaning);
    }),
  );
}

const LIVE: Readonly<Record<InputState, ReadonlySet<HitKind>>> = {
  viewing: liveKindsOf('viewing'),
  'markup-select': liveKindsOf('markup-select'),
  'markup-select-pen': liveKindsOf('markup-select-pen'),
  'markup-draw': liveKindsOf('markup-draw'),
  'markup-place': liveKindsOf('markup-place'),
  'markup-image': liveKindsOf('markup-image'),
  'markup-edit-text': liveKindsOf('markup-edit-text'),
  'markup-redact': liveKindsOf('markup-redact'),
  locked: liveKindsOf('locked'),
};

/** What a press on `kind` means in `state`, or null when the kind takes no press. */
export function hitMeaning(kind: HitKind, state: InputState): HitMeaning | null {
  return HIT_MATRIX[state][kind];
}

/** The kinds whose targets take the pointer in `state` (05-canvas §6). */
export function liveHitKinds(state: InputState): ReadonlySet<HitKind> {
  return LIVE[state];
}

/** Whether targets of `kind` take the pointer in `state`. */
export function isLive(kind: HitKind, state: InputState): boolean {
  return LIVE[state].has(kind);
}

// ---------------------------------------------------------------------------
// Pointer rules
// ---------------------------------------------------------------------------

/** Idle hover before the paragraph outline shows (ms). */
export const HOVER_DELAY_MS = 400;
/** No hover outline this long after a pen left the surface (ms; 05-canvas §9). */
export const HOVER_AFTER_PEN_MS = 500;

/**
 * Whether the idle hover outline and its hint may show in `state` (05-canvas §9, flows §3.4):
 * only where a double-click edits, Markup with Select. Never in viewing (nothing reacts to
 * hover on text there), never locked, never with another tool.
 */
export function hoverOutlines(state: InputState): boolean {
  return state === 'markup-select';
}

/**
 * Whether a double-click from `pointerType` may open the text editor: a mouse, or a pen
 * used as a pointer; never touch, never a pen while "Pen draws in Markup" is on (spec 05.12:
 * a pen acts as a mouse only while no pen has been seen). An unknown type (synthetic events,
 * old browsers) counts as a mouse.
 */
export function opensTextOnDoubleClick(pointerType: string, penDraws: boolean): boolean {
  if (pointerType === 'touch') return false;
  if (pointerType === 'pen') return !penDraws;
  return true;
}

/**
 * The double-click asymmetry (flows §3.2, spec 05.12): a double-click on page text opens the
 * paragraph editor only in Markup with Select, from a pointer that may (`opensTextOnDoubleClick`);
 * everywhere else, Locked included, it selects a word as on any page.
 */
export function doubleClickOpensEditor(
  state: InputState,
  pointerType: string,
  penDraws: boolean,
): boolean {
  return state === 'markup-select' && opensTextOnDoubleClick(pointerType, penDraws);
}

export interface HoverFacts {
  readonly pointerType: string;
  readonly buttons: number;
}

/**
 * Whether a move may start (or keep) the idle hover outline: a mouse or a hovering pen
 * with no button down, not within `HOVER_AFTER_PEN_MS` of a pen stroke; never touch.
 */
export function hoverAllowed(facts: HoverFacts, now: number, lastPenUpAt: number): boolean {
  if (facts.pointerType !== 'mouse' && facts.pointerType !== 'pen') return false;
  if (facts.buttons !== 0) return false;
  return now - lastPenUpAt >= HOVER_AFTER_PEN_MS;
}

/** What a pen press means beyond its tip: the eraser end and the barrel button. */
export type PenButton = 'tip' | 'eraser' | 'barrel';

export interface PenPressFacts {
  readonly pointerType: string;
  readonly button: number;
  readonly buttons: number;
}

/**
 * The pen part of a press (Pointer Events: the eraser reports `buttons & 32`, button 5;
 * the barrel `buttons & 2`, button 2). Undefined for anything but a pen. In Markup the eraser
 * end is a temporary Eraser and the barrel a temporary Lasso; in viewing and locked both do
 * nothing (flows §3.1).
 */
export function penButtonOf(press: PenPressFacts): PenButton | undefined {
  if (press.pointerType !== 'pen') return undefined;
  if ((press.buttons & 32) !== 0 || press.button === 5) return 'eraser';
  if ((press.buttons & 2) !== 0 || press.button === 2) return 'barrel';
  return 'tip';
}

/**
 * Travel (CSS px) after which a press that started on a link becomes a text selection and the
 * link is not followed (05-canvas §6, spec 05.7): 4 for a mouse, 3 for a pen, 10 for touch.
 */
export const LINK_SLOP_PX: Readonly<Record<'mouse' | 'pen' | 'touch', number>> = {
  mouse: 4,
  pen: 3,
  touch: 10,
};

/** Whether a press on a link that travelled (dx, dy) selects text instead of following. */
export function linkDragSelects(pointerType: string, dx: number, dy: number): boolean {
  const slop =
    pointerType === 'pen' || pointerType === 'touch'
      ? LINK_SLOP_PX[pointerType]
      : LINK_SLOP_PX.mouse;
  return Math.hypot(dx, dy) >= slop;
}

/**
 * Whether a press from `pointerType` draws (or places) in `state`, so it never long-presses
 * (spec 04.11) and never selects: the pen in Markup with Select once it draws, and every
 * pointer with a drawing, placing or Redact tool armed, a finger only while it draws (`Draw
 * with finger`, before a pen was seen). Right-click and Shift+F10 still open the page menu.
 */
export function pointerDraws(
  state: InputState,
  pointerType: string,
  fingerDraws: boolean,
): boolean {
  switch (state) {
    case 'markup-select-pen':
      return pointerType === 'pen';
    case 'markup-draw':
    case 'markup-place':
    case 'markup-redact':
      return pointerType === 'touch' ? fingerDraws : true;
    default:
      return false;
  }
}

export interface PenHintFacts {
  readonly pointerType: string;
  /** `navigator.maxTouchPoints`: 0 on a desktop drawing tablet (M-24). */
  readonly maxTouchPoints: number;
  readonly state: InputState;
  /** "Pen writes without Markup" (flows §3.4): with it on the pen writes, so nothing to say. */
  readonly penWritesWithoutMarkup: boolean;
  /** The hint has been shown on this device. */
  readonly shown: boolean;
}

/**
 * Whether a press on a page shows the first-pen hint (flows §3.4, MK-16): the first pen touch
 * in viewing on a device with a touch screen (`maxTouchPoints > 0`; a desktop drawing tablet
 * never sees it), once per device, never when locked, and not while the pen writes without
 * Markup. The pen still selects text as a mouse.
 */
export function showsPenHint(facts: PenHintFacts): boolean {
  return (
    facts.pointerType === 'pen' &&
    facts.maxTouchPoints > 0 &&
    facts.state === 'viewing' &&
    !facts.penWritesWithoutMarkup &&
    !facts.shown
  );
}

// ---------------------------------------------------------------------------
// Pointer log
// ---------------------------------------------------------------------------

/** What the page knows about recent pointers (session only). */
export interface PointerLog {
  /** Type of the last press anywhere (`dblclick` events do not carry one). */
  lastDownType: string;
  /** When a pen last left the surface (`performance.now()` clock). */
  lastPenUpAt: number;
}

export function createPointerLog(): PointerLog {
  return { lastDownType: '', lastPenUpAt: Number.NEGATIVE_INFINITY };
}

/**
 * Keeps `log` current from `target`'s pointer events (capture phase, so no layer can hide
 * them); `onPen` runs for every pen event (hover included). Returns the disposer.
 */
export function watchPointers(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  log: PointerLog,
  onPen: () => void,
  now: () => number = () => performance.now(),
): () => void {
  const onDown = (event: PointerEvent) => {
    log.lastDownType = event.pointerType;
    if (event.pointerType === 'pen') onPen();
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerType !== 'pen') return;
    log.lastPenUpAt = now();
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'pen') onPen();
  };
  const options = { capture: true, passive: true } as const;
  target.addEventListener('pointerdown', onDown, options);
  target.addEventListener('pointerup', onUp, options);
  target.addEventListener('pointercancel', onUp, options);
  target.addEventListener('pointermove', onMove, options);
  return () => {
    target.removeEventListener('pointerdown', onDown, options);
    target.removeEventListener('pointerup', onUp, options);
    target.removeEventListener('pointercancel', onUp, options);
    target.removeEventListener('pointermove', onMove, options);
  };
}
