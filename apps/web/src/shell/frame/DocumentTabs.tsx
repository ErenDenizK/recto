/**
 * The document tabs (`components/01-frame.md` F4): switch between open documents and show
 * each one's state, in one order with the Library's cards (`documentOrder`, INV-19). APG Tabs
 * with automatic activation, as before (XD-3's strip carries over: the tab list never narrower
 * than one tab at its minimum, names ending in an ellipsis with the full name as tooltip and
 * accessible name, the faded edges of `use-tablist-edges.ts` should the list ever scroll).
 *
 * - **The active tab is the title menu's trigger** (RA-9): a click, Enter or Space on it opens
 *   the title menu (F5); on an inactive tab they activate it and focus stays there. On the
 *   Library no tab is selected and a click shows the document. F2 opens the title menu with
 *   its name field focused; a double-click no longer renames (spec 01.4).
 * - **Keys:** Left / Right, Home / End move focus and activate, across every open document,
 *   overflowed ones included (they come into the strip as they become active); Delete closes.
 *   Right-click, a long press or Shift+F10 opens the tab menu (`TabMenu.tsx`).
 * - **State:** ● after the name while the changes are not yet in the file (kept on this
 *   device, X13); a lock glyph while locked (the reason is in the tab's name and the title
 *   menu, A-19: never a tint); the signature glyph on signed files; ▾ on the active tab.
 * - **Overflow** (01.Q1): the visible tabs are measured against the room the strip leaves;
 *   when they would fall under 112 px (128 coarse), the rest go into "N more ▾"
 *   (`TabOverflow.tsx`, `tab-overflow.ts`).
 * - **Close** asks nothing; focus goes to the next tab to the right, else the left, else the
 *   Library's first focus; announced, with the changes kept (F4 §6).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { openFilesFromPicker } from '../../commands/app-commands';
import { showTab } from '../../home/home-actions';
import { m } from '../../i18n';
import { SignatureTabGlyph } from '../../signatures/SignatureBadge';
import { useLockStore } from '../../state/lock-store';
import { matchesMark, useSavedStore } from '../../state/saved-store';
import { useTabItems, useWorkspaceStore } from '../../state/workspace-store';
import { IconButton } from '../../ui/IconButton';
import { announce } from '../announcer';
import { useCommandShortcut } from '../use-command-shortcut';
import { useTablistEdges } from '../use-tablist-edges';
import { openTitleMenu, useFrameStore } from './frame-store';
import { STAGE_ID, tabDomId } from './ids';
import { splitTabs, TAB_GAP_FINE, tabCapacity } from './tab-overflow';
import { TabMenu } from './TabMenu';
import { TabOverflow } from './TabOverflow';
import styles from './TopStrip.module.css';
import { Icon } from '../../ui/Icon';

/** The active tab's description: it opens the document menu (F4 §5). */
const MENU_HINT_ID = 'tab-document-menu-hint';

/** Until the overflow chip has rendered once, its width is taken as this (EN "3 more ▾"). */
const CHIP_ESTIMATE = 96;

/** Reads a length custom property (`--tab-min`) of `element` in CSS px. */
function lengthVar(element: Element, name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Focus the Library's first focus after the last tab closes (F4 §6). */
function focusLibrary(): void {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>('[data-testid="home-button"], #open-files-button')?.focus(),
  );
}

