/**
 * The compact reader's chrome (ADR-0033 §2.3 "Chrome"), calm in the manner of Procreate and
 * Apple Books: two pieces that hide and show together.
 *
 * - **Top bar:** ‹ back to the Library, the title (truncated, full in its accessible name),
 *   and ⋯ with Find, Contents (only when the file has an outline), Go to page, Share or
 *   Download a copy, Document info and About. In Find it becomes the search field with the
 *   hit count, ‹ › and Done. A document changed since it was opened (an edit here, or a kept
 *   snapshot) shows the "Changed" cue in ⋯ with Share a copy and Save a copy
 *   (`design/phone-2026-10/README.md` §6: no save in place on a phone).
 * - **Capsule:** one floating capsule at the bottom: Pages, "3 / 12" (Go to page) and Find,
 *   with the round edit button beside it on the trailing side (EDN-8;
 *   `design/phone-2026-10/README.md` §2). It morphs the capsule into the edit island (Undo,
 *   the tool chip, Done), whose content and tool drawer come from the lazy `mark/` chunk
 *   (`mark-host.ts`).
 *
 * Hidden, both move out by `transform` and fade (`opacity`) on the existing motion tokens,
 * and are `inert` from the first frame, so focus never lands in a hidden bar. Reduced motion
 * makes the move instant (the tokens fall to 0 ms). Both also step away while a sheet is open
 * (`topBarAway`, `capsuleAway`): the sheet is the place then, and nothing of the chrome shows
 * through it.
 */
import { Menu } from '@base-ui/react/menu';
import type { VirtualDocument } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { m } from '../../i18n';
import { isDocumentChanged } from '../../session/session';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { Icon } from '../../ui/Icon';
import {
  clearSearch,
  revealHit,
  runSearch,
  searchStep,
  selectHit,
  setSearchQuery,
  useSearchStore,
} from '../../viewer/search';
import { PRODUCT_NAME } from '../about/build-info';
import { AppGlyph } from '../AppGlyph';
import { canShareFiles, prepareCopy, shareOrDownload } from './compact-actions';
import {
  capsuleAway,
  closeFind,
  openFind,
  openSheet,
  setMenuOpen,
  showLibrary,
  topBarAway,
  useCompactStore,
} from './compact-store';
import styles from './CompactChrome.module.css';
import controls from './controls.module.css';
import { startEditing, takeCapsuleSnapshot, useMark, usePrefetchMark } from './mark-host';

/** Typing pauses this long before the search runs. */
const SEARCH_DELAY_MS = 250;

/** Back to the pages after Find closes, so the arrows act on them again. */
function focusPages(): void {
  document.querySelector<HTMLElement>('[data-read-viewport]')?.focus({ preventScroll: true });
}

