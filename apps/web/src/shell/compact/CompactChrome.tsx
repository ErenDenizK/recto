/**
 * The compact reader's chrome (ADR-0033 §2.3 "Chrome"), calm in the manner of Procreate and
 * Apple Books: two pieces that hide and show together.
 *
 * - **Top bar:** ‹ back to the Library, the title (truncated, full in its accessible name),
 *   and ⋯ with Find, Contents (only when the file has an outline), Go to page, Share or
 *   Download a copy, Document info and About. In Find it becomes the search field with the
 *   hit count, ‹ › and Done.
 * - **Capsule:** one floating capsule at the bottom: Pages, "3 / 12" (Go to page) and Find.
 *
 * Hidden, both move out by `transform` and fade (`opacity`) on the existing motion tokens,
 * and are `inert` from the first frame, so focus never lands in a hidden bar. Reduced motion
 * makes the move instant (the tokens fall to 0 ms).
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Hash,
  Info,
  LayoutGrid,
  ListTree,
  Search,
  Share,
} from 'lucide-react';
import { type KeyboardEvent, type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { m } from '../../i18n';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import {
  clearSearch,
  runSearch,
  searchStep,
  setSearchQuery,
  useSearchStore,
} from '../../viewer/search';
import { PRODUCT_NAME } from '../about/build-info';
import { AppGlyph } from '../AppGlyph';
import { canShareFiles, prepareCopy, shareOrDownload } from './compact-actions';
import {
  closeFind,
  openFind,
  openSheet,
  setMenuOpen,
  showLibrary,
  useCompactStore,
} from './compact-store';
import styles from './CompactChrome.module.css';
import controls from './controls.module.css';

/** Typing pauses this long before the search runs. */
const SEARCH_DELAY_MS = 250;

/** Back to the pages after Find closes, so the arrows act on them again. */
function focusPages(): void {
  document.querySelector<HTMLElement>('[data-read-viewport]')?.focus({ preventScroll: true });
}

export function CompactTopBar({ doc }: { readonly doc: VirtualDocument }) {
  const hidden = useCompactStore((s) => s.chromeHidden);
  const findOpen = useCompactStore((s) => s.findOpen);
  return (
    <header
      className={styles.topBar}
      data-hidden={hidden || undefined}
      data-compact-chrome=""
      data-testid="compact-top-bar"
      inert={hidden}
    >
      <div className={styles.topRow}>
        {findOpen ? (
          <FindBar doc={doc} />
        ) : (
          <>
            <button
              type="button"
              className={controls.icon}
              aria-label={m.compact_library()}
              onClick={showLibrary}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <h1 className={styles.title}>{doc.title}</h1>
            <MoreMenu doc={doc} />
          </>
        )}
      </div>
    </header>
  );
}

function MoreMenu({ doc }: { readonly doc: VirtualDocument }) {
  const open = useCompactStore((s) => s.menuOpen);
  const hasOutline = doc.outline.length > 0;
  const share = canShareFiles();
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setMenuOpen(next);
        // The copy is ready by the time Share is tapped (see `prepareCopy`).
        if (next) prepareCopy(doc).catch(() => undefined);
      }}
    >
      <Menu.Trigger className={controls.icon} aria-label={m.compact_more()}>
        <Ellipsis aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <Menu.Popup className={styles.menu} data-testid="compact-menu">
            <Menu.Item className={styles.menuItem} onClick={openFind}>
              <Search aria-hidden="true" />
              <span>{m.compact_find()}</span>
            </Menu.Item>
            {hasOutline ? (
              <Menu.Item className={styles.menuItem} onClick={() => openSheet('contents')}>
                <ListTree aria-hidden="true" />
                <span>{m.compact_contents()}</span>
              </Menu.Item>
            ) : null}
            <Menu.Item className={styles.menuItem} onClick={() => openSheet('goto')}>
              <Hash aria-hidden="true" />
              <span>{m.goto_title()}</span>
            </Menu.Item>
            <Menu.Item className={styles.menuItem} onClick={() => void shareOrDownload()}>
              {share ? <Share aria-hidden="true" /> : <Download aria-hidden="true" />}
              <span>{share ? m.compact_share() : m.compact_download()}</span>
            </Menu.Item>
            <Menu.Separator className={styles.menuSeparator} />
            <Menu.Item className={styles.menuItem} onClick={() => openSheet('info')}>
              <Info aria-hidden="true" />
              <span>{m.compact_info()}</span>
            </Menu.Item>
            <Menu.Item className={styles.menuItem} onClick={() => openSheet('about')}>
              <AppGlyph size={16} />
              <span>{m.about_command({ name: PRODUCT_NAME })}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Find in the top bar: the field, the hit count, ‹ › and Done (Esc closes it too). */
