/**
 * The paragraph editor (craft spec §4.2, §4.5–§4.10; ADR-0020 §7; research 11 §6): a
 * detected paragraph edited in place, laid out on the main thread at every keystroke and
 * drawn from the PDF font's own glyph outlines, so it looks like the page while you type.
 *
 * - **Canvas** (`glyph-canvas.ts`): on the device pixel grid over the paragraph, the
 *   rewritten and moved lines from glyph paths on their real baselines, over a plate: page
 *   white with the page under the paragraph painted in (one dry run at open that empties the
 *   paragraph, rendered), so coloured boxes and what lies below do not flash white; lines
 *   before the edit are the page itself. Caret, selection, composition underline and the
 *   overlap warning are drawn there too.
 * - **Mirror**: a hidden `contenteditable` (`role="textbox"`, multi-line, "Paragraph on
 *   page N") holds the paragraph's text and the focus. It takes keys, IME composition,
 *   clipboard and assistive technology; `beforeinput` becomes model operations
 *   (`paragraph-model.ts`) on the range the browser names (`getTargetRanges`), so the DOM
 *   never edits itself outside a composition. It lies over the canvas with its text in the
 *   drawn lines (`mirror-dom.ts`), so a point the browser resolves (iOS's keyboard trackpad)
 *   lands on its text; any DOM position in it reads as a text offset, and its DOM selection
 *   is set from the model's after every change (EDN-17). A composition replaces the range its
 *   first input names; DOM edits that land outside one are put back; copy and cut give the
 *   model's text, not the mirror's line blocks.
 * - **Per keystroke**: `layoutParagraph` and `decideOverflow` (pure, from the engine chunk)
 *   on the advances asked for once at open (`analyzeParagraphLayout`), then a redraw. No
 *   worker round trip. The draft is one replacement with a style per character: separate
 *   changes never restyle the text between them.
 * - **After a 300 ms pause**: one dry run, rendered (`renderParagraphPreview`, which runs
 *   the dry run and returns its result with the bitmap), replaces the drawn glyphs with
 *   exactly what will be saved, on the device pixels it was rendered for; typing again
 *   returns to the canvas.
 * - **Leaving** (Esc, a press outside, the focus leaving) commits a change as one history
 *   entry (decision §13 #9); with no change nothing happens. Text that would leave the page
 *   is never written: the editor keeps it and asks to shorten it. Text that runs into the
 *   content below is never written silently: the header offers "Tighten to fit" (the whole
 *   paragraph, when that fits), "Let it overlap" and "Keep editing" (the default).
 * - **Unmounting** (the page scrolled away, the Read lock, another paragraph opened) never
 *   loses text silently: an undecided overlap is kept for the session's return (or
 *   discarded with an announcement when the session is gone); any other draft is committed,
 *   and a failure keeps the text and says so.
 * - **Header** (05-canvas §17.3): beside the paragraph, else in the empty space above or below
 *   it, else docked above the capsule (`header-place.ts`), never over the paragraph; M4's
 *   solid twin, so nothing on the page shows through it. It holds the hint, the honesty line
 *   (spec §4.5), the overflow line (§4.6) and an info popover with the §4.10 text. No font, size or colour controls; "Join with
 *   next" and "Split here" stay hidden until detection takes hints.
 */
import { Popover } from '@base-ui/react/popover';
import type { Rect } from '@pdf-editor/document-model';
import type {
  LayoutEdit,
  LayoutEditSpan,
  ParagraphBlock,
  ParagraphEditRefusal,
  ParagraphFrameChange,
  ParagraphLayout,
  ParagraphLayoutAnalysis,
  ParagraphStyleInfo,
} from '@pdf-editor/engine';
import { BUNDLED_FACES, faceFamilyName } from '@pdf-editor/engine/fonts';
import {
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cssPointToUser, rectToCss } from '../annotations/geometry';
import { getEngineService } from '../engine/engine-service';
import { cssFamilyOf, ensureFace } from '../furniture/furniture-fonts';
import { formatPercent, getLocale, m } from '../i18n';
import { announce } from '../shell/announcer';
import type { PageOverlayProps } from '../stage/page-overlays';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { PopoverBody, PopoverHeader, PopoverPopup } from '../ui/Popover';
import type { PageFrame } from '../viewer/geometry';
import { useCanChangeActive } from '../viewer/input-state';
import { pageFrame } from '../viewer/page-frame';
import { useToolStore } from '../viewer/tool-store';
import { commitParagraphEdit, paragraphFrameRefusalLabel, type ParagraphCommit } from './actions';
import {
  BAND_PX,
  cssDelta,
  type FrameDraft,
  frameChanged,
  frameChangeOf,
  framedRect,
  initialFrame,
  moveBy,
  pastSlop,
  rectOverlapsMoved,
  snapAnchors,
  textDelta,
  widthBy,
} from './frame-drag';
import {
  apply,
  buildScene,
  compose,
  cssFromUser,
  drawScene,
  drawStylesOf,
  type GlyphCache,
  invert,
  scale,
  type Scene,
  sceneBounds,
  type TextRect,
  translate,
  userFromText,
} from './glyph-canvas';
import { blockerLabel, failureMessage } from './model';
import { paragraphFrameEnabled } from './paragraph-frame-flag';
import {
  caretLines,
  deleteBackward,
  deleteForward,
  drawnWhole,
  initialState,
  insertText,
  type LayoutFunctions,
  moveHorizontal,
  moveLineEdge,
  moveTo,
  moveVertical,
  offsetAtPoint,
  type ParagraphSetup,
  originalStylesOf,
  type ParagraphState,
  paragraphEdit,
  relayout,
  replaceRange,
  selectAll,
  selectionOf,
  type TextRange,
  wordRange,
} from './paragraph-model';
import { holdOverCommit, openFrame } from './edit-motion';
import { mirrorLines, mirrorOffset, mirrorPosition, syncMirrorLines } from './mirror-dom';
import styles from './ParagraphEditor.module.css';
import { usePageRevision } from './runs';
import {
  glyphCacheFor,
  type ParagraphSession,
  pageParagraphs,
  paragraphLayoutAnalysis,
  useTextEditStore,
} from './text-edit-store';
import { gripEdge, type HeaderPlace, placeHeader } from './header-place';

/**
 * What an edition changes in the editor (the phone, `shell/compact/mark/edit-text-layer.tsx`):
 *
 * - `minMirrorPx`: the least font size of the hidden mirror, CSS px (0: none). iOS zooms the page
 *   when an editable under 16 px takes focus (research/phone-2026-10/ux-references.md §5 row
 *   6), as for the text box's field (`InlineEditors` `setMinFieldFontPx`). The mirror is
 *   invisible and its selection is set by offset, so its size changes nothing on screen.
 * - `hint`: the header's hint; a phone has no Esc and applies with its Done.
 */
export interface ParagraphEditorEdition {
  readonly minMirrorPx: number;
  readonly hint: () => string;
}

const DESKTOP_EDITION: ParagraphEditorEdition = { minMirrorPx: 0, hint: () => m.paragraph_hint() };
let edition = DESKTOP_EDITION;

/** Sets what the edition changes (unset fields keep the desktop's); returns the previous. */
export function setParagraphEditorEdition(
  next: Partial<ParagraphEditorEdition>,
): ParagraphEditorEdition {
  const previous = edition;
  edition = { ...DESKTOP_EDITION, ...next };
  return previous;
}

/** Pause after the last keystroke before the dry run and its preview (spec §4.7, §4.8). */
export const PREVIEW_DELAY_MS = 300;

/** The paragraph's area rendered without its text (the plate) at a device scale. */
interface PlateImage {
  readonly bitmap: ImageBitmap;
  readonly clip: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly scale: number;
}

/** What a draft sends to the engine: its text, replaced range and style spans. */
function draftPayload(draft: { readonly text: string; readonly edit: LayoutEdit }): {
  text: string;
  caretSpan: { start: number; end: number };
  style?: string;
  spans?: readonly LayoutEditSpan[];
} {
  const { edit } = draft;
  return {
    text: draft.text,
    caretSpan: { start: edit.start, end: edit.end },
    ...(edit.style === undefined ? {} : { style: edit.style }),
    ...(edit.spans === undefined ? {} : { spans: edit.spans }),
  };
}
/** A frame drag under way (TXT-24): where the press began and the frame it began from. */
interface FrameDrag {
  readonly kind: 'move' | 'left' | 'right';
  readonly pointerId: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  readonly base: FrameDraft;
  started: boolean;
}

/** The grip's and the side bars' touch targets, CSS px (quality bar Q-9). */
const GRIP_PX = 44;
/** The grip's drawn notch (`.grip::after`, --space-6 wide) and how far it stands out. */
const GRIP_NOTCH = { width: 24, reach: 12 };
const TARGET_PX = 44;

/** Room kept around the drawn area on the canvas, CSS pixels. */
const CANVAS_PAD = 4;
/** Characters whose outlines are asked for at open besides the paragraph's own. */
const COMMON_CHARS = (() => {
  let out = '';
  for (let c = 0x21; c < 0x7f; c++) out += String.fromCharCode(c);
  return `${out}çğıöşüÇĞİÖŞÜâêîôûàèéùäëïáíóúñß’‘“”–—…`;
})();

// ---------------------------------------------------------------------------
// Page overlay
// ---------------------------------------------------------------------------

