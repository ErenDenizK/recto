/**
 * Link hotspots over a page (spec §1). Links are read through the engine's read-only
 * `listAnnotations` (kind 'link') for pages near the viewport.
 *
 * - Internal links (`targetPageIndex`, a page of the same source) scroll Read mode to that
 *   page when it is in the active document.
 * - URI links never navigate silently: the hotspot names the destination (tooltip and
 *   accessible name) and a click opens a confirmation popover; only its "Open" button
 *   opens a new tab, with `noopener`.
 *
 * Links are in the one hit order after form widgets (05-canvas §6, spec 05.7): hotspots are live
 * wherever the hit router makes links live (viewing, Markup with Select, Locked), so drawing
 * tools draw over links. A press on a link that travels past the slop (`linkDragSelects`: 4 px
 * for a mouse, 3 for a pen, 10 for touch) becomes a text selection from the press point and the
 * link is not followed.
 */
import { Popover } from '@base-ui/react/popover';
import type { SourceId } from '@pdf-editor/document-model';
import type { Annotation, LinkAnnotation } from '@pdf-editor/engine';
import { type PointerEvent as ReactPointerEvent, useEffect, useState } from 'react';

import { getEngineService } from '../engine/engine-service';
import { m } from '../i18n';
import { openableUrl } from '../shell/OutlinePanel.tree';
import type { PageOverlayProps } from '../stage/page-overlays';
import { distanceFromView, useViewStore } from '../state/view-store';
import { useActiveDocument } from '../state/workspace-store';
import { PopoverBody, PopoverHeader, PopoverPopup } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { userRectToCss } from './geometry';
import { isLive, linkDragSelects } from './hit-order';
import { usePageInput } from './input-state';
import styles from './LinkLayer.module.css';
import { pageFrame } from './page-frame';

const MAX_CACHED_PAGES = 300;
const links = new Map<string, Promise<readonly LinkAnnotation[]>>();

function isLink(annotation: Annotation): annotation is LinkAnnotation {
  return annotation.kind === 'link';
}

/** Link annotations of a source page (memoized; failures are not kept). */
export function pageLinks(sourceId: SourceId, index: number): Promise<readonly LinkAnnotation[]> {
  const key = `${sourceId}:${index}`;
  const cached = links.get(key);
  if (cached) return cached;
  const pending = getEngineService()
    .editor()
    .then((editor) => editor.listAnnotations(sourceId, index))
    .then((annotations) => annotations.filter(isLink));
  pending.catch(() => links.delete(key));
  links.set(key, pending);
  if (links.size > MAX_CACHED_PAGES) {
    const oldest = links.keys().next().value;
    if (oldest !== undefined) links.delete(oldest);
  }
  return pending;
}

/** Forgets the cached links of a source (call when it closes; its ids are never reused). */
export function clearLinksForSource(sourceId: SourceId): void {
  const prefix = `${sourceId}:`;
  for (const key of [...links.keys()]) {
    if (key.startsWith(prefix)) links.delete(key);
  }
}

