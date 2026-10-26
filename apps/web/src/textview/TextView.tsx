/**
 * The phone's Text view (PRD-36, EDN-26, DSN-84; BM-5): the document reflowed as readable text,
 * a place over the reader. One `<article>` is the scroll region, a section per page; pages are
 * read in chunks through the loader as they come within two screens, and each section skips its
 * layout until it is near (`content-visibility`). The view is read-only (BM-15) and takes its
 * chrome through `TextViewHostProps`; it imports nothing from the shell and never carries the
 * text-layer attribute, so the editing chunk is never reached from here.
 *
 * - **Looks (DSN-84).** The root re-scopes the app's tokens with `data-theme` to the reader's
 *   look (Auto follows the app), so buttons and glass inside it read on it; the column's own
 *   colours are the `--reader-*` tokens. Size, spacing and face are CSS variables on the root,
 *   so a change reflows without a re-render of the pages.
 * - **Place (PRD-36 "Keeping the place").** `place` opens the view at that block, `jump` moves
 *   it (Go to page, Contents, Find), and the block at the top, with how far into it, is held
 *   across size changes and above-the-fold loads by hand, as Safari has no `overflow-anchor`.
 *   The column reports the place at its top through `onPlace`.
 * - **Pinch** steps the size one step per ×1.15 of finger spread (direct manipulation: it
 *   moves under reduced motion as well).
 * - **Open** moves focus to the column and says "Text view, page n"; hiding it says "Page view,
 *   page n" (A11y, PRD-36 §7).
 */
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { systemTheme, type Theme } from '../state/theme';
import type { OcrOfferInfo, TextViewHostProps, TextViewLoader, TextViewPlace } from './contract';
import { anchorAt } from './position';
import { LINE_HEIGHTS, setReadingPrefs, TEXT_SIZES, useReadingPrefs } from './reading-prefs';
import { type ScanControl, ScanPrompt, TextPage } from './TextPage';
import styles from './TextView.module.css';
import { TextViewBar } from './TextViewBar';

/** How long a place being reached is held against pages changing size. */
const SETTLE_MS = 1500;

/** Finger spread that makes one size step (PRD-36 §4). */
export const PINCH_STEP = 1.15;

/** +1 or -1 when the spread has grown or shrunk by one step from `base`, else 0. */
export function pinchStep(base: number, distance: number): 1 | -1 | 0 {
  if (base <= 0) return 0;
  if (distance / base >= PINCH_STEP) return 1;
  if (distance / base <= 1 / PINCH_STEP) return -1;
  return 0;
}

