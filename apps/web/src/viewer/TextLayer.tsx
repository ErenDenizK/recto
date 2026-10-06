/**
 * Text layer (spec §1, §8, §9): the page's text as transparent DOM spans over the bitmap,
 * one span per engine text run, positioned from glyph geometry and stretched to the run's
 * width. It gives native selection (double-click word, triple-click line, drag across
 * pages), copy with sensible spaces and line breaks (see `installCopyHandler`), and the
 * page's readable content for assistive technology.
 *
 * Built for pages within one page of the viewport, kept while within three, dropped
 * beyond. Selectable only while text selection is live in the hit router (`hit-order.ts`:
 * viewing, Markup with Select, and Locked; never with a drawing tool, whose pointer draws).
 *
 * The double-click asymmetry (flows §3.2, 05-canvas §6, §9): in viewing and when locked a
 * double-click selects a word, as on any page. Only in Markup with Select, where the person
 * has chosen to change the document, is this layer also the door to the paragraph editor and
 * its hover hint: a double-click on page text from a mouse, or from a pen while no pen draws
 * (spec 05.12), opens the editor with the caret at the point (`openTextEditorAt`); never from
 * touch. After 400 ms of idle hover (no button down, mouse or pen, not within 500 ms of a pen
 * stroke) over page text there, an outline marks the paragraph under the pointer; a target
 * above the text in the hit order (annotation, field, link, image) shows none, and none shows
 * while a paragraph editor is open. Until the first such double-click, the outline brings a
 * one-line hint, "Double-click to edit text", once per device (`input-policy-store.ts`). A
 * single click on page text brings the same hint at once, below the clicked line, so a person
 * who expects a click to open the paragraph learns the gesture (review finding 3). With the
 * Edit text tool the tool's own targets are the affordance (`text-edit/`), so no outline.
 */
import type { TextRun } from '@pdf-editor/engine';
import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { cssPointToUser } from '../annotations/geometry';
import { getEngineService } from '../engine/engine-service';
import { m } from '../i18n';
import type { PageOverlayProps } from '../stage/page-overlays';
import { useInputPolicyStore } from '../state/input-policy-store';
import { distanceFromView, useViewStore } from '../state/view-store';
import { openTextEditorAt } from '../text-edit/entry';
import { useParagraphBoxAt, useTextEditStore } from '../text-edit/text-edit-store';
import { penDrawsNow, pointerLog } from './edit-policy';
import {
  doubleClickOpensEditor,
  HOVER_DELAY_MS,
  hitAt,
  hitKindOf,
  hoverAllowed,
  hoverOutlines,
  isLive,
} from './hit-order';
import { pageInputNow, usePageInput } from './input-state';
import { pageFrame } from './page-frame';
import {
  layoutTextLines,
  separatorAfter,
  TEXT_LAYER_ATTR,
  TEXT_ROW_ATTR,
  type TextLine,
} from './text-model';
import styles from './TextLayer.module.css';
import { lineStyle } from './text-spans';

// The span geometry and the copy handler live in text-spans.ts, shared with the compact
// edition's reader; ReadView imports the copy handler from here.
export { installCopyHandler } from './text-spans';

/** Build within this many pages of the viewport; drop beyond DROP_DISTANCE. */
export const BUILD_DISTANCE = 1;
export const DROP_DISTANCE = 3;
/** A pointer this close to a line's box (CSS px) is over it, for the hover outline. */
const HOVER_SLOP_PX = 2;
/** Gap between the outlined run and the hint below it, CSS px. */
const HINT_GAP_PX = 4;

/** Index of the line whose box holds `p` (CSS px of the page), or -1. */
export function lineAt(lines: readonly TextLine[], p: { x: number; y: number }): number {
  for (let i = 0; i < lines.length; i++) {
    const box = lines[i]?.box;
    if (!box) continue;
    if (
      p.x >= box.left - HOVER_SLOP_PX &&
      p.x <= box.left + box.width + HOVER_SLOP_PX &&
      p.y >= box.top - HOVER_SLOP_PX &&
      p.y <= box.top + box.height + HOVER_SLOP_PX
    ) {
      return i;
    }
  }
  return -1;
}