export function DocumentTabs({ onLibrary }: { readonly onLibrary: boolean }) {
  const documents = useTabItems();
  const activeId = useWorkspaceStore((s) => s.workspace.activeDocument ?? null);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const closeDocument = useWorkspaceStore((s) => s.closeDocument);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const marks = useSavedStore((s) => s.marks);
  const locks = useLockStore((s) => s.locks);
  const menuOpen = useFrameStore((s) => s.titleMenu !== null);
  const tablistRef = useTablistEdges();
  const regionRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(Number.POSITIVE_INFINITY);

  // How many tabs fit: the region's room less + (and the chip when it shows).
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const measure = () => {
      const plus = region.querySelector<HTMLElement>('[data-strip-open]');
      const chip = region.querySelector<HTMLElement>('[data-testid="tab-overflow"]');
      const gap = lengthVar(region, '--tab-gap', TAB_GAP_FINE);
      const room = region.clientWidth - (plus ? plus.offsetWidth + 8 : 0) - 4;
      const next = tabCapacity(
        documents.length,
        room,
        lengthVar(region, '--tab-min', 112),
        gap,
        chip ? chip.offsetWidth : CHIP_ESTIMATE,
      );
      setCapacity((previous) => (previous === next ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    return () => observer.disconnect();
  }, [documents.length]);

  const activeIndex = documents.findIndex((d) => d.id === activeId);
  const { visible, overflow } = splitTabs(documents, activeIndex, capacity);
  const edited = new Set(
    documents.filter((d) => !matchesMark(workspace, d.id, marks[d.id])).map((d) => d.id),
  );

  // Keep the active tab in view should the list scroll (XD-3).
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(tabDomId(activeId))?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeId]);

  const focusTab = (id: DocumentId) => {
    setActive(id);
    requestAnimationFrame(() => document.getElementById(tabDomId(id))?.focus());
  };

  const closeTab = (id: DocumentId, refocus: boolean) => {
    const index = documents.findIndex((d) => d.id === id);
    const doc = documents[index];
    if (!doc) return;
    closeDocument(id);
    announce(m.frame_closed_kept({ name: doc.title }));
    if (!refocus) return;
    const next = documents[index + 1] ?? documents[index - 1];
    if (next) focusTab(next.id);
    else focusLibrary();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: DocumentId) => {
    const index = documents.findIndex((d) => d.id === id);
    if (index < 0) return;
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % documents.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + documents.length) % documents.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = documents.length - 1;
    else if (event.key === 'F2') {
      event.preventDefault();
      showTab(id);
      openTitleMenu('name');
      return;
    } else if (event.key === 'Delete') {
      event.preventDefault();
      closeTab(id, true);
      return;
    }
    if (target === null) return;
    event.preventDefault();
    const doc = documents[target];
    if (doc) focusTab(doc.id);
  };

  const onClick = (id: DocumentId) => {
    // The active tab is the document menu's trigger (RA-9); on the Library it shows the
    // document, in the view it was last shown in.
    if (id === activeId && !onLibrary) {
      openTitleMenu('menu');
      return;
    }
    showTab(id);
  };

  const onMouseDown = (event: MouseEvent, id: DocumentId) => {
    // Middle click closes, as in browsers.
    if (event.button !== 1) return;
    event.preventDefault();
    closeTab(id, false);
  };

  return (
    <div ref={regionRef} className={styles.tabsRegion}>
      {documents.length > 0 ? (
        <div ref={tablistRef} role="tablist" aria-label={m.tabs_label()} className={styles.tablist}>
          {visible.map((doc) => {
            const active = doc.id === activeId;
            const selected = active && !onLibrary;
            const isEdited = edited.has(doc.id);
            const lock = locks[doc.id];
            const name =
              isEdited && lock
                ? m.frame_tab_name_edited_locked({ name: doc.title })
                : lock
                  ? m.frame_tab_name_locked({ name: doc.title })
                  : isEdited
                    ? m.tab_name_edited({ name: doc.title })
                    : undefined;
            return (
              <TabMenu
                key={doc.id}
                documentId={doc.id}
                title={doc.title}
                onClose={(id) => closeTab(id, true)}
              >
                <div className={styles.tabWrap} data-selected={selected || undefined}>
                  <button
                    type="button"
                    role="tab"
                    id={tabDomId(doc.id)}
                    aria-selected={selected}
                    aria-controls={STAGE_ID}
                    aria-keyshortcuts="Delete F2"
                    aria-label={name}
                    aria-describedby={selected ? MENU_HINT_ID : undefined}
                    aria-haspopup={selected ? 'dialog' : undefined}
                    aria-expanded={selected ? menuOpen : undefined}
                    tabIndex={active ? 0 : -1}
                    className={styles.tab}
                    title={doc.title}
                    data-edited={isEdited || undefined}
                    data-locked={lock}
                    // The active tab opens the document menu (RA-9): today's test hook.
                    data-testid={selected ? 'document-menu' : undefined}
                    onKeyDown={(event) => onKeyDown(event, doc.id)}
                    onClick={() => onClick(doc.id)}
                    onMouseDown={(event) => onMouseDown(event, doc.id)}
                  >
                    <span className={styles.tag} data-tag={doc.colorIndex} aria-hidden="true" />
                    <span className={styles.name}>{doc.title}</span>
                    {isEdited ? (
                      <span
                        className={styles.edited}
                        title={m.tab_edited_hint()}
                        aria-hidden="true"
                        data-testid="tab-edited"
                      />
                    ) : null}
                    {lock ? (
                      <Icon
                        name="lock-simple"
                        className={styles.lock}
                        aria-hidden="true"
                        data-testid="tab-lock"
                      />
                    ) : null}
                    <SignatureTabGlyph documentId={doc.id} />
                    {selected ? (
                      <Icon name="caret-down" className={styles.caret} aria-hidden="true" />
                    ) : null}
                    {/* Closing by keyboard is Delete or the tab menu; ✕ is the pointer's (APG):
                        hidden from assistive technology and never focusable, so it may sit in
                        the tab's own row, right after the name, where every tab puts it. */}
                    <span
                      aria-hidden="true"
                      className={styles.close}
                      title={m.frame_close_name({ name: doc.title })}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(doc.id, false);
                      }}
                    >
                      <Icon name="x" />
                    </span>
                  </button>
                </div>
              </TabMenu>
            );
          })}
        </div>
      ) : null}
      <span id={MENU_HINT_ID} className="visually-hidden">
        {m.frame_document_menu()}
      </span>
      <TabOverflow tabs={overflow} edited={edited} />
      <div data-strip-open="" className={styles.openSlot}>
        <OpenButton />
      </div>
    </div>
  );
}

/** + Open (F3): the file picker, Mod+O. */
function OpenButton() {
  const shortcut = useCommandShortcut('file.open');
  return (
    <IconButton
      id="open-files-button"
      label={m.open_files()}
      icon={<Icon name="plus" />}
      shortcut={shortcut}
      onClick={() => void openFilesFromPicker()}
    />
  );
}
