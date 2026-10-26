/**
 * The Text view over the reader, in the lazy chunk (PRD-36, EDN-26): the door
 * (`textview-host.tsx`) imports this on intent only. It hands the view its data and follows the
 * stores while it shows: Go to page, Contents and Find move it (`jump`), and Find's current hit
 * is marked in its text (`mark`, `textview/find-map.ts`). Jumps older than the view are not its
 * own, and the same mark or jump keeps its identity so the view acts on a change only.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import type { FindMark, TextViewPlace } from '../../textview';
import { TextView } from '../../textview';
import { markForHit } from '../../textview/find-map';
import { userToDisplay } from '../../textview/position';
import { openTextViewSession, type TextViewSession } from '../../textview/session';
import { useSearchStore } from '../../viewer/search';
import { m } from '../../i18n';
import { announce } from '../announcer';
import { openFind, openSheet, setTextView, useCompactStore } from './compact-store';
import { PAGE_GAP } from './reader-layout';
import type { TextViewReader } from './textview-host';

/**
 * The place under the reader's top bar, in the page's display space (points from the page's
 * top): where the Text view opens. Without a reader, the top of the current page.
 */
export function readerPlace(reader: TextViewReader | null, current: number): TextViewPlace {
  if (!reader) return { page: current, y: 0 };
  const { layout, frame } = reader.latest();
  const line = reader.scroller.scrollTop + frame.padTop;
  let page = layout.boxes.findIndex((box) => line < box.top + box.height + PAGE_GAP);
  if (page < 0) page = Math.max(0, layout.boxes.length - 1);
  const box = layout.boxes[page];
  return { page, y: box ? Math.max(0, (line - box.top) / layout.scale) : 0 };
}

/** Scrolls the reader so `place` shows under its top bar (leaving the Text view). */
export function showReaderAt(reader: TextViewReader, place: TextViewPlace): void {
  const { layout, frame } = reader.latest();
  const box = layout.boxes[place.page];
  if (!box) return;
  reader.scrollTo(
    reader.scroller.scrollLeft,
    Math.max(0, box.top + place.y * layout.scale - frame.padTop),
  );
}

interface Jump {
  readonly id: number;
  readonly place: TextViewPlace;
}

/** A request to the reader to show a page, as a place for the view (Go to page, Contents, Find). */
function jumpOf(
  doc: VirtualDocument,
  session: TextViewSession,
  request: NonNullable<ReturnType<typeof useViewStore.getState>['scrollRequest']>,
): TextViewPlace | null {
  const page = doc.pages.findIndex((candidate) => candidate.id === request.pageId);
  if (page < 0) return null;
  if (request.reveal === undefined) return { page, y: 0 };
  // A region (a Find hit): a little above it, so its line has company.
  const box = userToDisplay(session.loader.frame(page), request.reveal);
  return { page, y: Math.max(0, box.y - 40) };
}

/** Find's current hit as a mark in the text, while Find shows. */
function markOf(doc: VirtualDocument, session: TextViewSession): FindMark | null {
  if (!useCompactStore.getState().findOpen) return null;
  const { hits, current } = useSearchStore.getState();
  const hit = hits[current];
  if (!hit) return null;
  const page = doc.pages.findIndex((candidate) => candidate.id === hit.pageId);
  const data = page < 0 ? undefined : session.loader.peek(page);
  if (data === undefined || typeof data === 'string') return null;
  const onPage = hits.filter((other) => other.pageId === hit.pageId);
  return markForHit(hit, onPage, data, session.loader.frame(page)) ?? null;
}

interface Live {
  readonly session: TextViewSession;
  readonly place: TextViewPlace;
  /** The view store's last scroll request when the view opened: older ones are not its jumps. */
  readonly serial: number;
}

/** The place at the top of the view, as it last reported (`onPlace`). */
let where: TextViewPlace | undefined;

function remember(next: TextViewPlace): void {
  where = next;
  useViewStore.getState().setCurrentPage(next.page);
}

let live: Live | null = null;
let starting = false;

/**
 * Leaves for the page view: the reader moves to `place` and takes focus, the view goes. The data
 * is released and "Page view" said when the flag falls (`ended`), not when the view unmounts:
 * React's dev double effect unmounts it once on open.
 */