export function CompactTopBar({ doc }: { readonly doc: VirtualDocument }) {
  const hidden = useCompactStore(topBarAway);
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
              <Icon name="caret-left" />
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
  // Followed on the workspace: an edit, undo or redo may change it.
  const changed = useWorkspaceStore(() => isDocumentChanged(doc.id));
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
        <Icon name="dots-three" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <Menu.Popup className={styles.menu} data-testid="compact-menu">
            <Menu.Item className={styles.menuItem} onClick={openFind}>
              <Icon name="magnifying-glass" />
              <span>{m.compact_find()}</span>
            </Menu.Item>
            {hasOutline ? (
              <Menu.Item className={styles.menuItem} onClick={() => openSheet('contents')}>
                <Icon name="tree-view" />
                <span>{m.compact_contents()}</span>
              </Menu.Item>
            ) : null}
            <Menu.Item className={styles.menuItem} onClick={() => openSheet('goto')}>
              <Icon name="hash" />
              <span>{m.goto_title()}</span>
            </Menu.Item>
            {changed ? (
              <Menu.Group data-testid="compact-menu-changed">
                <Menu.GroupLabel className={styles.changedCue}>
                  <span className={styles.changedDot} aria-hidden="true" />
                  {m.compact_save_changed()}
                </Menu.GroupLabel>
                {share ? (
                  <Menu.Item className={styles.menuItem} onClick={() => void shareOrDownload()}>
                    <Icon name="export" />
                    <span>{m.compact_save_share()}</span>
                  </Menu.Item>
                ) : null}
                <Menu.Item
                  className={styles.menuItem}
                  onClick={() => void shareOrDownload('download')}
                >
                  <Icon name="download-simple" />
                  <span>{m.compact_save_copy()}</span>
                </Menu.Item>
              </Menu.Group>
            ) : (
              <Menu.Item className={styles.menuItem} onClick={() => void shareOrDownload()}>
                {share ? <Icon name="export" /> : <Icon name="download-simple" />}
                <span>{share ? m.compact_share() : m.compact_download()}</span>
              </Menu.Item>
            )}
            <Menu.Separator className={styles.menuSeparator} />
            <Menu.Item className={styles.menuItem} onClick={() => openSheet('info')}>
              <Icon name="info" />
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

  // A new search shows the hit it picks (the first from the page being read) as soon as it
  // arrives, as ‹ › show theirs (visual audit 2026-10 defect 2): the count never names a hit
  // that is off screen.
  const revealPending = useRef(false);
  useEffect(() => {
    if (!revealPending.current || current < 0) return;
    revealPending.current = false;
    revealHit(selectHit(current));
  }, [current]);

  // The search runs once typing pauses, from the page being read.
  useEffect(() => {
    if (query === searched) return;
    const timer = window.setTimeout(() => {
      setSearched(query);
      revealPending.current = true;
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
      revealPending.current = true;
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
        <Icon name="magnifying-glass" />
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
        <Icon name="caret-left" />
      </button>
      <button
        type="button"
        className={controls.icon}
        aria-label={m.search_next()}
        disabled={hits.length === 0}
        onClick={() => searchStep(1)}
      >
        <Icon name="caret-right" />
      </button>
      <button type="button" className={controls.text} onClick={close}>
        {m.compact_done()}
      </button>
    </form>
  );
}

export function CompactCapsule({ doc }: { readonly doc: VirtualDocument }) {
  const away = useCompactStore(capsuleAway);
  const editing = useCompactStore((s) => s.editing);
  const mark = useMark();
  const island = editing && mark !== null;
  const capsuleRef = useRef<HTMLElement>(null);
  usePrefetchMark();
  // Reading and editing: the one capsule morphs between its contents (Q-6, README §2), from the
  // box it had before the swap (`snapshotCapsule`).
  useLayoutEffect(() => {
    const from = takeCapsuleSnapshot();
    const el = capsuleRef.current;
    if (from && el && mark) mark.morphCapsule(el, from);
  }, [island, mark]);
  return (
    <>
      <div className={styles.dock}>
        <nav
          ref={capsuleRef}
          className={styles.capsule}
          aria-label={island ? m.compact_edit_tools() : m.compact_document_tools()}
          data-hidden={away || undefined}
          data-editing={island || undefined}
          data-compact-chrome=""
          data-testid="compact-capsule"
          inert={away}
        >
          {island ? <mark.EditIsland /> : <ReadingCapsule doc={doc} />}
        </nav>
        {/* The trailing island beside the capsule (README §2, the iOS 26 pattern): it hides
            with the chrome and folds into the capsule while editing. */}
        <button
          type="button"
          className={styles.edit}
          aria-label={m.compact_edit()}
          data-hidden={away || undefined}
          data-away={island || undefined}
          data-compact-chrome=""
          data-testid="compact-edit"
          inert={away || island}
          onClick={startEditing}
        >
          <Icon name="pencil-simple" />
        </button>
      </div>
      {island ? (
        <>
          <mark.ToolDrawer />
          <mark.SignHost />
        </>
      ) : null}
      {/* The selection bar's watch, reading and editing (README §4); its bar loads lazily. */}
      {mark ? <mark.SelectionHost /> : null}
    </>
  );
}

/** The capsule's reading content: Pages, "3 / 12" (Go to page) and Find. */
function ReadingCapsule({ doc }: { readonly doc: VirtualDocument }) {
  const current = useViewStore((s) => s.currentPage);
  const total = doc.pages.length;
  // Wide enough for the largest number, so scrolling never changes the capsule's width.
  const digits = String(total).length;
  return (
    <>
      <button type="button" className={controls.text} onClick={() => openSheet('pages')}>
        <Icon name="squares-four" />
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
        <Icon name="magnifying-glass" />
        {m.compact_find()}
      </button>
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