function subscribeAppTheme(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function appTheme(): Theme {
  const set = document.documentElement.getAttribute('data-theme');
  return set === 'light' || set === 'dark' ? set : systemTheme();
}

/** Whether every page read so far is a scan, once a whole first chunk has been read. */
function everyPageIsScan(loader: TextViewLoader): boolean {
  let read = 0;
  let scans = 0;
  for (let index = 0; index < loader.pageCount; index++) {
    const state = loader.peek(index);
    if (typeof state !== 'object') continue;
    read += 1;
    if (state.needsOcr) scans += 1;
  }
  return read > 0 && scans === read && read >= Math.min(loader.pageCount, 4);
}

/** What sits at the top of the column: the held block and how far into it (a ratio). */
interface Held {
  readonly element: HTMLElement;
  readonly ratio: number;
}

export function TextView(props: TextViewHostProps) {
  const { title, loader, crops, ocr, place, jump, mark, hidden } = props;
  const prefs = useReadingPrefs();
  const app = useSyncExternalStore(subscribeAppTheme, appTheme);
  const look: Theme = prefs.theme === 'auto' ? app : prefs.theme;
  const px = TEXT_SIZES[prefs.size] ?? TEXT_SIZES[2];

  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const held = useRef<Held | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const current = useRef<TextViewPlace>(place);
  const [page, setPage] = useState(place.page);
  const [version, setVersion] = useState(0);
  const pageCount = useSyncExternalStore(
    (listener) => loader.subscribe(listener),
    () => loader.pageCount,
  );
  // Every page read so far is a scan: one card at the top, not one per page.
  const allScans = useSyncExternalStore(
    (listener) => loader.subscribe(listener),
    () => everyPageIsScan(loader),
  );

  // ── Where things are ──────────────────────────────────────────────────────────────────
  const topline = () => {
    const element = scroller.current;
    if (!element) return 0;
    return (
      element.getBoundingClientRect().top +
      (Number.parseFloat(getComputedStyle(element).scrollPaddingTop) || 0)
    );
  };

  const pageElement = (index: number) =>
    scroller.current?.querySelector<HTMLElement>(`section[data-page="${index}"]`) ?? null;

  /** The anchor under the top line, found by hit-testing a few points below it. */
  const record = () => {
    const element = scroller.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const top = topline();
    for (const dy of [2, 12, 24, 40, 64]) {
      const hit = document
        .elementsFromPoint(box.left + box.width / 2, top + dy)
        .find((candidate) => element.contains(candidate) && candidate.closest('[data-anchor]'));
      const anchor = hit?.closest<HTMLElement>('[data-anchor]');
      if (!anchor || !element.contains(anchor)) continue;
      const rect = anchor.getBoundingClientRect();
      const ratio = rect.height > 0 ? Math.min(1, Math.max(0, (top - rect.top) / rect.height)) : 0;
      held.current = { element: anchor, ratio };
      const index = Number(anchor.dataset.page ?? 0);
      const y = Number(anchor.dataset.y ?? 0) + ratio * Number(anchor.dataset.h ?? 0);
      setPage(index);
      const last = current.current;
      current.current = { page: index, y };
      if (index !== last.page || Math.abs(y - last.y) >= 1)
        latest.current.onPlace({ page: index, y });
      return;
    }
  };

  /** Puts the held block back where it was: after a size change or a load above it. */
  const restore = () => {
    const element = scroller.current;
    const current = held.current;
    if (!element || !current?.element.isConnected) return;
    const rect = current.element.getBoundingClientRect();
    const delta = rect.top - (topline() - current.ratio * rect.height);
    if (Math.abs(delta) > 0.5) element.scrollTop += delta;
  };

  // ── Going to a place ──────────────────────────────────────────────────────────────────
  /**
   * A place being reached. The pages around it skip their layout and stand in with an estimate
   * until they are near, so the place is looked for again whenever a page changes size, until
   * the reader touches the column or a moment has passed.
   */
  const pending = useRef<TextViewPlace | null>(null);
  const forced = useRef<HTMLElement | null>(null);
  const settling = useRef(0);

  const stopSettling = () => {
    window.clearTimeout(settling.current);
    pending.current = null;
    if (forced.current) forced.current.style.contentVisibility = '';
    forced.current = null;
  };

  const apply = () => {
    const target = pending.current;
    const element = scroller.current;
    if (!target || !element) return;
    const section = pageElement(target.page);
    if (!section) return;
    if (forced.current !== section) {
      if (forced.current) forced.current.style.contentVisibility = '';
      section.style.contentVisibility = 'visible';
      forced.current = section;
    }
    const state = loader.peek(target.page);
    // The top of a page is its separator, not its first block.
    const anchor =
      typeof state === 'object' && target.y > 0 ? anchorAt(state, target.y) : undefined;
    const blockId = anchor?.block.id;
    const destination =
      (blockId !== undefined
        ? section.querySelector<HTMLElement>(
            anchor?.item === undefined
              ? `[data-block-id="${blockId}"]`
              : `[data-block-id="${blockId}"][data-item="${anchor.item}"]`,
          )
        : null) ?? section;
    const distance = destination.getBoundingClientRect().top - topline();
    if (Math.abs(distance) >= 1) element.scrollTop += distance;
    record();
  };

  /** Brings Find's mark into view once, when its page is there. */
  const revealMark = useRef(false);
  const showMark = () => {
    if (!revealMark.current) return;
    const element = scroller.current?.querySelector<HTMLElement>('mark');
    if (!element) return;
    revealMark.current = false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const goTo = (target: TextViewPlace) => {
    window.clearTimeout(settling.current);
    settling.current = window.setTimeout(stopSettling, SETTLE_MS);
    pending.current = target;
    void loader.ensure(target.page);
    apply();
  };

  // ── Reading the loader ────────────────────────────────────────────────────────────────
  const wanted = useRef(new Set<number>());
  useEffect(
    () =>
      loader.subscribe(() => {
        setVersion((value) => value + 1);
        // After an edit or OCR the pages are forgotten: ask again for those on screen.
        for (const index of wanted.current) {
          if (loader.peek(index) === 'loading') void loader.ensure(index);
        }
      }),
    [loader],
  );
  // The pages' DOM is current here, so a place waiting for its page can be reached.
  useLayoutEffect(() => {
    apply();
    showMark();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the change signal.
  }, [version, pageCount]);

  useEffect(() => {
    const element = scroller.current;
    if (hidden || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting) {
            wanted.current.add(index);
            void loader.ensure(index);
          } else {
            wanted.current.delete(index);
          }
        }
      },
      { root: element, rootMargin: '200% 0px' },
    );
    for (const section of element.querySelectorAll('section[data-page]')) observer.observe(section);
    const asked = wanted.current;
    return () => {
      observer.disconnect();
      asked.clear();
    };
  }, [hidden, loader, pageCount]);

  // A page that grows or shrinks above the top line must not move what is read.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let average = 0;
    const observer = new ResizeObserver(() => {
      if (pending.current) apply();
      else restore();
      const loaded = [...element.querySelectorAll<HTMLElement>('section[data-state="ready"]')];
      if (loaded.length === 0) return;
      const mean = loaded.reduce((sum, section) => sum + section.offsetHeight, 0) / loaded.length;
      if (Math.abs(mean - average) > average * 0.05) {
        average = mean;
        // After this frame's notifications: the estimate sizes the pages that are skipped.
        requestAnimationFrame(() =>
          root.current?.style.setProperty('--rv-estimate', `${Math.round(mean)}px`),
        );
      }
    });
    for (const section of element.querySelectorAll('section[data-page]')) observer.observe(section);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore reads refs only.
  }, [pageCount]);

  // A change of size, spacing or face keeps the block at the top.
  useLayoutEffect(restore, [prefs.size, prefs.spacing, prefs.face]);

  // ── Opening, closing, jumping ─────────────────────────────────────────────────────────
  const shown = useRef(false);
  useEffect(() => {
    if (hidden) {
      if (shown.current) announce(m.text_view_closed({ page: page + 1 }));
      shown.current = false;
      return;
    }
    shown.current = true;
    const start = latest.current.place;
    goTo(start);
    scroller.current?.focus({ preventScroll: true });
    announce(
      loader.peek(start.page) === 'loading'
        ? `${m.text_view_opened({ page: start.page + 1 })}. ${m.text_view_loading()}`
        : m.text_view_opened({ page: start.page + 1 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opens once per show.
  }, [hidden]);

  const lastJump = useRef(jump?.id);
  useEffect(() => {
    if (!jump || jump.id === lastJump.current) return;
    lastJump.current = jump.id;
    goTo(jump.place);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new request is a new id.
  }, [jump]);

  // Find's mark: bring it into view when it is not (as soon as its page is read).
  useEffect(() => {
    revealMark.current = mark !== null;
    showMark();
  }, [mark]);

  // ── Scrolling and pinching ────────────────────────────────────────────────────────────
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => stopSettling, []);
  const onScroll = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      record();
    });
  };

  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const spread = useRef(0);
  const distance = () => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onPointerDown = (event: ReactPointerEvent) => {
    stopSettling();
    if (event.pointerType === 'mouse') return;
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.current.size === 2) spread.current = distance();
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!fingers.current.has(event.pointerId)) return;
    fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.current.size !== 2) return;
    const now = distance();
    const step = pinchStep(spread.current, now);
    if (step === 0) return;
    spread.current = now;
    setReadingPrefs({ size: useReadingPrefs.getState().size + step });
  };
  const onPointerEnd = (event: ReactPointerEvent) => {
    fingers.current.delete(event.pointerId);
  };

  // ── Scanned pages (EDN-27) ────────────────────────────────────────────────────────────
  const [info, setInfo] = useState<OcrOfferInfo | null>(null);
  const [run, setRun] = useState<ScanControl['run']>(null);
  const [failed, setFailed] = useState(false);
  const infoAsked = useRef(false);
  const recognizing = useRef<AbortController | null>(null);
  useEffect(() => () => recognizing.current?.abort(), []);
  const loadInfo = useCallback(() => {
    if (infoAsked.current) return;
    infoAsked.current = true;
    ocr.info().then(setInfo, () => undefined);
  }, [ocr]);
  const start = useCallback(
    (pages: readonly number[]) => {
      recognizing.current?.abort();
      const control = new AbortController();
      recognizing.current = control;
      setFailed(false);
      setRun({ pages: new Set(pages), done: 0, total: pages.length });
      ocr
        .run(pages, {
          signal: control.signal,
          onProgress: (done, total) => setRun((now) => (now ? { ...now, done, total } : now)),
        })
        .then(
          (written) => {
            if (written) {
              loader.invalidate(pages);
              for (const index of pages) void loader.ensure(index);
            }
          },
          () => setFailed(true),
        )
        .finally(() => setRun(null));
    },
    [ocr, loader],
  );
  const scan: ScanControl = { info, run, failed, loadInfo, start };

  return (
    <div
      ref={root}
      className={styles.root}
      data-theme={look}
      data-face={prefs.face}
      data-hidden={hidden ? '' : undefined}
      data-testid="text-view"
      inert={hidden}
      style={
        {
          '--rv-size': `${(px ?? 18) / 16}rem`,
          '--rv-line': LINE_HEIGHTS[prefs.spacing],
        } as CSSProperties
      }
    >
      {/* The column is a scroll region a keyboard can reach and read (PRD-36 §7); its touch,
          wheel and key handlers only tell the view the reader has taken over from a jump. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <article
        ref={scroller}
        className={styles.scroller}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label={m.text_view_label({ title })}
        lang={loader.language}
        onScroll={onScroll}
        onWheel={stopSettling}
        onTouchStart={stopSettling}
        onKeyDown={stopSettling}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        data-testid="text-view-article"
      >
        <div className={styles.column}>
          <p className={styles.note}>{m.text_view_note()}</p>
          {allScans ? (
            <div className={styles.card} data-testid="text-view-scans">
              <p className={styles.cardText}>{m.text_view_scanned()}</p>
              <ScanPrompt
                pages={Array.from({ length: pageCount }, (_, index) => index)}
                all
                scan={scan}
              />
            </div>
          ) : null}
          {Array.from({ length: pageCount }, (_, index) => (
            <TextPage
              key={index}
              page={index}
              loader={loader}
              crops={crops}
              mark={mark}
              scan={scan}
              allScans={allScans}
              onShowPage={(target) => props.onShowPage(target)}
            />
          ))}
        </div>
      </article>
      <TextViewBar
        page={page}
        pageCount={pageCount}
        onPageView={() => props.onPageView(current.current)}
        onGoto={() => props.onGoto()}
        onFind={() => props.onFind()}
      />
    </div>
  );
}