function FindBar({ doc }: { readonly doc: VirtualDocument }) {
  const query = useSearchStore((s) => s.query);
  const status = useSearchStore((s) => s.status);
  const hits = useSearchStore((s) => s.hits);
  const current = useSearchStore((s) => s.current);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searched, setSearched] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The search runs once typing pauses, from the page being read.
  useEffect(() => {
    if (query === searched) return;
    const timer = window.setTimeout(() => {
      setSearched(query);
      void runSearch(doc, useViewStore.getState().currentPage);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query, searched, doc]);

  const close = () => {
    clearSearch();
    closeFind();
    focusPages();
  };
  const onSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (query !== searched) {
      setSearched(query);
      void runSearch(doc, useViewStore.getState().currentPage);
      return;
    }
    searchStep(1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  let count = '';
  if (hits.length > 0) count = m.search_count({ current: current + 1, total: hits.length });
  else if (status === 'searching') count = m.search_searching();
  else if (status === 'done' && query.trim() !== '') count = m.search_no_results();
  else if (status === 'error') count = m.search_failed();

  return (
    <form className={styles.find} role="search" onSubmit={onSubmit}>
      <label className={styles.field}>
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          aria-label={m.search_label()}
          placeholder={m.compact_find()}
          value={query}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <span className={styles.count} aria-live="polite" data-testid="compact-find-count">
        {count}
      </span>
      <button
        type="button"
        className={controls.icon}
        aria-label={m.search_previous()}
        disabled={hits.length === 0}
        onClick={() => searchStep(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        className={controls.icon}
        aria-label={m.search_next()}
        disabled={hits.length === 0}
        onClick={() => searchStep(1)}
      >
        <ChevronRight aria-hidden="true" />
      </button>
      <button type="button" className={controls.text} onClick={close}>
        {m.compact_done()}
      </button>
    </form>
  );
}

export function CompactCapsule({ doc }: { readonly doc: VirtualDocument }) {
  const hidden = useCompactStore((s) => s.chromeHidden);
  const findOpen = useCompactStore((s) => s.findOpen);
  const current = useViewStore((s) => s.currentPage);
  const total = doc.pages.length;
  const away = hidden || findOpen;
  // Wide enough for the largest number, so scrolling never changes the capsule's width.
  const digits = String(total).length;
  return (
    <>
      <nav
        className={styles.capsule}
        aria-label={m.compact_document_tools()}
        data-hidden={away || undefined}
        data-compact-chrome=""
        data-testid="compact-capsule"
        inert={away}
      >
        <button type="button" className={controls.text} onClick={() => openSheet('pages')}>
          <LayoutGrid aria-hidden="true" />
          {m.compact_pages()}
        </button>
        <button
          type="button"
          className={`${controls.text} ${controls.numeric}`}
          style={{ minWidth: `calc(${2 * digits + 3}ch + 28px)` }}
          aria-label={m.compact_page_button({ current: current + 1, total })}
          data-testid="compact-page-number"
          onClick={() => openSheet('goto')}
        >
          {current + 1} / {total}
        </button>
        <button type="button" className={controls.text} onClick={openFind}>
          <Search aria-hidden="true" />
          {m.compact_find()}
        </button>
      </nav>
    </>
  );
}

/** For the documents' facts: the workspace's file record of a source. */
export function useFileInfo(doc: VirtualDocument) {
  const files = useWorkspaceStore((s) => s.files);
  for (const page of doc.pages) {
    if (page.ref.kind === 'source') return files[page.ref.source];
  }
  return undefined;
}