export function LinkLayer(props: PageOverlayProps) {
  const { sourceId, sourceIndex, pageIndex } = props;
  const near = useViewStore((s) => distanceFromView(pageIndex, s.visibleRange) <= 1);
  const live = isLive('link', usePageInput().state);
  const doc = useActiveDocument();
  const [found, setFound] = useState<{
    key: string;
    links: readonly LinkAnnotation[];
  } | null>(null);
  const key = `${sourceId ?? ''}:${sourceIndex}`;

  useEffect(() => {
    if (!near || sourceId === undefined) return;
    let cancelled = false;
    pageLinks(sourceId, sourceIndex).then(
      (list) => {
        if (!cancelled) setFound({ key, links: list });
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [near, sourceId, sourceIndex, key]);

  if (found?.key !== key || found.links.length === 0 || !doc) return null;
  const frame = pageFrame(props);

  return (
    <div className={styles.layer} data-live={live} data-testid="link-layer">
      {found.links.map((link) => {
        if (link.flags?.hidden) return null;
        const box = userRectToCss(frame, link.rect);
        const style = { left: box.left, top: box.top, width: box.width, height: box.height };
        if (link.targetPageIndex !== undefined) {
          const targetIndex = doc.pages.findIndex(
            (page) =>
              page.ref.kind === 'source' &&
              page.ref.source === sourceId &&
              page.ref.index === link.targetPageIndex,
          );
          const target = doc.pages[targetIndex];
          const label = target
            ? m.viewer_link_page({ page: targetIndex + 1 })
            : m.viewer_link_missing();
          return (
            <Tooltip key={link.id} label={label}>
              <button
                type="button"
                className={styles.hotspot}
                style={style}
                aria-label={label}
                aria-disabled={target === undefined || undefined}
                tabIndex={live ? 0 : -1}
                data-link="internal"
                onPointerDown={selectPastSlop}
                onClick={() => {
                  if (target) useViewStore.getState().scrollToPage(target.id);
                }}
              />
            </Tooltip>
          );
        }
        if (link.uri !== undefined) {
          return <UriHotspot key={link.id} uri={link.uri} style={style} tabIndex={live ? 0 : -1} />;
        }
        return null;
      })}
    </div>
  );
}

/** What finds a caret under a point: the standard API, or WebKit's older one. */
interface CaretLookup {
  readonly caretPositionFromPoint:
    | ((x: number, y: number) => { readonly offsetNode: Node; readonly offset: number } | null)
    | undefined;
  /** Safari before `caretPositionFromPoint` (the DOM typings mark it deprecated). */
  readonly rangeFromPoint: ((x: number, y: number) => Range | null) | undefined;
}

/** The text position under a viewport point, or null. */
function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Partial<Document>;
  const lookup: CaretLookup = {
    caretPositionFromPoint: doc.caretPositionFromPoint?.bind(document),
    rangeFromPoint: (
      Reflect.get(document, 'caretRangeFromPoint') as CaretLookup['rangeFromPoint']
    )?.bind(document),
  };
  const position = lookup.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = lookup.rangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

/**
 * A press on a link (05-canvas §6, spec 05.7): while it stays within the slop it is a click
 * that follows the link; once it travels past, the hotspots let the pointer through, the text
 * from the press point to the pointer is selected as a drag would select it, and the click
 * that ends the press is swallowed, so the link is not followed.
 */
function selectPastSlop(event: ReactPointerEvent<HTMLElement>): void {
  if (event.button !== 0 || !event.isPrimary) return;
  const hotspot = event.currentTarget;
  const layer = hotspot.parentElement;
  const start = { x: event.clientX, y: event.clientY };
  const { pointerId, pointerType } = event;
  let anchor: { node: Node; offset: number } | null = null;
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    if (anchor === null) {
      if (!linkDragSelects(pointerType, e.clientX - start.x, e.clientY - start.y)) return;
      if (layer) layer.dataset.selecting = '';
      anchor = caretAt(start.x, start.y);
      if (anchor === null) return;
    }
    const focus = caretAt(e.clientX, e.clientY);
    if (focus)
      window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
  };
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  // Whichever of these the engine delivers first ends the press: WebKit has been seen not to
  // deliver `pointerup` to the window once a selection drag began, which left `data-selecting`
  // (and the hotspots without pointer events) on. Captured, so nothing stops them on the way.
  const ENDS = ['pointerup', 'pointercancel', 'mouseup', 'dragend'] as const;
  const capture = { capture: true } as const;
  const end = (e: Event) => {
    if (e instanceof PointerEvent && e.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', move);
    for (const type of ENDS) window.removeEventListener(type, end, capture);
    if (layer?.dataset.selecting === undefined) return;
    // The click of this press (it lands on the hotspot) does not follow the link.
    hotspot.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => {
      hotspot.removeEventListener('click', swallow, { capture: true });
      delete layer.dataset.selecting;
    });
  };
  window.addEventListener('pointermove', move);
  for (const type of ENDS) window.addEventListener(type, end, capture);
}

function UriHotspot({
  uri,
  style,
  tabIndex,
}: {
  readonly uri: string;
  readonly style: { left: number; top: number; width: number; height: number };
  readonly tabIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const url = openableUrl(uri);
  const label = m.viewer_link_external({ uri });
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip label={uri}>
        <Popover.Trigger
          className={styles.hotspot}
          style={style}
          aria-label={label}
          tabIndex={tabIndex}
          data-link="uri"
          onPointerDown={selectPastSlop}
        />
      </Tooltip>
      <PopoverPopup side="bottom" align="start" sideOffset={6} data-testid="link-confirm">
        <PopoverHeader
          close={false}
          title={url ? m.viewer_link_confirm_title() : m.viewer_link_unsupported()}
        />
        <p className={styles.url} title={uri}>
          {uri}
        </p>
        {url ? (
          <PopoverBody>
            {m.viewer_link_confirm_body({
              host: url.protocol === 'mailto:' ? url.pathname : url.host,
            })}
          </PopoverBody>
        ) : null}
        <div className={styles.actions}>
          <Popover.Close className={styles.secondary}>
            {url ? m.common_cancel() : m.common_close()}
          </Popover.Close>
          {url ? (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                window.open(url.href, '_blank', 'noopener,noreferrer');
                setOpen(false);
              }}
            >
              {m.viewer_link_open()}
            </button>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover.Root>
  );
}