function close(reader: TextViewReader | null, place: TextViewPlace): void {
  if (reader) showReaderAt(reader, place);
  flushSync(() => setTextView(false));
  reader?.scroller.focus({ preventScroll: true });
}

/** The view is gone (closed, or the Library took the place): its lease ends. */
useCompactStore.subscribe((state, before) => {
  if (!before.textView || state.textView) return;
  live?.session.dispose();
  live = null;
  // Leaving for the Library is not a return to the page view.
  if (state.place === 'reader') announce(m.text_view_closed({ page: (where?.page ?? 0) + 1 }));
});

/**
 * The title menu's row: opens the Text view from the reader's top place (after its data is
 * here), or leaves it. A failure to open the data is announced; the page view stays.
 */
export async function toggleTextView(
  doc: VirtualDocument,
  reader: TextViewReader | null,
): Promise<void> {
  if (useCompactStore.getState().textView) {
    close(reader, where ?? readerPlace(reader, useViewStore.getState().currentPage));
    return;
  }
  if (starting) return;
  starting = true;
  // At the tap: the data takes a moment (the worker starts), and nothing else says so.
  announce(m.text_view_loading());
  try {
    const session = await openTextViewSession(doc.id);
    // Left for the Library, or another document, while the data was coming.
    if (
      useCompactStore.getState().place !== 'reader' ||
      useWorkspaceStore.getState().workspace.activeDocument !== doc.id
    ) {
      session.dispose();
      return;
    }
    const place = readerPlace(reader, useViewStore.getState().currentPage);
    where = place;
    live = {
      session,
      place,
      serial: useViewStore.getState().scrollRequest?.serial ?? 0,
    };
    setTextView(true);
  } catch {
    // The data could not be opened: the page view stays, and says so.
    announce(m.text_view_failed());
  } finally {
    starting = false;
  }
}

export function TextViewShown({
  doc,
  reader,
}: {
  readonly doc: VirtualDocument;
  readonly reader: TextViewReader | null;
}) {
  const data = live;
  if (!data) return null;
  return <Shown doc={doc} reader={reader} data={data} />;
}

function Shown({
  doc,
  reader,
  data,
}: {
  readonly doc: VirtualDocument;
  readonly reader: TextViewReader | null;
  readonly data: Live;
}) {
  const { session, place, serial } = data;
  const findOpen = useCompactStore((s) => s.findOpen);
  const onClose = (to: TextViewPlace) => close(reader, to);
  // The mark and the jump follow Find, the view store and the loader (a page arriving). The same
  // mark or jump keeps its identity, so the view acts on a change only.
  const [mark, setMark] = useState<FindMark | null>(null);
  const [jump, setJump] = useState<Jump | null>(null);
  useEffect(() => {
    const update = () => {
      const next = markOf(doc, session);
      setMark((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
      const request = useViewStore.getState().scrollRequest;
      if (!request || request.serial <= serial) return;
      const to = jumpOf(doc, session, request);
      if (to)
        setJump((was) => (was?.id === request.serial ? was : { id: request.serial, place: to }));
    };
    update();
    const stops = [
      useSearchStore.subscribe(update),
      useViewStore.subscribe(update),
      useCompactStore.subscribe(update),
      session.loader.subscribe(update),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, [doc, session, serial]);
  // Where the view is, for Esc.
  const at = useRef(place);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const state = useCompactStore.getState();
      // Esc closes what is on top first: a sheet, the menu, Find, the Aa popover.
      if (state.sheet !== null || state.menuOpen || state.findOpen) return;
      if (document.querySelector('[data-testid="text-view-options-popup"]')) return;
      close(reader, at.current);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reader]);
  return (
    <TextView
      title={doc.title}
      loader={session.loader}
      crops={session.crops}
      ocr={session.ocr}
      place={place}
      jump={jump}
      mark={mark}
      hidden={false}
      barAway={findOpen}
      onPlace={(next) => {
        at.current = next;
        remember(next);
      }}
      onPageView={onClose}
      onGoto={() => openSheet('goto')}
      onFind={openFind}
      onShowPage={onClose}
    />
  );
}