/** Shows the open paragraph's editor on its page (the page overlay `ParagraphEditSlot` loads). */
export function ParagraphEditLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageId, visible } = props;
  // A paragraph commit is a `text` act (ADR-0030): refused only while the document is locked.
  const editable = useCanChangeActive('text');
  const session = useTextEditStore((s) =>
    s.paragraph?.target.pageId === pageId ? s.paragraph : null,
  );
  const revision = usePageRevision(sourceId, sourceIndex);
  const armed = useToolStore((s) => s.mode === 'edit-text') && editable;

  // Detect the page's paragraphs ahead of a click while Edit text is armed.
  useEffect(() => {
    if (!armed || !visible || sourceId === undefined) return;
    pageParagraphs(sourceId, sourceIndex).catch(() => undefined);
  }, [armed, visible, sourceId, sourceIndex, revision]);

  // An editor open when the document is locked closes (it commits).
  useEffect(() => {
    if (session && !editable) useTextEditStore.getState().closeParagraph();
  }, [session, editable]);

  if (!session || !editable || sourceId === undefined) return null;
  return (
    <div className={styles.layer} data-paragraph-layer={props.pageIndex}>
      {/* One editor per session: a commit in flight never closes the next paragraph's editor. */}
      <ParagraphEditor
        key={sessionKey(session)}
        session={session}
        frame={pageFrame(props)}
        revision={revision}
      />
    </div>
  );
}

const sessionKeys = new WeakMap<ParagraphSession, number>();
let nextSessionKey = 0;

/** A key per paragraph session (sessions are compared by identity). */
function sessionKey(session: ParagraphSession): number {
  let key = sessionKeys.get(session);
  if (key === undefined) {
    nextSessionKey += 1;
    key = nextSessionKey;
    sessionKeys.set(session, key);
  }
  return key;
}

/** The open session is still `session` (not closed, not replaced by another paragraph). */
function isCurrent(session: ParagraphSession): boolean {
  return useTextEditStore.getState().paragraph === session;
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

interface Loaded {
  readonly session: ParagraphSession;
  readonly setup: ParagraphSetup;
  readonly analysis: ParagraphLayoutAnalysis;
  readonly fns: LayoutFunctions;
}

type LoadState =
  | { readonly session: ParagraphSession; readonly value: Loaded }
  | { readonly session: ParagraphSession; readonly error: string };

/** What the user reads for a refused paragraph. */
export function paragraphRefusalLabel(reason: ParagraphEditRefusal): string {
  switch (reason) {
    case 'drop-cap':
      return m.paragraph_reason_drop_cap();
    case 'in-form':
      return m.text_edit_refusal_in_form();
    case 'clipped':
      return m.text_edit_reason_clipped();
    case 'shared-object':
      return m.paragraph_reason_shared_object();
    case 'shared-form':
      return m.text_edit_reason_shared_form();
    case 'unreadable-encoding':
      return m.text_edit_reason_unreadable_encoding();
    case 'unsupported-chars':
      return m.text_edit_error_unsupported_chars();
    case 'off-page':
      return m.paragraph_off_page();
    default:
      return blockerLabel(reason);
  }
}

/** "‘ğ’ and ‘ş’" in the interface language. */
function quotedList(chars: readonly string[]): string {
  const quoted = chars.map((c) => `‘${c}’`);
  try {
    return new Intl.ListFormat(getLocale(), { type: 'conjunction' }).format(quoted);
  } catch {
    return quoted.join(', ');
  }
}

/**
 * The CSS `font-family` the canvas draws a style's substituted characters with until the
 * preview settles: the bundled faces in the order the engine tries them (each registered
 * under its private family name once loaded), then the family's name and a generic family.
 * The browser picks per character, as the writer does.
 */
export function substituteCssFamily(info: ParagraphStyleInfo, base: string): string {
  const keys = info.substitute.faces ?? [info.substitute.face];
  const faces = keys.flatMap((key) => BUNDLED_FACES.filter((face) => face.key === key));
  return [...faces.map((face) => `"${cssFamilyOf(face)}"`), base].join(', ');
}

/** The honesty lines (spec §4.5): substituted characters grouped by the face setting them. */
export function honestyLines(
  substitutions: readonly { readonly char: string; readonly family: string }[],
): string[] {
  const byFamily = new Map<string, string[]>();
  for (const { char, family } of substitutions) {
    const list = byFamily.get(family) ?? [];
    if (!list.includes(char)) list.push(char);
    byFamily.set(family, list);
  }
  return [...byFamily].map(([family, chars]) =>
    chars.length === 1
      ? m.paragraph_honesty_one({ char: `‘${chars[0] ?? ''}’`, family })
      : m.paragraph_honesty_many({ chars: quotedList(chars), family }),
  );
}

/**
 * Where the preview bitmap goes: the engine renders it as the page is oriented by its own
 * /Rotate, so only the app's view rotation on top of that is turned here. Given the bitmap
 * and the device pixel ratio it was rendered for, it is placed on the device pixels the
 * engine rendered (the clip's outward-rounded pixels), one bitmap pixel per device pixel, so
 * nothing is resampled or shifted against the page.
 */
export function previewPlacement(
  frame: PageFrame,
  clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  bitmap?: { readonly width: number; readonly height: number },
  dpr = 1,
): { left: number; top: number; width: number; height: number; transform?: string } {
  const box = rectToCss(frame, clip);
  const view = (((frame.rotation - (frame.intrinsicRotation ?? 0)) % 360) + 360) % 360;
  if (view === 0) {
    if (!bitmap) return box;
    return {
      left: snapDown(box.left, dpr),
      top: snapDown(box.top, dpr),
      width: bitmap.width / dpr,
      height: bitmap.height / dpr,
    };
  }
  const quarter = view === 90 || view === 270;
  const width = bitmap ? bitmap.width / dpr : quarter ? box.height : box.width;
  const height = bitmap ? bitmap.height / dpr : quarter ? box.width : box.height;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + (box.height - height) / 2,
    width,
    height,
    transform: `rotate(${view}deg)`,
  };
}

/** A CSS length moved down onto the device pixel grid (as the engine floors the clip). */
function snapDown(css: number, dpr: number): number {
  return Math.floor(css * dpr + 1e-6) / dpr;
}

/** A CSS length moved up onto the device pixel grid. */
function snapUp(css: number, dpr: number): number {
  return Math.ceil(css * dpr - 1e-6) / dpr;
}

