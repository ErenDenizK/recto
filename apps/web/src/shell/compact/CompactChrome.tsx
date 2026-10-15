/**
 * The compact reader's chrome (ADR-0033 §2.3 "Chrome"), calm in the manner of Procreate and
 * Apple Books: two pieces that hide and show together.
 *
 * - **Top bar:** a floating glass capsule (DSN-32): ‹ back to the Library, the title
 *   (truncated, full in its accessible name), and ⋯ with Find, Contents (only when the file
 *   has an outline), Go to page, Share or Download a copy, Document info and About. In Find it becomes the search field with the
 *   hit count, ‹ › and Done. A document changed since it was opened (an edit here, or a kept
 *   snapshot) shows the "Changed" cue in ⋯ with Share a copy and Save a copy
 *   (`design/phone-2026-10/README.md` §6: no save in place on a phone). Behind `?top=split`
 *   (DSN-34, `top-variant.ts`) the reader shows the split top instead (`CompactTopSplit`, in
 *   the compact chunk): ‹ and ⋯ as glass circles, the title as text over a scroll-edge fade; Find is
 *   this bar's field in both. The ⋯ menu grows out of its button (DSN-36).
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
import { closeMenusAtOnce } from '../../ui/menu-handoff';
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
  type CompactSheet,
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
import { openOverview } from './overview-host';
import { CompactTopSplit } from './CompactTopSplit';
import { topVariant } from './top-variant';

/** Typing pauses this long before the search runs. */
const SEARCH_DELAY_MS = 250;

/** Back to the pages after Find closes, so the arrows act on them again. */
function focusPages(): void {
  document.querySelector<HTMLElement>('[data-read-viewport]')?.focus({ preventScroll: true });
}

/**
 * What the split top shares with this bar, handed to it rather than imported, so the two modules
 * never import each other. The split top lives in the compact chunk (1.3 KB gzip): as a lazy
 * chunk of its own, what it imports from the first load made the bundler fold the first-paint
 * chunks into one, which the engine's first-open closure then counted whole (PF-2, PRC-11).
 */
export interface SplitTopParts {
  readonly MoreMenu: typeof MoreMenu;
  readonly SaveItems: typeof SaveItems;
  readonly toSheet: typeof toSheet;
  readonly useFileInfo: typeof useFileInfo;
  readonly showLibrary: typeof showLibrary;
  readonly classes: {
    readonly menu: string | undefined;
    readonly menuItem: string | undefined;
    readonly menuSeparator: string | undefined;
  };
}