export function TextLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageIndex, pageId } = props;
  const distance = useViewStore((s) => distanceFromView(pageIndex, s.visibleRange));
  const { state } = usePageInput();
  const selectable = isLive('text-selection', state);
  // The idle hover outline: only where a double-click edits, Markup with Select (05-canvas
  // §9), and never over an open paragraph editor (its own glyphs and caret are the affordance
  // then).
  const paragraphOpen = useTextEditStore((s) => s.paragraph !== null);
  const hovering = hoverOutlines(state) && !paragraphOpen;
  const hintShown = useInputPolicyStore((s) => s.editTextHintShown);
  const [hover, setHover] = useState<{ readonly key: string; readonly line: number } | null>(null);
  // The first-click hint (module header): where it shows, until the next press.
  const [clickHint, setClickHint] = useState<{
    readonly key: string;
    readonly left: number;
    readonly top: number;
  } | null>(null);
  const [built, setBuilt] = useState(false);
  const [runs, setRuns] = useState<{
    key: string;
    page: string;
    runs: readonly TextRun[];
  } | null>(null);

  // Hysteresis: build near the viewport, keep until clearly away (spec §8).
  if (!built && distance <= BUILD_DISTANCE && sourceId !== undefined) setBuilt(true);
  if (built && distance > DROP_DISTANCE) setBuilt(false);

  // The page's content revision: a text edit changes its text (and bumps the revision).
  const service = getEngineService();
  const revision = useSyncExternalStore(service.subscribeRevisions, () =>
    sourceId === undefined ? 0 : service.pageRevision(sourceId, sourceIndex),
  );
  const page = `${sourceId ?? ''}:${sourceIndex}`;
  const key = `${page}:${revision}`;
  const layerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<readonly TextLine[]>([]);
  const hasLayer = built && runs?.page === page;

  // The idle hover outline (craft spec §3.5). Follows the pointer over the page's overlays
  // (the page container can be re-created under a mounted layer, so it listens on the
  // document), which also covers the Edit text tool's run targets above this layer.
  useEffect(() => {
    if (!hovering || !hasLayer) return;
    let timer: number | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      setHover((h) => (h === null ? h : null));
    };
    const onMove = (event: PointerEvent) => {
      window.clearTimeout(timer);
      const layer = layerRef.current;
      const overlays = layer?.parentElement;
      if (
        !layer ||
        !(event.target instanceof Node) ||
        !overlays?.contains(event.target) ||
        !hoverAllowed(event, performance.now(), pointerLog.lastPenUpAt)
      ) {
        hide();
        return;
      }
      // A target above the text in the hit order owns the point.
      const kind = hitKindOf(event.target instanceof Element ? event.target : null);
      if (kind === 'annotation' || kind === 'form-widget' || kind === 'image') {
        hide();
        return;
      }
      const r = layer.getBoundingClientRect();
      const line = lineAt(linesRef.current, {
        x: event.clientX - r.left,
        y: event.clientY - r.top,
      });
      setHover((h) => (h === null || h.line === line ? h : null));
      if (line < 0) return;
      timer = window.setTimeout(() => setHover({ key, line }), HOVER_DELAY_MS);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', hide, { capture: true, passive: true });
    document.addEventListener('pointerleave', hide);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', hide, { capture: true });
      document.removeEventListener('pointerleave', hide);
      hide();
    };
  }, [hovering, hasLayer, key]);

  // The first-click hint goes with the next press anywhere.
  useEffect(() => {
    if (clickHint === null) return;
    const clear = () => setClickHint(null);
    document.addEventListener('pointerdown', clear, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', clear, { capture: true });
  }, [clickHint]);

  // While dragging a selection, the whole layer catches the pointer so the selection does
  // not jump to the page gap or to other elements (pdf.js "endOfContent").
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !selectable) return;
    const done = () => {
      delete layer.dataset.selecting;
      window.removeEventListener('pointerup', done);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      layer.dataset.selecting = 'true';
      window.addEventListener('pointerup', done);
    };
    layer.addEventListener('mousedown', onMouseDown);
    return () => {
      layer.removeEventListener('mousedown', onMouseDown);
      done();
    };
  });

  useEffect(() => {
    if (!built || sourceId === undefined) return;
    const controller = new AbortController();
    void getEngineService()
      .getPageText(sourceId, sourceIndex, controller.signal)
      .then((result) => {
        if (result.ok) setRuns({ key, page, runs: result.value });
      });
    return () => controller.abort();
  }, [built, sourceId, sourceIndex, key, page]);

  const frame = pageFrame(props);
  const lines = hasLayer && runs ? layoutTextLines(runs.runs, frame) : [];
  useEffect(() => {
    linesRef.current = lines;
  });
  // The hover outline marks the paragraph that would open, once the page's paragraphs are
  // known; the line until then (review finding 11).
  const hoveredBox = hover?.key === key && hovering ? lines[hover.line]?.box : undefined;
  const paragraphBox = useParagraphBoxAt(
    sourceId,
    sourceIndex,
    frame,
    hoveredBox
      ? { x: hoveredBox.left + hoveredBox.width / 2, y: hoveredBox.top + hoveredBox.height / 2 }
      : undefined,
  );

  // Markup with Select, before the first double-click: a plain click on text shows the hint.
  const clickHints = hovering && !hintShown;
  const layerShown = lines.length > 0;
  useEffect(() => {
    const layer = layerRef.current;
    if (!clickHints || !layerShown || !layer) return;
    const onClick = (event: MouseEvent) => {
      if (event.detail !== 1 || event.button !== 0) return;
      if (!window.getSelection()?.isCollapsed) return;
      if (hitAt(event.clientX, event.clientY)?.kind !== 'text-selection') return;
      const r = layer.getBoundingClientRect();
      const p = { x: event.clientX - r.left, y: event.clientY - r.top };
      const box = linesRef.current[lineAt(linesRef.current, p)]?.box;
      if (box) setClickHint({ key, left: p.x, top: box.top + box.height + HINT_GAP_PX });
    };
    layer.addEventListener('click', onClick);
    return () => layer.removeEventListener('click', onClick);
  }, [clickHints, layerShown, key]);

  // A new revision keeps showing the previous text until the new text arrives.
  if (!hasLayer || lines.length === 0) return null;

  /**
   * Markup with Select: a double-click on page text opens the editor with the caret there.
   * Elsewhere the browser's own double-click selects the word (the asymmetry, flows §3.2).
   */
  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (sourceId === undefined || event.button !== 0) return;
    if (!doubleClickOpensEditor(pageInputNow(), pointerLog.lastDownType, penDrawsNow())) return;
    // The one hit order: only when page text is what is under the pointer.
    if (hitAt(event.clientX, event.clientY)?.kind !== 'text-selection') return;
    const r = event.currentTarget.getBoundingClientRect();
    const point = cssPointToUser(frame, { x: event.clientX - r.left, y: event.clientY - r.top });
    // The editor takes the place of the word the double-click selected.
    window.getSelection()?.removeAllRanges();
    useInputPolicyStore.getState().markEditTextHintShown();
    setHover(null);
    void openTextEditorAt(
      { source: sourceId, pageIndex: sourceIndex, pageId, position: pageIndex + 1 },
      point,
    );
  };

  const outlined = hover?.key === key && hovering ? lines[hover.line] : undefined;
  const hint = outlined !== undefined && !hintShown;

  return (
    <>
      <div
        className={styles.layer}
        {...{ [TEXT_LAYER_ATTR]: String(pageIndex) }}
        data-selectable={selectable}
        data-testid="text-layer"
        ref={layerRef}
        onDoubleClick={onDoubleClick}
      >
        {lines.map((line, i) => {
          const separator = separatorAfter(lines, i);
          return (
            <Fragment key={i}>
              <span {...{ [TEXT_ROW_ATTR]: line.row }} style={lineStyle(line)}>
                {line.text}
              </span>
              {separator === '' ? null : <span className={styles.separator}>{separator}</span>}
            </Fragment>
          );
        })}
        <div className={styles.end} aria-hidden="true" />
      </div>
      {hovering ? (
        <div className={styles.hover} data-text-hover="">
          {outlined ? (
            <div
              className={styles.outline}
              data-testid="text-hover-outline"
              aria-hidden="true"
              style={{
                left: (paragraphBox ?? outlined.box).left,
                top: (paragraphBox ?? outlined.box).top,
                width: (paragraphBox ?? outlined.box).width,
                height: (paragraphBox ?? outlined.box).height,
              }}
              data-unit={paragraphBox ? 'paragraph' : 'line'}
            />
          ) : null}
          {!hintShown ? (
            <div className={styles.hintStatus} role="status">
              {hint && outlined ? (
                <span
                  className={styles.hint}
                  style={{
                    left: outlined.box.left,
                    top: outlined.box.top + outlined.box.height + HINT_GAP_PX,
                  }}
                >
                  {m.edit_text_hint()}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {clickHint?.key === key && hovering && !hintShown && !hint ? (
        <div className={styles.hover} data-text-click-hint="">
          <div className={styles.hintStatus} role="status">
            <span className={styles.hint} style={{ left: clickHint.left, top: clickHint.top }}>
              {m.edit_text_hint()}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