function readVar(element: Element | null, name: string, fallback: string): string {
  if (!element) return fallback;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

/**
 * How long after a press on the editor its caret wins over the browser's own, ms: iOS places
 * its native caret at a tap's lift, after the press has placed the model's (EDN-17).
 */
const PRESS_WINS_MS = 500;

/**
 * Presses this close in time (ms) and place (CSS px) count as one double or triple click. The
 * editor counts them itself: `pointerdown`'s `detail` does not carry the click count in
 * Chromium (`e2e/paragraph-mirror.spec.ts`), and the mouse events that do are cancelled with
 * the press.
 */
const MULTI_CLICK_MS = 500;
const MULTI_CLICK_PX = 4;

/** Sets the DOM selection in `mirror` to the model's, unless it is there already. */
function selectInMirror(mirror: HTMLElement, state: ParagraphState): void {
  const selection = window.getSelection();
  if (!selection) return;
  const anchor = mirrorPosition(mirror, state.anchor);
  const focus = mirrorPosition(mirror, state.focus);
  if (
    selection.rangeCount > 0 &&
    selection.anchorNode === anchor.node &&
    selection.anchorOffset === anchor.offset &&
    selection.focusNode === focus.node &&
    selection.focusOffset === focus.offset
  ) {
    return;
  }
  selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
}

/** The text range an input names (`getTargetRanges`, its first), when it lies in `mirror`. */
function targetRangeOf(mirror: HTMLElement, event: InputEvent): TextRange | null {
  const range = event.getTargetRanges?.()[0];
  if (!range) return null;
  const start = mirrorOffset(mirror, range.startContainer, range.startOffset);
  const end = mirrorOffset(mirror, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

export function ParagraphEditor({
  session,
  frame,
  revision,
}: {
  readonly session: ParagraphSession;
  readonly frame: PageFrame;
  readonly revision: number;
}) {
  const { block, target } = session;
  const [loaded, setLoaded] = useState<LoadState | null>(null);
  const current = loaded?.session === session ? loaded : null;
  const value = current && 'value' in current ? current.value : null;
  const [edited, setEdited] = useState<{
    readonly key: Loaded;
    readonly state: ParagraphState;
  } | null>(null);
  const [composition, setComposition] = useState<TextRange | null>(null);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  /** A draft kept from this session's earlier editor (its page scrolled away), once. */
  const [kept] = useState(() => {
    const k = useTextEditStore.getState().paragraphKept;
    return k?.session === session ? k : null;
  });
  // The failure that kept the draft shows again with it.
  const [error, setError] = useState<string | null>(() => kept?.error ?? null);
  const [glyphVersion, setGlyphVersion] = useState(0);
  const [place, setPlace] = useState<HeaderPlace>({ side: 'below', left: 0, top: 0 });
  /**
   * Leaving with an overlap: the choice the header offers (spec craft §4.6), for the draft it
   * was asked about (a changed text asks again).
   */
  const [choiceFor, setChoiceFor] = useState<object | null>(null);
  /** The paragraph area rendered without the paragraph: the plate under rewritten lines. */
  const [plate, setPlate] = useState<PlateImage | null>(null);
  const preview = useTextEditStore((s) => s.paragraphPreview);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  // The frame controls (TXT-24, behind the Labs toggle): what the user did to the frame, and
  // the snap guide while a drag lasts. The ref is the latest value for handlers and the commit.
  const framed = paragraphFrameEnabled();
  const [moveDraft, setMoveDraft] = useState<FrameDraft | null>(null);
  const [guide, setGuide] = useState<number | null>(null);
  const moveRef = useRef<FrameDraft | null>(null);
  const dragRef = useRef<FrameDrag | null>(null);
  const movedOverRef = useRef(false);
  /**
   * The page's other paragraphs: where a move snaps to, what it must not land on, and what
   * the header and the grip keep off (TXT-26). Detected already for the layer (cached).
   */
  const [others, setOthers] = useState<readonly ParagraphBlock[]>([]);
  useEffect(() => {
    let live = true;
    pageParagraphs(block.ref.source, block.ref.pageIndex).then(
      (blocks) => {
        if (live) setOthers(blocks.filter((other) => other.ref.index !== block.ref.index));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [block.ref.source, block.ref.pageIndex, block.ref.index]);

  const rootRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ParagraphState | null>(null);
  const valueRef = useRef<Loaded | null>(null);
  /**
   * The composition under way: the model before it, the range it replaces and whether the
   * browser has named that range yet (its first `insertCompositionText`).
   */
  const composingRef = useRef<{
    base: ParagraphState;
    range: TextRange;
    named: boolean;
  } | null>(null);
  /** Puts the mirror's DOM and selection back on the model's last synced lines. */
  const resyncRef = useRef<(() => void) | null>(null);
  /** Set once the editor commits or discards, so unmounting does not commit again. */
  const finishedRef = useRef(false);
  const draggingRef = useRef(false);
  /** Until when a press on the editor keeps the caret it placed (`PRESS_WINS_MS`). */
  const pressedUntilRef = useRef(0);
  /** The last press on the editor: when, where and how many in a row (`MULTI_CLICK_MS`). */
  const lastPressRef = useRef({ time: -Infinity, x: 0, y: 0, count: 0 });
  const mountedRef = useRef(true);
  const returnFocusRef = useRef<Element | null>(null);
  const describedBy = useId();
  const honestyRef = useRef<ParagraphCommit['honesty']>(undefined);
  const pageRef = useRef(target.position);

  const cache: GlyphCache = useMemo(
    () => glyphCacheFor(block.ref.source, block.ref.pageIndex, session.revision),
    [block.ref.source, block.ref.pageIndex, session.revision],
  );
  const drawStyles = useMemo(() => {
    if (!value) return {};
    const out = { ...drawStylesOf(value.analysis.styles) };
    for (const [id, info] of Object.entries(value.analysis.styles)) {
      const base = out[id];
      if (base) out[id] = { ...base, family: substituteCssFamily(info, base.family) };
    }
    return out;
  }, [value]);

  // Open: the layout analysis and the layout functions, once per paragraph and revision.
  useEffect(() => {
    let live = true;
    Promise.all([paragraphLayoutAnalysis(session), getEngineService().paragraphLayout()]).then(
      ([analysis, fns]) => {
        if (!live) return;
        if (analysis.refusal) {
          const reason = paragraphRefusalLabel(analysis.refusal);
          if (session.fallback) {
            // The line editor still edits the clicked run.
            finishedRef.current = true;
            useTextEditStore.getState().open(session.fallback);
            announce(m.paragraph_refused({ reason }));
            return;
          }
          setLoaded({ session, error: m.paragraph_refused({ reason }) });
          return;
        }
        const setup: ParagraphSetup = {
          block: session.block,
          input: analysis.input,
          paragraphGap: analysis.paragraphGap,
          gapBelow: analysis.gapBelow,
          pageRoom: analysis.pageRoom,
        };
        setLoaded({ session, value: { session, setup, analysis, fns } });
      },
      async (caught: unknown) => {
        const { textEditFailureReason } = await import('@pdf-editor/engine/client');
        if (live) setLoaded({ session, error: failureMessage(textEditFailureReason(caught)) });
      },
    );
    return () => {
      live = false;
    };
  }, [session]);

  // The model starts from the paragraph's text with the caret at the click (or from the draft
  // kept when this session's editor last unmounted).
  const initial = useMemo(() => {
    if (!value) return null;
    if (kept) return kept.state;
    const start = initialState(value.setup.input, value.session.caret);
    const { point } = value.session;
    if (!point) return start;
    const fresh = relayout(value.fns, value.setup, start);
    const lines = caretLines(value.setup, start, fresh.layout);
    const local = invert(userFromText(value.setup.block.direction));
    return moveTo(start, offsetAtPoint(lines, apply(local, point)), false);
  }, [value, kept]);

  // A kept draft is back in this editor: say so, with the failure that kept it, if any.
  useEffect(() => {
    if (!value || !kept) return;
    useTextEditStore.getState().keepParagraph(null);
    announce(
      kept.error
        ? `${m.paragraph_returned({ page: target.position })} ${kept.error}`
        : m.paragraph_returned({ page: target.position }),
    );
  }, [value, kept, target.position]);

  // The plate: the paragraph's area rendered by a dry run that empties the paragraph, once
  // per open (the page under the text: coloured boxes, rules, what lies below).
  useEffect(() => {
    if (!value) return;
    const controller = new AbortController();
    const dpr = window.devicePixelRatio || 1;
    getEngineService()
      .renderParagraphPreview(
        block.ref.source,
        block.ref.pageIndex,
        { ref: block.ref, text: '', caretSpan: { start: 0, end: block.text.length } },
        frame.scale * dpr,
        { signal: controller.signal },
      )
      .then(
        (rendered) => {
          if (controller.signal.aborted) {
            rendered.bitmap.close();
            return;
          }
          setPlate({ bitmap: rendered.bitmap, clip: rendered.clip, scale: frame.scale * dpr });
        },
        () => {
          // No plate (a refusal or a cancelled run): rewritten lines sit on page white.
        },
      );
    return () => controller.abort();
  }, [value, block.ref, block.text.length, frame.scale]);
  useEffect(() => () => plate?.bitmap.close(), [plate]);
  const state = edited !== null && edited.key === value ? edited.state : initial;

  // Glyph outlines of every character shown, per font, asked for once (cached per page).
  const text = state?.text;
  useEffect(() => {
    if (!value || text === undefined) return;
    const wanted = new Map<number, Set<string>>();
    for (const info of Object.values(value.analysis.styles)) {
      if (info.fontId === undefined) continue;
      const set = wanted.get(info.fontId) ?? new Set<string>();
      for (const ch of `${block.text}${text}${COMMON_CHARS}-`) set.add(ch);
      wanted.set(info.fontId, set);
    }
    for (const [fontId, chars] of wanted) {
      const missing = cache.missing(fontId, chars);
      if (missing.length === 0) continue;
      // Asked for once: the next keystrokes do not ask again; drawn as text until they arrive.
      cache.request(fontId, missing);
      getEngineService()
        .glyphPaths(block.ref.source, block.ref.pageIndex, fontId, missing)
        .then(
          (paths) => {
            for (const ch of missing) cache.put(fontId, ch, paths[ch] ?? null);
            if (mountedRef.current) setGlyphVersion((v) => v + 1);
          },
          (caught: unknown) => {
            cache.release(fontId, missing);
            console.warn('Reading the glyph outlines failed', caught);
          },
        );
    }
  }, [value, text, cache, block.text, block.ref.source, block.ref.pageIndex]);

  // Per keystroke: the layout, its caret geometry and the scene (pure arithmetic).
  const widthChanged =
    moveDraft !== null &&
    (Math.abs(moveDraft.left - block.measure.left) > 1e-6 ||
      Math.abs(moveDraft.right - block.measure.right) > 1e-6);
  const measureLeft = widthChanged ? moveDraft.left : undefined;
  const measureRight = widthChanged ? moveDraft.right : undefined;
  const laid = useMemo(() => {
    if (!value || !state) return null;
    const measure =
      measureLeft === undefined || measureRight === undefined
        ? undefined
        : { left: measureLeft, right: measureRight };
    const result = relayout(value.fns, value.setup, state, measure);
    const lines = caretLines(value.setup, state, result.layout);
    return { result, lines };
  }, [value, state, measureLeft, measureRight]);

  // The draft follows the text only (caret moves keep it, and its preview).
  const stateText = state?.text;
  const stateStyles = state?.styles;
  const stateOrigins = state?.origins;
  const moving = moveDraft !== null && frameChanged(moveDraft, block);
  const draft = useMemo(() => {
    if (!value || stateText === undefined || !stateStyles) return null;
    const edit = paragraphEdit(
      value.setup.input.text,
      {
        text: stateText,
        styles: stateStyles,
        ...(stateOrigins ? { origins: stateOrigins } : {}),
        anchor: 0,
        focus: 0,
      },
      originalStylesOf(value.setup.input),
    );
    // A moved or resized paragraph is a draft with no text change; a new object for every
    // change of the frame, so the settled preview of the old frame is dropped (TXT-24).
    const framedNow = moveDraft !== null && frameChanged(moveDraft, block);
    if (edit) return framedNow ? { text: stateText, edit: { ...edit } } : { text: stateText, edit };
    return framedNow ? { text: stateText, edit: { start: 0, end: 0, text: '' } } : null;
  }, [value, stateText, stateStyles, stateOrigins, moveDraft, block]);
  const draftRef = useRef(draft);
  const layoutRef = useRef(laid);
  /**
   * What a dry run or the commit carries besides the text (TXT-24): the frame change and the
   * layout the user saw, laid out in the paragraph's own place (the engine translates it), so a
   * move never wraps the lines again.
   */
  const frameEditOf = (
    layout = layoutRef.current?.result.layout,
  ): { frame?: ParagraphFrameChange; layout?: ParagraphLayout } => {
    const moved = moveRef.current;
    const change = moved && frameChanged(moved, block) ? frameChangeOf(moved, block) : undefined;
    return { ...(change ? { frame: change } : {}), ...(layout ? { layout } : {}) };
  };
  const frameEditRef = useRef(frameEditOf);

  // Publish the draft (what leaving commits) and drop a preview of older text.
  useEffect(() => {
    useTextEditStore.getState().setParagraphDraft(draft ? draftPayload(draft) : null);
  }, [draft]);
  const choice = choiceFor !== null && choiceFor === draft;
  const setChoice = useCallback((on: boolean) => {
    setChoiceFor(on ? draftRef.current : null);
  }, []);

  const showPreview =
    preview !== null && draft !== null && preview.text === draft.text && composition === null;

  // After a pause in typing: one dry run, rendered, replaces the drawn glyphs.
  useEffect(() => {
    if (!draft || composition !== null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const dpr = window.devicePixelRatio || 1;
      getEngineService()
        .renderParagraphPreview(
          block.ref.source,
          block.ref.pageIndex,
          { ref: block.ref, ...draftPayload(draft), ...frameEditRef.current() },
          frame.scale * dpr,
          { signal: controller.signal },
        )
        .then(
          (rendered) => {
            if (controller.signal.aborted) return;
            useTextEditStore.getState().setParagraphPreview({
              text: draft.text,
              bitmap: rendered.bitmap,
              clip: rendered.clip,
              result: rendered.result,
            });
          },
          async (caught: unknown) => {
            if (controller.signal.aborted) return;
            const { textEditFailureReason } = await import('@pdf-editor/engine/client');
            setError(failureMessage(textEditFailureReason(caught)));
          },
        );
    }, PREVIEW_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [draft, composition, block.ref, frame.scale]);

  // ---- Geometry -----------------------------------------------------------------------

  const textToUser = useMemo(() => userFromText(block.direction), [block.direction]);
  const scene = useMemo(() => {
    if (!value || !state || !laid) return null;
    // A moved or resized paragraph is drawn whole from its glyphs (TXT-24).
    const shown = moving
      ? drawnWhole(laid.result, laid.lines)
      : { result: laid.result, lines: laid.lines };
    return buildScene({
      setup: value.setup,
      state,
      relayout: shown.result,
      lines: shown.lines,
      styles: drawStyles,
      focused,
      ...(composition ? { composition } : {}),
    });
  }, [value, state, laid, drawStyles, focused, composition, moving]);
  // While it moves, the plates that hide the original lines stay where they were, on their
  // own canvas; the glyphs, selection and caret are on the one that follows the move.
  const hideScene = useMemo(() => {
    if (!moving || !value || !state || !laid) return null;
    return buildScene({
      setup: value.setup,
      state,
      relayout: { ...laid.result, layout: { ...laid.result.layout, lines: [] } },
      lines: [],
      styles: drawStyles,
      focused: false,
    });
  }, [moving, value, state, laid, drawStyles]);

  /** The paragraph's own extent in text space (the canvas never shrinks below it). */
  const extent: TextRect = useMemo(() => {
    const first = block.lines[0];
    const last = block.lines[block.lines.length - 1];
    return {
      x0: block.measure.left,
      x1: block.measure.right,
      y0: (last?.baseline ?? 0) - 0.4 * block.size,
      y1: (first?.baseline ?? 0) + 1.1 * block.size,
    };
  }, [block]);

  const cssOfText = useMemo(() => compose(textToUser, cssFromUser(frame)), [textToUser, frame]);
  const box = useMemo(() => {
    const bounds = scene ? sceneBounds(scene, extent) : extent;
    const corners = [
      apply(cssOfText, { x: bounds.x0, y: bounds.y0 }),
      apply(cssOfText, { x: bounds.x1, y: bounds.y0 }),
      apply(cssOfText, { x: bounds.x1, y: bounds.y1 }),
      apply(cssOfText, { x: bounds.x0, y: bounds.y1 }),
    ];
    // On the device pixel grid: one canvas pixel per device pixel, aligned with the page's.
    const dpr = window.devicePixelRatio || 1;
    const left = snapDown(Math.min(...corners.map((c) => c.x)) - CANVAS_PAD, dpr);
    const top = snapDown(Math.min(...corners.map((c) => c.y)) - CANVAS_PAD, dpr);
    const right = snapUp(Math.max(...corners.map((c) => c.x)) + CANVAS_PAD, dpr);
    const bottom = snapUp(Math.max(...corners.map((c) => c.y)) + CANVAS_PAD, dpr);
    return { left, top, width: right - left, height: bottom - top };
  }, [scene, extent, cssOfText]);
  const paragraphBox = rectToCss(frame, block.box);
  const shift = useMemo(
    () => (moveDraft ? cssDelta(frame, moveDraft) : { x: 0, y: 0 }),
    [frame, moveDraft],
  );
  const measureNow = moveDraft ?? block.measure;
  const lastBaselineShift =
    (laid?.lines[laid.lines.length - 1]?.baseline ?? 0) -
    (block.lines[block.lines.length - 1]?.baseline ?? 0);
  /** The frame's rectangle, text space: the ink, with the width and height of the layout shown. */
  const frameText = useMemo(() => {
    const back = invert(textToUser);
    const corners = [
      { x: block.box.x, y: block.box.y },
      { x: block.box.x + block.box.width, y: block.box.y + block.box.height },
    ].map((p) => apply(back, p));
    const ink: TextRect = {
      x0: Math.min(...corners.map((c) => c.x)),
      x1: Math.max(...corners.map((c) => c.x)),
      y0: Math.min(...corners.map((c) => c.y)),
      y1: Math.max(...corners.map((c) => c.y)),
    };
    return framedRect(ink, measureNow, widthChanged ? lastBaselineShift : 0);
  }, [block, textToUser, measureNow, widthChanged, lastBaselineShift]);
  /** The frame in user space, in its own place before the move: what a move is kept inside. */
  const frameUser: Rect = useMemo(() => {
    const corners = [
      { x: frameText.x0, y: frameText.y0 },
      { x: frameText.x1, y: frameText.y1 },
    ].map((p) => apply(textToUser, p));
    const x = Math.min(...corners.map((c) => c.x));
    const y = Math.min(...corners.map((c) => c.y));
    return {
      x,
      y,
      width: Math.max(...corners.map((c) => c.x)) - x,
      height: Math.max(...corners.map((c) => c.y)) - y,
    };
  }, [frameText, textToUser]);
  /** The moved frame lands on another paragraph (TXT-24): leaving asks first. */
  const movedOver =
    moving &&
    moveDraft !== null &&
    others.some((o) => rectOverlapsMoved(frameUser, moveDraft, o.box));
  /** Where the frame's hairline, band and grip are, CSS px (the paragraph, before the move). */
  const frameBox = useMemo(() => {
    if (!framed) return paragraphBox;
    const corners = [
      apply(cssOfText, { x: frameText.x0, y: frameText.y0 }),
      apply(cssOfText, { x: frameText.x1, y: frameText.y1 }),
    ];
    const left = Math.min(...corners.map((c) => c.x));
    const top = Math.min(...corners.map((c) => c.y));
    return {
      left,
      top,
      width: Math.max(...corners.map((c) => c.x)) - left,
      height: Math.max(...corners.map((c) => c.y)) - top,
    };
  }, [framed, paragraphBox, frameText, cssOfText]);
  /** The other paragraphs' boxes in the layer's CSS pixels (TXT-26). */
  const othersCss = useMemo(
    () =>
      others.map((o) => {
        const r = rectToCss(frame, o.box);
        return { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height };
      }),
    [others, frame],
  );
  /** The grip goes under the frame when its notch would lie on a paragraph above (TXT-26). */
  const gripBelow =
    gripEdge(
      {
        left: frameBox.left,
        top: frameBox.top,
        right: frameBox.left + frameBox.width,
        bottom: frameBox.top + frameBox.height,
      },
      othersCss,
      GRIP_NOTCH.width,
      GRIP_NOTCH.reach,
    ) === 'bottom';
  /** On-screen angle of the writing direction (clockwise degrees): the canvas turns with it. */
  const screenAngle =
    ((Math.round((Math.atan2(cssOfText[1], cssOfText[0]) * 180) / Math.PI) % 360) + 360) % 360;

  // The plate image in canvas pixels: rendered at this zoom for this device, in the page's
  // own orientation (a view rotation on top draws the plate colour only).
  const plateImage = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    if (!plate || Math.abs(plate.scale - frame.scale * dpr) > 1e-6) return undefined;
    if ((frame.rotation - (frame.intrinsicRotation ?? 0)) % 360 !== 0) return undefined;
    const at = previewPlacement(frame, plate.clip, plate.bitmap, dpr);
    return {
      image: plate.bitmap,
      x: Math.round((at.left - box.left) * dpr),
      y: Math.round((at.top - box.top) * dpr),
      width: plate.bitmap.width,
      height: plate.bitmap.height,
    };
  }, [plate, frame, box]);

  // Draw (each keystroke, caret move, focus change, glyph arrival). A moving paragraph is drawn
  // on two canvases (TXT-24): the plates that hide the original on this one, the glyphs on the
  // one that follows the move.
  useLayoutEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const userToDevice = compose(
      compose(cssFromUser(frame), translate(-box.left, -box.top)),
      scale(dpr),
    );
    const root = rootRef.current;
    const paint = (canvas: HTMLCanvasElement | null, drawn: Scene | null, plated: boolean) => {
      if (!canvas || !drawn) return;
      const width = Math.max(1, Math.round(box.width * dpr));
      const height = Math.max(1, Math.round(box.height * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawScene(ctx, { width, height }, drawn, cache, textToUser, userToDevice, {
        colors: {
          plate: '#ffffff',
          // The page's selection blue (language.md §1.5): a mark on the page, not chrome.
          selection: readVar(root, '--select-wash', 'rgb(78 97 237 / 0.25)'),
          caret: readVar(root, '--select', '#4e61ed'),
          overlap: 'rgba(220, 38, 38, 0.22)',
        },
        dpr,
        ...(showPreview && preview ? { preview: preview.clip } : {}),
        ...(plated && plateImage ? { plateImage } : {}),
      });
    };
    if (hideScene && scene) {
      paint(canvasRef.current, hideScene, true);
      paint(inkRef.current, { ...scene, plates: [] }, false);
    } else {
      paint(canvasRef.current, scene, true);
    }
    // `glyphVersion`: outlines arrived, draw them.
  }, [
    scene,
    hideScene,
    box,
    frame,
    cache,
    textToUser,
    showPreview,
    preview,
    glyphVersion,
    plateImage,
  ]);

  // The settled preview: the dry run's bitmap at its clip.
  const previewBox =
    showPreview && preview
      ? previewPlacement(frame, preview.clip, preview.bitmap, window.devicePixelRatio || 1)
      : null;
  useLayoutEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !showPreview || !preview) return;
    canvas.width = preview.bitmap.width;
    canvas.height = preview.bitmap.height;
    canvas.getContext('2d')?.drawImage(preview.bitmap, 0, 0);
  }, [showPreview, preview]);

  // ---- The mirror ---------------------------------------------------------------------

  // Keep the mirror's lines and selection on the model's (never during a composition): the
  // text in the canvas's lines over the drawn ones (`mirror-dom.ts`), and the DOM selection set
  // after every model change, so the keyboard (iOS's trackpad, autocorrect) reads the caret
  // where the canvas draws it.
  const mirrorPx = Math.max(edition.minMirrorPx, 6, block.size * frame.scale);
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror || !state || composition) return;
    const toBox = compose(cssOfText, translate(-box.left, -box.top));
    const lines = mirrorLines(state.text, laid?.lines ?? [], toBox, box);
    const sync = () => {
      syncMirrorLines(mirror, lines, mirrorPx);
      if (document.activeElement === mirror) selectInMirror(mirror, state);
    };
    resyncRef.current = sync;
    sync();
  }, [state, laid, composition, focused, box, cssOfText, mirrorPx]);

  // Focus the mirror when the editor is ready; remember where the focus was.
  useLayoutEffect(() => {
    if (!value) return;
    const mirror = mirrorRef.current;
    if (!mirror) return;
    if (document.activeElement !== mirror) {
      returnFocusRef.current = document.activeElement;
      mirror.focus({ preventScroll: true });
    }
  }, [value]);

  const update = useCallback((next: ParagraphState) => {
    const key = valueRef.current;
    if (!key || next === stateRef.current) return;
    stateRef.current = next;
    setEdited({ key, state: next });
    setError(null);
  }, []);

  // The caret moved in the mirror (assistive technology, the iOS keyboard's trackpad, a
  // tap's native placement): follow it, read as text offsets wherever in the mirror it lies
  // (`mirrorOffset`). A selection that left the mirror while it has the focus is put back,
  // or typing would reach nothing. While a press on the editor places the caret, and briefly
  // after (iOS places its own caret at the lift), the press wins: the DOM is put back.
  useEffect(() => {
    const onSelectionChange = () => {
      const mirror = mirrorRef.current;
      const model = stateRef.current;
      if (!mirror || !model || composingRef.current || document.activeElement !== mirror) return;
      // The model changed and its lines are not in the DOM yet: the sync sets the selection.
      if ((mirror.textContent ?? '') !== model.text) return;
      const selection = window.getSelection();
      if (!selection) return;
      const anchor = mirrorOffset(mirror, selection.anchorNode, selection.anchorOffset);
      const focus = mirrorOffset(mirror, selection.focusNode, selection.focusOffset);
      if (
        anchor === null ||
        focus === null ||
        draggingRef.current ||
        performance.now() < pressedUntilRef.current
      ) {
        selectInMirror(mirror, model);
        return;
      }
      if (anchor === model.anchor && focus === model.focus) return;
      update(moveTo({ ...model, anchor }, focus, true));
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [update]);

  // Text input arrives as `beforeinput`: model operations, the DOM is then re-synced.
  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    const onBeforeInput = (event: InputEvent) => {
      const current = stateRef.current;
      if (!current) {
        event.preventDefault();
        return;
      }
      if (event.inputType === 'insertCompositionText') {
        // The first input of a composition names the range it replaces: a keyboard that
        // composes whole words (Android's) takes the word before the caret, not the caret.
        const composing = composingRef.current;
        if (composing && !composing.named) {
          composing.named = true;
          const range = targetRangeOf(mirror, event);
          if (range) composing.range = range;
        }
        return;
      }
      if (event.isComposing) return;
      event.preventDefault();
      if (busy) return;
      // The range the input acts on as the browser names it (iOS's autocorrect replaces a word
      // away from the caret; a delete takes a whole grapheme or word): it becomes the model's
      // selection first. None given, or not in the mirror: the model's own selection.
      const target = targetRangeOf(mirror, event);
      const model = target ? { ...current, anchor: target.start, focus: target.end } : current;
      const pasted = () =>
        (event.dataTransfer?.getData('text/plain') ?? event.data ?? '').replace(/\r\n?/g, '\n');
      switch (event.inputType) {
        case 'insertText':
        case 'insertReplacementText':
          update(insertText(model, event.data ?? pasted()));
          break;
        case 'insertLineBreak':
        case 'insertParagraph':
          update(insertText(model, '\n'));
          break;
        case 'insertFromPaste':
        case 'insertFromDrop':
        case 'insertFromYank':
          update(insertText(model, pasted()));
          break;
        case 'deleteContentBackward':
          update(deleteBackward(model));
          break;
        case 'deleteContentForward':
          update(deleteForward(model));
          break;
        case 'deleteWordBackward':
          update(deleteBackward(model, 'word'));
          break;
        case 'deleteWordForward':
          update(deleteForward(model, 'word'));
          break;
        case 'deleteByCut':
        case 'deleteByDrag':
        case 'deleteContent':
          update(replaceRange(model, selectionOf(model), ''));
          break;
        case 'deleteSoftLineBackward':
        case 'deleteHardLineBackward': {
          if (target && target.start !== target.end) {
            update(replaceRange(model, target, ''));
            break;
          }
          const lines = layoutRef.current?.lines;
          if (!lines) break;
          const start = moveLineEdge(model, lines, 'start', false).focus;
          update(replaceRange(model, { start, end: model.focus }, ''));
          break;
        }
        default:
          // History and formatting have no meaning here (no font, size or colour controls).
          break;
      }
      // Nothing changed (a delete at the start, a target range naming nothing): the browser
      // may still have moved its idea of the caret; put it back on the model's.
      if (stateRef.current === current) selectInMirror(mirror, current);
    };
    // The DOM edited outside a composition after all (WebKit deletes and inserts a committed
    // composition's text after `compositionend`, which the model has taken already): put the
    // model's lines and selection back, or the next input's range would be read off it.
    const onInput = () => {
      const model = stateRef.current;
      if (!model || composingRef.current || (mirror.textContent ?? '') === model.text) return;
      resyncRef.current?.();
    };
    mirror.addEventListener('beforeinput', onBeforeInput);
    mirror.addEventListener('input', onInput);
    return () => {
      mirror.removeEventListener('beforeinput', onBeforeInput);
      mirror.removeEventListener('input', onInput);
    };
  }, [busy, update]);

  // ---- Leaving ------------------------------------------------------------------------

  const restoreFocus = useCallback(() => {
    const previous = returnFocusRef.current;
    if (previous instanceof HTMLElement && previous.isConnected) {
      previous.focus({ preventScroll: true });
      return;
    }
    rootRef.current?.closest<HTMLElement>('[data-read-viewport]')?.focus({ preventScroll: true });
  }, []);

  /**
   * Closes after leaving: opened from a run, the focus goes back to it (or, after a commit, to
   * the run on its line once the page is located again); otherwise where it was before. A
   * session that is no longer the open one (another paragraph opened meanwhile) is left alone.
   */
  const finishWith = (committed: boolean) => {
    if (!isCurrent(session)) return;
    if (session.fallback) {
      useTextEditStore.getState().finishParagraph(committed);
      return;
    }
    useTextEditStore.getState().closeParagraph();
    restoreFocus();
  };
  const finishRef = useRef(finishWith);
  /** Holds what the editor shows over the page until it paints the commit (edit-motion.ts). */
  const holdOver = () => holdOverCommit(rootRef.current, target.source, target.pageIndex);
  const holdRef = useRef(holdOver);

  /** The commit of a draft: what the user saw (layout) and was told (honesty). */
  const commitOf = (
    pending: NonNullable<typeof draft>,
    layout?: ParagraphLayout,
  ): ParagraphCommit => ({
    target,
    block,
    ...draftPayload(pending),
    ...frameEditRef.current(layout),
    ...(honestyRef.current ? { honesty: honestyRef.current } : {}),
  });
  const commitRef = useRef(commitOf);

  /**
   * Leaving commits the draft. A paragraph that would leave the page is never written (the
   * editor keeps the text and says why); one that runs into the content below asks first:
   * tighten the whole paragraph when that fits, let it overlap, or keep editing.
   */
  const leave = useCallback(
    async (resolution?: 'tighten' | 'overlap') => {
      // Esc during a drag cancels the drag; it never commits a half-done move (TXT-24).
      if (finishedRef.current || busy || dragRef.current) return;
      const pending = draftRef.current;
      const shown = layoutRef.current;
      if (!pending) {
        finishedRef.current = true;
        finishRef.current(false);
        return;
      }
      const decision = shown?.result.decision;
      if (decision?.kind === 'overflow') {
        if (decision.offPage) {
          setChoice(false);
          setError(m.paragraph_off_page());
          announce(m.paragraph_off_page(), { politeness: 'assertive' });
          mirrorRef.current?.focus({ preventScroll: true });
          return;
        }
        if (resolution === undefined || (resolution === 'tighten' && !decision.fit)) {
          setChoice(true);
          announce(
            decision.fit ? m.paragraph_overlap_choice() : m.paragraph_overlap_choice_no_fit(),
            {
              politeness: 'assertive',
            },
          );
          return;
        }
      }
      // A move onto another paragraph is written over it: ask first (TXT-24).
      if (movedOverRef.current && resolution === undefined) {
        setChoice(true);
        announce(m.paragraph_move_overlap_choice(), { politeness: 'assertive' });
        return;
      }
      const fit =
        resolution === 'tighten' && decision?.kind === 'overflow' ? decision.fit : undefined;
      if (fit) announce(m.paragraph_tightened({ percent: formatPercent(fit.percent / 100) }));
      setChoice(false);
      setBusy(true);
      setError(null);
      // Committing: unmounting meanwhile (another editor opening) must not commit again.
      finishedRef.current = true;
      const outcome = await commitParagraphEdit(
        commitRef.current(pending, fit?.layout ?? shown?.result.layout),
      );
      if (outcome.ok) {
        // What the editor shows stays until the page shows it (motion-2026-10 viewer.md §6).
        holdRef.current();
        finishRef.current(true);
        return;
      }
      if (!mountedRef.current) {
        // The editor is gone (its page scrolled away, another paragraph opened): say so, and
        // keep the text for its return when the session is still open.
        const typed = stateRef.current;
        if (typed && isCurrent(session)) {
          useTextEditStore
            .getState()
            .keepParagraph({ session, state: typed, error: outcome.message });
        }
        announce(
          `${m.paragraph_commit_failed({ page: target.position, reason: outcome.message })}${moveRef.current ? ` ${m.paragraph_move_dropped()}` : ''}`,
          { politeness: 'assertive' },
        );
        return;
      }
      finishedRef.current = false;
      setBusy(false);
      setError(outcome.message);
      mirrorRef.current?.focus({ preventScroll: true });
    },
    [busy, session, setChoice, target.position],
  );
  const leaveRef = useRef(leave);

  const keepEditing = () => {
    setChoice(false);
    mirrorRef.current?.focus({ preventScroll: true });
  };
  /** Esc on a button of the choice keeps editing (page shortcuts never see it). */
  const onChoiceKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.key !== 'Escape') return;
    event.preventDefault();
    keepEditing();
  };

  // The choice opens on "Keep editing", the safe default.
  useEffect(() => {
    if (choice) keepEditingRef.current?.focus({ preventScroll: true });
  }, [choice]);

  // Leaving by any other way (the page scrolling away, the Read lock, another paragraph):
  // never a silent loss. A draft that runs over or off the page is not written: it is kept
  // for this session's return (or, the session gone, discarded with an announcement). Any
  // other draft is committed; a failure keeps it and says so.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Entering: the frame unfolds from the first line over the paragraph (viewer.md §6).
  const frameRef = useRef<HTMLDivElement>(null);
  const lineHeight = block.size * frame.scale * 1.2;
  useLayoutEffect(() => {
    openFrame(frameRef.current, lineHeight);
    // On open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      const pending = draftRef.current;
      if (finishedRef.current || !pending) return;
      finishedRef.current = true;
      const typed = stateRef.current;
      const decision = layoutRef.current?.result.decision;
      const page = pageRef.current;
      const store = useTextEditStore.getState();
      if (decision?.kind === 'overflow') {
        if (typed && isCurrent(session)) {
          store.keepParagraph({
            session,
            state: typed,
            ...(decision.offPage ? { error: m.paragraph_off_page() } : {}),
          });
          announce(m.paragraph_kept({ page }));
        } else {
          announce(m.paragraph_kept_discarded({ page }));
        }
        return;
      }
      void commitParagraphEdit(commitRef.current(pending, layoutRef.current?.result.layout)).then(
        (outcome) => {
          if (outcome.ok) {
            if (isCurrent(session)) useTextEditStore.getState().closeParagraph();
            return;
          }
          if (typed && isCurrent(session)) {
            useTextEditStore
              .getState()
              .keepParagraph({ session, state: typed, error: outcome.message });
          }
          announce(
            `${m.paragraph_commit_failed({ page, reason: outcome.message })}${moveRef.current ? ` ${m.paragraph_move_dropped()}` : ''}`,
            { politeness: 'assertive' },
          );
        },
      );
    },
    [session],
  );

  // ---- Frame (TXT-24) -----------------------------------------------------------------
  // The border band and the grip drag the paragraph, the side bars change its width. Nothing
  // goes to the engine while dragging: the draft joins the open session and leaving commits it
  // with the text (one history entry); the settled preview, 300 ms after the last change,
  // shows what will be saved.

  const frameRefusal = value?.analysis.frameRefusal;
  const canMove =
    framed &&
    value !== null &&
    !busy &&
    frameRefusal !== 'move-shared-object' &&
    frameRefusal !== 'move-form-field';
  const canResize = canMove && frameRefusal !== 'resize-direction';
  const setFrameDraft = (next: FrameDraft | null) => {
    const kept = next !== null && frameChanged(next, block) ? next : null;
    moveRef.current = kept;
    setMoveDraft(kept);
  };
  /** Ends a drag; `cancel` puts the frame back as it was when the press began. */
  const endDrag = (cancel: boolean) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setGuide(null);
    if (drag && cancel) setFrameDraft(drag.base);
  };
  const endDragRef = useRef(endDrag);

  const onFrameDown = (event: ReactPointerEvent<HTMLElement>) => {
    const kind = event.currentTarget.dataset.frameControl as FrameDrag['kind'];
    if (event.button !== 0 || !canMove || dragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    mirrorRef.current?.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is gone (a synthetic event): the drag still follows the window's moves.
    }
    const drag: FrameDrag = {
      kind,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      base: moveRef.current ?? initialFrame(block),
      started: false,
    };
    dragRef.current = drag;
  };
  const onFrameMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId || !value) return;
    const cssDx = event.clientX - drag.x;
    const cssDy = event.clientY - drag.y;
    if (!drag.started) {
      if (!pastSlop(cssDx, cssDy, drag.pointerType)) return;
      drag.started = true;
    }
    if (drag.kind === 'move') {
      const moved = moveBy({
        frame,
        box: frameUser,
        base: drag.base,
        start: { x: drag.x, y: drag.y },
        now: { x: event.clientX, y: event.clientY },
        anchors: snapAnchors(frame, block, others),
        alt: event.altKey,
      });
      setFrameDraft({ ...drag.base, dx: moved.dx, dy: moved.dy });
      setGuide(moved.guide ?? null);
      return;
    }
    const measure = widthBy({
      side: drag.kind,
      base: drag.base,
      original: block.measure,
      along: textDelta(cssOfText, cssDx, cssDy).dx,
      roomLeft: value.analysis.roomLeft ?? 0,
      roomRight: value.analysis.roomRight ?? 0,
      size: block.size,
    });
    setFrameDraft({ ...drag.base, ...measure });
  };
  const onFrameUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId === dragRef.current?.pointerId) {
      endDrag(event.type === 'pointercancel');
    }
  };

  // A second finger (or any press elsewhere) during a drag cancels it, and is not a press
  // outside the editor: this listener is added before the one that leaves (below).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId === drag.pointerId) return;
      event.stopImmediatePropagation();
      endDragRef.current(true);
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, []);

  // A press outside the editor leaves it.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const element = event.target;
      if (element instanceof Element && element.closest('[data-paragraph-editor]')) return;
      void leaveRef.current();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, []);

  // The page changed under the editor (undo, another edit): the paragraph is stale.
  useEffect(() => {
    if (busy || revision === session.revision) return;
    finishedRef.current = true;
    useTextEditStore.getState().closeParagraph();
  }, [busy, revision, session.revision]);

  // ---- Keys ---------------------------------------------------------------------------

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Page shortcuts never fire while typing.
    event.stopPropagation();
    // A key the input method takes: during a composition, and in WebKit the key that ends one,
    // sent after `compositionend` with the IME's key code 229 (an Esc that cancels the
    // candidates must not leave the editor). `keyCode` is the only field that says so.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const model = stateRef.current;
    const lines = layoutRef.current?.lines;
    const mod = event.ctrlKey || event.metaKey;
    const word = event.altKey || event.ctrlKey;
    const handled = (next?: ParagraphState) => {
      event.preventDefault();
      if (next) update(next);
    };
    if (event.key === 'Escape') {
      handled();
      if (dragRef.current) {
        endDrag(true);
        return;
      }
      // Esc on the overlap choice keeps editing; otherwise it leaves.
      if (choice) keepEditing();
      else void leave();
      return;
    }
    if (!model || !lines) return;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        const dir = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.metaKey) {
          handled(moveLineEdge(model, lines, dir < 0 ? 'start' : 'end', event.shiftKey));
        } else handled(moveHorizontal(model, dir, event.shiftKey, word ? 'word' : 'char'));
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        const dir = event.key === 'ArrowUp' ? -1 : 1;
        if (mod) handled(moveTo(model, dir < 0 ? 0 : model.text.length, event.shiftKey));
        else handled(moveVertical(model, lines, dir, event.shiftKey));
        return;
      }
      case 'Home':
      case 'End': {
        const edge = event.key === 'Home' ? 'start' : 'end';
        if (mod) handled(moveTo(model, edge === 'start' ? 0 : model.text.length, event.shiftKey));
        else handled(moveLineEdge(model, lines, edge, event.shiftKey));
        return;
      }
      default:
        if (mod && !event.altKey && event.key.toLowerCase() === 'a') handled(selectAll(model));
    }
  };

  // ---- Composition --------------------------------------------------------------------

  const onCompositionStart = () => {
    const model = stateRef.current;
    if (!model) return;
    const range = selectionOf(model);
    composingRef.current = { base: model, range, named: false };
    setComposition({ start: range.start, end: range.start });
  };
  const compose_ = (data: string, done: boolean) => {
    const composing = composingRef.current;
    if (!composing) return;
    const next = replaceRange(composing.base, composing.range, data);
    if (done) {
      composingRef.current = null;
      setComposition(null);
    } else {
      const length = data.normalize('NFC').length;
      setComposition({ start: composing.range.start, end: composing.range.start + length });
    }
    update(next);
  };

  // ---- Clipboard ----------------------------------------------------------------------
  // The mirror holds a block per drawn line, which the browser would copy as line breaks:
  // the clipboard takes the model's selected text instead, and a cut removes it.

  const onClipboard = (event: ReactClipboardEvent<HTMLDivElement>, cut: boolean) => {
    const model = stateRef.current;
    if (!model || composingRef.current) return;
    const range = selectionOf(model);
    if (range.start === range.end) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', model.text.slice(range.start, range.end));
    if (cut && !busy) update(replaceRange(model, range, ''));
  };

  // ---- Pointer on the paragraph -------------------------------------------------------
  // The mirror lies over the canvas, so presses land on it (the browser's own placement,
  // positioned in the mirror's lines, would be off by a glyph): the press places the model's
  // caret from the drawn lines and keeps it against the browser's for `PRESS_WINS_MS`.

  const pointToOffset = (clientX: number, clientY: number): number | undefined => {
    const layer = rootRef.current?.getBoundingClientRect();
    const lines = layoutRef.current?.lines;
    if (!layer || !lines) return undefined;
    const user = cssPointToUser(frame, { x: clientX - layer.left, y: clientY - layer.top });
    return offsetAtPoint(lines, apply(invert(textToUser), user));
  };

  const onPressDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    pressedUntilRef.current = now + PRESS_WINS_MS;
    const last = lastPressRef.current;
    const again =
      now - last.time <= MULTI_CLICK_MS &&
      Math.abs(event.clientX - last.x) <= MULTI_CLICK_PX &&
      Math.abs(event.clientY - last.y) <= MULTI_CLICK_PX;
    const count = Math.max(event.detail, again ? last.count + 1 : 1);
    lastPressRef.current = { time: now, x: event.clientX, y: event.clientY, count };
    mirrorRef.current?.focus({ preventScroll: true });
    const model = stateRef.current;
    const offset = pointToOffset(event.clientX, event.clientY);
    if (!model || offset === undefined) return;
    if (count >= 3) update(selectAll(model));
    else if (count === 2) {
      const range = wordRange(model.text, offset);
      update({ ...moveTo(model, range.start, false), focus: range.end });
    } else {
      update(moveTo(model, offset, event.shiftKey));
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const onPressMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!draggingRef.current) return;
    const model = stateRef.current;
    const offset = pointToOffset(event.clientX, event.clientY);
    if (model && offset !== undefined) update(moveTo(model, offset, true));
  };
  const onPressUp = () => {
    draggingRef.current = false;
    pressedUntilRef.current = performance.now() + PRESS_WINS_MS;
  };

  // ---- Header -------------------------------------------------------------------------

  const headerKey = `${frame.scale}:${value === null}:${busy}:${error ?? ''}:${state?.text ?? ''}`;

  // The header never covers the paragraph and, wherever there is room, no other content
  // either (05-canvas §17.3; `header-place.ts` holds the order). It is placed in the layer's
  // pixels against the free rectangle, so it follows the zoom, the text, the scroll and the
  // frame (a sidebar opening, the capsule changing shape).
  const [scrolled, setScrolled] = useState(0);
  const gapAbove = value?.analysis.gapAbove;
  const gapBelow = value?.analysis.gapBelow;
  useLayoutEffect(() => {
    const header = headerRef.current;
    const root = rootRef.current;
    if (!header || !root) return;
    // A moved or resized paragraph (TXT-24): the header keeps clear of the frame where it is.
    const textLeft = Math.min(frameBox.left, box.left) + shift.x;
    const textRight = Math.max(frameBox.left + frameBox.width, box.left + box.width) + shift.x;
    const textTop = Math.min(frameBox.top, box.top) + shift.y;
    const textBottom = Math.max(frameBox.top + frameBox.height, box.top + box.height) + shift.y;
    const layer = root.getBoundingClientRect();
    const frameStyle = getComputedStyle(root.ownerDocument.documentElement);
    const inset = (side: string) =>
      Number.parseFloat(frameStyle.getPropertyValue(`--free-${side}`)) || 0;
    const view = root.ownerDocument.documentElement;
    const free = {
      left: inset('left') - layer.left,
      top: inset('top') - layer.top,
      right: view.clientWidth - inset('right') - layer.left,
      bottom: view.clientHeight - inset('bottom') - layer.top,
    };
    // The spaces above and below are measured along the paragraph's own lines: they hold on
    // screen only while those run left to right, unrotated.
    const upright =
      !moving &&
      frame.rotation === 0 &&
      block.direction.x === 1 &&
      Math.abs(block.direction.y) < 1e-6;
    const points = frame.scale * (frame.stretchY ?? 1);
    const contentTop = paragraphBox.top - (gapAbove ?? 0) * points;
    const contentBottom = paragraphBox.top + paragraphBox.height + (gapBelow ?? 0) * points;
    // Measured at its widest, so a header that wrapped in a narrow margin measures anew.
    const wrapped = header.style.maxWidth;
    header.style.maxWidth = '';
    const size = { width: header.offsetWidth, height: header.offsetHeight };
    header.style.maxWidth = wrapped;
    const next = placeHeader({
      text: { left: textLeft, top: textTop, right: textRight, bottom: textBottom },
      free,
      header: size,
      above: upright && gapAbove !== undefined ? textTop - contentTop : undefined,
      below: upright && gapBelow !== undefined ? contentBottom - textBottom : undefined,
      others: othersCss,
    });
    setPlace((prev) =>
      prev.side === next.side &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.maxWidth === next.maxWidth
        ? prev
        : next,
    );
    // The header's size follows its lines; its place the zoom, the text and the scroll.
  }, [
    frame,
    block.direction,
    paragraphBox.left,
    paragraphBox.top,
    paragraphBox.width,
    paragraphBox.height,
    frameBox.left,
    frameBox.top,
    frameBox.width,
    frameBox.height,
    shift.x,
    shift.y,
    moving,
    box,
    gapAbove,
    gapBelow,
    othersCss,
    headerKey,
    scrolled,
    choice,
  ]);

  // The scroll and the window move the layer against the free rectangle: one place a frame.
  useEffect(() => {
    const viewport = rootRef.current?.closest<HTMLElement>('[data-read-viewport]');
    let pending = 0;
    const onMove = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        setScrolled((n) => n + 1);
      });
    };
    viewport?.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(pending);
      viewport?.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, []);

  const substitutions = useMemo(() => {
    if (preview && draft !== null && preview.text === draft.text) {
      return preview.result.substitutions;
    }
    if (!laid || !value) return [];
    return laid.result.layout.substituted.map((s) => ({
      char: s.char,
      font: s.font,
      family: faceFamilyName(s.font),
    }));
  }, [preview, draft, laid, value]);
  // The faces substituted characters are drawn in, loaded on first use.
  const substitutedFaces = [...new Set(substitutions.map((s) => s.font))].join(' ');
  useEffect(() => {
    for (const key of substitutedFaces.split(' ')) {
      const face = BUNDLED_FACES.find((f) => f.key === key);
      if (face) ensureFace(face);
    }
  }, [substitutedFaces]);
  const honestyFacts = useMemo((): NonNullable<ParagraphCommit['honesty']> => {
    if (preview && draft !== null && preview.text === draft.text) return preview.result;
    const embedded = Object.values(value?.analysis.styles ?? {}).every((st) => st.font.embedded);
    return {
      honesty:
        substitutions.length > 0
          ? 'font-substituted'
          : embedded
            ? 'same-font'
            : 'same-font-not-embedded',
      substitutions,
    };
  }, [preview, draft, substitutions, value]);
  const honesty = honestyLines(substitutions);
  const decision = laid?.result.decision;
  const unsupported = laid?.result.layout.unsupported ?? [];
  const offPage = decision?.kind === 'overflow' && decision.offPage;
  const overflowLine =
    decision?.kind === 'tighten'
      ? m.paragraph_tightened({ percent: formatPercent(decision.percent / 100) })
      : offPage
        ? m.paragraph_off_page()
        : decision?.kind === 'overflow'
          ? m.paragraph_overflow()
          : null;
  const ragged = laid?.result.layout.ragged === true;
  const loadError = current && 'error' in current ? current.error : null;
  const shownError =
    error ??
    loadError ??
    (unsupported.length > 0 ? m.paragraph_unsupported({ chars: quotedList(unsupported) }) : null);

  // Say the honesty and overflow lines when they first appear or change.
  const spoken = [...honesty, overflowLine, ragged ? m.paragraph_ragged() : null]
    .filter((line): line is string => line !== null)
    .join(' ');
  const spokenRef = useRef('');
  useEffect(() => {
    if (spoken !== '' && spoken !== spokenRef.current)
      announce(spoken, { key: 'paragraph-editor' });
    spokenRef.current = spoken;
  }, [spoken]);

  // The latest values for event handlers and the unmount commit.
  useLayoutEffect(() => {
    stateRef.current = state;
    valueRef.current = value;
    draftRef.current = draft;
    layoutRef.current = laid;
    leaveRef.current = leave;
    commitRef.current = commitOf;
    frameEditRef.current = frameEditOf;
    endDragRef.current = endDrag;
    movedOverRef.current = movedOver;
    finishRef.current = finishWith;
    holdRef.current = holdOver;
    honestyRef.current = honestyFacts;
    pageRef.current = target.position;
  });

  // The frame controls' places, CSS px in the layer (TXT-24): the band round the ink, and a
  // touch target for each side bar just outside the frame, on the measure's edge at mid height.
  const frameNote = (() => {
    if (!framed || !frameRefusal) return null;
    const reason = paragraphFrameRefusalLabel(frameRefusal) ?? '';
    return frameRefusal === 'resize-direction'
      ? m.paragraph_resize_refused({ reason })
      : m.paragraph_move_refused({ reason });
  })();
  const { left: fl, top: ft, width: fw, height: fh } = frameBox;
  const bands = [
    {
      name: 'top',
      style: { left: fl - BAND_PX, top: ft - BAND_PX, width: fw + 2 * BAND_PX, height: BAND_PX },
    },
    {
      name: 'bottom',
      style: { left: fl - BAND_PX, top: ft + fh, width: fw + 2 * BAND_PX, height: BAND_PX },
    },
    { name: 'left', style: { left: fl - BAND_PX, top: ft, width: BAND_PX, height: fh } },
    { name: 'right', style: { left: fl + fw, top: ft, width: BAND_PX, height: fh } },
  ];
  const alongLength = Math.hypot(cssOfText[0], cssOfText[1]) || 1;
  const sideBars = (['left', 'right'] as const).map((side) => {
    const sign = side === 'left' ? -1 : 1;
    const edge = apply(cssOfText, {
      x: side === 'left' ? measureNow.left : measureNow.right,
      y: (frameText.y0 + frameText.y1) / 2,
    });
    const outX = (sign * cssOfText[0]) / alongLength;
    const outY = (sign * cssOfText[1]) / alongLength;
    const reach = 3 + TARGET_PX / 2;
    return {
      side,
      axis: screenAngle % 180 === 0 ? 'x' : 'y',
      style: {
        left: edge.x + outX * reach - TARGET_PX / 2,
        top: edge.y + outY * reach - TARGET_PX / 2,
        '--bar-x': `${-outX * (reach - 3)}px`,
        '--bar-y': `${-outY * (reach - 3)}px`,
        '--bar-turn': `${screenAngle}deg`,
      } as CSSProperties,
    };
  });

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-paragraph-editor=""
      data-busy={busy || undefined}
      data-composing={composition ? '' : undefined}
      data-preview={showPreview ? '' : undefined}
      data-angle={screenAngle}
    >
      {previewBox ? (
        <canvas
          ref={previewRef}
          className={styles.preview}
          data-testid="paragraph-preview"
          aria-hidden="true"
          style={previewBox}
        />
      ) : null}
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        data-testid="paragraph-canvas"
        aria-hidden="true"
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      />
      {/* The frame controls' parts follow the move (TXT-24); off, this wrapper has no box. */}
      <div
        className={framed ? styles.moving : styles.still}
        data-testid={framed ? 'paragraph-moving' : undefined}
        style={
          framed && moving ? { transform: `translate(${shift.x}px, ${shift.y}px)` } : undefined
        }
      >
        <div
          ref={frameRef}
          className={styles.frame}
          data-paragraph-frame=""
          data-overlap={movedOver || undefined}
          aria-hidden="true"
          // 3 px out from the paragraph on every side.
          style={{
            left: frameBox.left - 3,
            top: frameBox.top - 3,
            width: frameBox.width + 6,
            height: frameBox.height + 6,
          }}
        />
        {hideScene && !showPreview ? (
          <canvas
            ref={inkRef}
            className={styles.ink}
            data-testid="paragraph-ink"
            aria-hidden="true"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
        ) : null}
        {/*
         * The hidden mirror: keys, IME, clipboard and assistive technology. It lies over the
         * canvas, on the canvas's box, with its text in the drawn lines (`mirror-dom.ts`): a
         * point the browser resolves (iOS's keyboard trackpad, a tap) finds the mirror's text
         * there, not the canvas. Presses on it place the caret from the drawn lines.
         */}
        <div
          ref={mirrorRef}
          className={styles.mirror}
          role="textbox"
          aria-multiline="true"
          aria-label={m.paragraph_editor_label({ page: target.position })}
          aria-describedby={describedBy}
          aria-busy={busy || undefined}
          aria-readonly={value === null || busy || undefined}
          contentEditable={value !== null && !busy}
          suppressContentEditableWarning
          spellCheck={false}
          tabIndex={0}
          data-paragraph-mirror=""
          style={{
            left: box.left,
            top: box.top,
            width: Math.max(box.width, 1),
            height: Math.max(box.height, 1),
            fontSize: mirrorPx,
          }}
          onPointerDown={onPressDown}
          onPointerMove={onPressMove}
          onPointerUp={onPressUp}
          onPointerCancel={onPressUp}
          onKeyDown={onKeyDown}
          onCopy={(event) => onClipboard(event, false)}
          onCut={(event) => onClipboard(event, true)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            // Focus leaving the editor (Tab, another control) leaves it.
            const next = event.relatedTarget;
            if (next instanceof Element && next.closest('[data-paragraph-editor]')) return;
            if (next !== null) void leave();
          }}
          onCompositionStart={onCompositionStart}
          onCompositionUpdate={(event) => compose_(event.data, false)}
          onCompositionEnd={(event) => compose_(event.data, true)}
        />
        {canMove ? (
          <>
            {bands.map((edge) => (
              <div
                key={edge.name}
                className={styles.band}
                data-frame-control="move"
                aria-hidden="true"
                style={edge.style}
                onPointerDown={onFrameDown}
                onPointerMove={onFrameMove}
                onPointerUp={onFrameUp}
                onPointerCancel={onFrameUp}
              />
            ))}
            <div
              className={styles.grip}
              data-testid="paragraph-grip"
              data-edge={gripBelow ? 'bottom' : 'top'}
              data-frame-control="move"
              aria-hidden="true"
              title={m.paragraph_move_grip()}
              style={{
                left: frameBox.left + frameBox.width / 2 - GRIP_PX / 2,
                top: gripBelow ? frameBox.top + frameBox.height + 3 : frameBox.top - 3 - GRIP_PX,
              }}
              onPointerDown={onFrameDown}
              onPointerMove={onFrameMove}
              onPointerUp={onFrameUp}
              onPointerCancel={onFrameUp}
            />
            {canResize
              ? sideBars.map((bar) => (
                  <div
                    key={bar.side}
                    className={styles.bar}
                    data-testid={`paragraph-width-${bar.side}`}
                    data-frame-control={bar.side}
                    data-axis={bar.axis}
                    aria-hidden="true"
                    title={m.paragraph_width_handle()}
                    style={bar.style}
                    onPointerDown={onFrameDown}
                    onPointerMove={onFrameMove}
                    onPointerUp={onFrameUp}
                    onPointerCancel={onFrameUp}
                  />
                ))
              : null}
          </>
        ) : null}
      </div>
      {guide !== null ? (
        <div
          className={styles.guide}
          data-testid="paragraph-guide"
          aria-hidden="true"
          style={{ left: guide }}
        />
      ) : null}
      <div
        ref={headerRef}
        id={describedBy}
        className={styles.header}
        role="group"
        aria-label={m.paragraph_panel_label()}
        data-side={place.side}
        data-testid="paragraph-header"
        style={{
          left: place.left,
          top: place.top,
          ...(place.maxWidth === undefined ? {} : { maxWidth: place.maxWidth }),
        }}
      >
        <div className={styles.lines}>
          {honesty.map((line) => (
            <p key={line} className={styles.honesty} data-testid="paragraph-honesty">
              {line}
            </p>
          ))}
          {overflowLine ? (
            <p
              className={styles.overflow}
              data-kind={decision?.kind}
              data-testid="paragraph-overflow"
            >
              {overflowLine}
            </p>
          ) : null}
          {ragged ? <p className={styles.note}>{m.paragraph_ragged()}</p> : null}
          {frameNote ? <p className={styles.note}>{frameNote}</p> : null}
          {movedOver ? (
            <p
              className={styles.overflow}
              data-kind="overflow"
              data-testid="paragraph-move-overlap"
            >
              {m.paragraph_move_overlaps()}
            </p>
          ) : null}
          {shownError ? (
            <p className={styles.error} role="alert" data-testid="paragraph-error">
              {shownError}
            </p>
          ) : null}
          <p className={styles.hint}>
            {busy
              ? m.text_edit_applying()
              : value === null && !loadError
                ? m.paragraph_loading()
                : edition.hint()}
          </p>
        </div>
        {choice && movedOver && !(decision?.kind === 'overflow' && !decision.offPage) ? (
          <div
            className={styles.choice}
            role="group"
            aria-label={m.paragraph_move_overlaps()}
            data-testid="paragraph-choice"
          >
            <p className={styles.choiceText}>{m.paragraph_move_overlap_choice()}</p>
            <div className={styles.choiceActions}>
              <Button
                size="sm"
                data-testid="paragraph-overlap"
                onKeyDown={onChoiceKey}
                onClick={() => void leave('overlap')}
              >
                {m.paragraph_let_overlap()}
              </Button>
              <Button
                ref={keepEditingRef}
                size="sm"
                variant="prominent"
                data-default=""
                data-testid="paragraph-keep-editing"
                onKeyDown={onChoiceKey}
                onClick={keepEditing}
              >
                {m.paragraph_keep_editing()}
              </Button>
            </div>
          </div>
        ) : null}
        {choice && decision?.kind === 'overflow' && !decision.offPage ? (
          <div
            className={styles.choice}
            role="group"
            aria-label={m.paragraph_overflow()}
            data-testid="paragraph-choice"
          >
            <p className={styles.choiceText}>
              {decision.fit ? m.paragraph_overlap_choice() : m.paragraph_overlap_choice_no_fit()}
            </p>
            <div className={styles.choiceActions}>
              {decision.fit ? (
                <Button
                  size="sm"
                  data-testid="paragraph-tighten"
                  onKeyDown={onChoiceKey}
                  onClick={() => void leave('tighten')}
                >
                  {m.paragraph_tighten_fit()}
                </Button>
              ) : null}
              <Button
                size="sm"
                data-testid="paragraph-overlap"
                onKeyDown={onChoiceKey}
                onClick={() => void leave('overlap')}
              >
                {m.paragraph_let_overlap()}
              </Button>
              <Button
                ref={keepEditingRef}
                size="sm"
                variant="prominent"
                data-default=""
                data-testid="paragraph-keep-editing"
                onKeyDown={onChoiceKey}
                onClick={keepEditing}
              >
                {m.paragraph_keep_editing()}
              </Button>
            </div>
          </div>
        ) : null}
        <div className={styles.actions}>
          <Popover.Root>
            <Popover.Trigger
              render={
                <IconButton
                  size="row"
                  label={m.paragraph_info_label()}
                  icon={<Icon name="info" />}
                  data-testid="paragraph-info"
                />
              }
            />
            <PopoverPopup side="bottom" align="end" data-paragraph-editor="">
              <PopoverHeader title={m.paragraph_info_label()} />
              <PopoverBody>{m.paragraph_info_text()}</PopoverBody>
            </PopoverPopup>
          </Popover.Root>
        </div>
      </div>
    </div>
  );
}