export function CompactTopBar({ doc }: { readonly doc: VirtualDocument }) {
  const hidden = useCompactStore(topBarAway);
  const findOpen = useCompactStore((s) => s.findOpen);
  // The split top while reading; Find is this bar's field in both variants.
  if (topVariant() === 'split' && !findOpen) {
    return <CompactTopSplit doc={doc} hidden={hidden} parts={SPLIT_TOP_PARTS} />;
  }
  return (
    <header
      className={styles.topBar}
      data-hidden={hidden || undefined}
      data-compact-chrome=""
      data-testid="compact-top-bar"
      data-gpu-glass="capsule"
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

/** How long the container transform's idle install may wait for an idle moment, ms. */
const MOTION_INSTALL_TIMEOUT_MS = 3000;
let motionInstalled = false;

/**
 * The container transform (MOT-5, `ui/container-transform.ts`) on the phone too (DSN-36): the ⋯
 * menu, the split top's file menu and the overview's pop-ups grow out of their button and go
 * back into it. It is fetched once the browser is idle after the reader opens, outside the
 * compact closure (the bundle gate, PRC-11); a menu opened before it arrives keeps its CSS
 * entrance.
 */
function useMenuMotion(): void {
  useEffect(() => {
    if (motionInstalled) return;
    const install = () => {
      motionInstalled = true;
      import('../../ui/container-transform')
        .then((module) => module.installContainerTransform())
        .catch(() => {
          motionInstalled = false;
        });
    };
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(install, { timeout: MOTION_INSTALL_TIMEOUT_MS })
      : window.setTimeout(install, MOTION_INSTALL_TIMEOUT_MS);
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
}

/**
 * A menu row that opens a sheet: the menu goes at once (`ui/menu-handoff.ts`, Q-7), so it never
 * shrinks back into its button through the rising sheet.
 */
const toSheet = (sheet: CompactSheet) => () => {
  closeMenusAtOnce();
  openSheet(sheet);
};

interface MoreMenuProps {
  readonly doc: VirtualDocument;
  /** The trigger's look: the bar's icon control by default, the split top's glass circle. */
  readonly triggerClassName?: string | undefined;
  /** The trigger's `data-glass-group` (Q-11): the split top's pieces count as one surface. */
  readonly glassGroup?: string;
  /**
   * The popup's offset from the trigger, px: 6 below the capsule; the split top's −44 lays the
   * menu over its circle, which it grows out of (DSN-36, as iOS Preview's ⋯).
   */
  readonly sideOffset?: number;
}

function MoreMenu({
  doc,
  triggerClassName = controls.icon,
  glassGroup,
  sideOffset = 6,
}: MoreMenuProps) {
  const open = useCompactStore((s) => s.menuOpen);
  const hasOutline = doc.outline.length > 0;
  useMenuMotion();
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        setMenuOpen(next);
        // The copy is ready by the time Share is tapped (see `prepareCopy`).
        if (next) prepareCopy(doc).catch(() => undefined);
      }}
    >
      <Menu.Trigger
        className={triggerClassName}
        aria-label={m.compact_more()}
        data-glass-group={glassGroup}
        data-gpu-glass={glassGroup ? 'circle' : undefined}
        data-testid="compact-more"
      >
        <Icon name="dots-three" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={sideOffset} collisionPadding={8}>
          <Menu.Popup className={styles.menu} data-testid="compact-menu">
            <Menu.Item className={styles.menuItem} onClick={openFind}>
              <Icon name="magnifying-glass" />
              <span>{m.compact_find()}</span>
            </Menu.Item>
            {hasOutline ? (
              <Menu.Item className={styles.menuItem} onClick={toSheet('contents')}>
                <Icon name="tree-view" />
                <span>{m.compact_contents()}</span>
              </Menu.Item>
            ) : null}
            <Menu.Item className={styles.menuItem} onClick={toSheet('goto')}>
              <Icon name="hash" />
              <span>{m.goto_title()}</span>
            </Menu.Item>
            <SaveItems doc={doc} />
            <Menu.Separator className={styles.menuSeparator} />
            <Menu.Item className={styles.menuItem} onClick={toSheet('info')}>
              <Icon name="info" />
              <span>{m.compact_info()}</span>
            </Menu.Item>
            <Menu.Item className={styles.menuItem} onClick={toSheet('about')}>
              <AppGlyph size={16} />
              <span>{m.about_command({ name: PRODUCT_NAME })}</span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * Share or Download a copy; once the document changed, the "Changed" cue over Share a copy and
 * Save a copy (`design/phone-2026-10/README.md` §6). The ⋯ menu's and the file menu's rows.
 */
function SaveItems({ doc }: { readonly doc: VirtualDocument }) {
  const share = canShareFiles();
  // Followed on the workspace: an edit, undo or redo may change it.
  const changed = useWorkspaceStore(() => isDocumentChanged(doc.id));
  return (
    <>
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
          <Menu.Item className={styles.menuItem} onClick={() => void shareOrDownload('download')}>
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
    </>
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
          data-gpu-glass="capsule"
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
          data-gpu-glass="circle"
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
      <button type="button" className={controls.text} onClick={openOverview}>
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

const SPLIT_TOP_PARTS: SplitTopParts = {
  MoreMenu,
  SaveItems,
  toSheet,
  useFileInfo,
  showLibrary,
  classes: {
    menu: styles.menu,
    menuItem: styles.menuItem,
    menuSeparator: styles.menuSeparator,
  },
};
