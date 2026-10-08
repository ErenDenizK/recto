/**
 * The top strip (`components/01-frame.md` F2; flows.md §2.3, §6.1): the slim frame on medium
 * and up, 44 px on a fine pointer and 56 px on a coarse one (quality-bar Q-9's bars; XD-3).
 *
 *   document:  ◆ ▤ │ tabs (active ▾ ● ⓘ) "N more ▾" + │      ⌕ Find  ↶ ↷  Save  ◎
 *   Library:   ◆ Library │ tabs + │                                          ◎  ⋯
 *
 * - No ⋯ in a document: view options live in the page pill, app items in the dock's More (and
 *   at the end of the title menu until D2-2). The mode switch, layout switch, Document and
 *   Export buttons and the command search field are gone; ⌘K stays a key.
 * - **Priority when space runs out** (F2 §2): the Find field becomes ⌕ below 1280 px; other
 *   tabs go into "N more"; the active tab never truncates below 112 px; ◆ ▤ ↶ ↷ Save ◎ never
 *   fold.
 * - **Never signals Markup** (`language.md` §0.1 principle 8) and carries no lime at rest:
 *   Save and the active tab are neutral fills.
 * - **Floating pieces, no band** (owner feedback 2026-10-08, F1): two glass capsules over the
 *   canvas, inset from the window's edges as the bottom capsule is (16 px), of the capsule's
 *   material (M2, `mat mat-bar`), its height (--bar-h) and its pill radius: the leading piece
 *   holds ◆ ▤ and the tabs (in the Pages grid the selected tab adds the page count), the
 *   trailing piece Find, ↶ ↷, Save and ◎. The middle is bare canvas; the page scrolls beneath
 *   both. The `header` itself is a transparent, pointer-transparent line whose box (the inset
 *   and the pieces' height) is the free rectangle's top inset (frame-insets.ts), so jumps and
 *   fits land below the pieces (A-12).
 * - The leading piece hugs its tabs up to `--lead-max` and never meets the trailing one
 *   (24 px between them at the least); past that the tabs shrink, then go into "N more"
 *   (DocumentTabs measures the room the pieces leave, not the piece itself).
 * - Landmark `header` named "Document bar" / "Library bar"; Tab order ◆ → ▤ → active tab → "N
 *   more" → + → Find → ↶ → ↷ → Save → ◎; F6 lands on the active tab (the Library: ◆).
 *
 * No inspector toggle (inventory 3.9): the inspector is gone and its parts live in the History
 * scrubber, the bars' ⋯, the title menu and its sheets (spec D2-9).
 */

import { LibraryMenu } from '../../home/LibraryMenu';
import { m } from '../../i18n';
import { PrivacyShield } from '../../privacy/PrivacyShield';
import { useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../../state/workspace-store';
import { GridSources } from '../../stage/grid/GridPieces';
import { DocumentTabs } from './DocumentTabs';
import { FindEntry } from './FindEntry';
import { tabDomId } from './ids';
import { LibraryButton } from './LibraryButton';
import { SaveButton } from './SaveButton';
import { SidebarToggle } from './SidebarToggle';
import { TitleMenu } from './TitleMenu';
import styles from './TopStrip.module.css';
import { UndoRedo } from './UndoRedo';

/** The active tab, where the title menu opens and gives focus back. */
export const activeTabElement = (): HTMLElement | null => {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  return id === undefined ? null : document.getElementById(tabDomId(id));
};

export function TopStrip() {
  const hasDocuments = useHasDocuments();
  const onLibrary = useUiStore((s) => s.destination === 'home') || !hasDocuments;
  const grid = useStageView() === 'grid' && !onLibrary;
  const pageCount = useActiveDocument()?.pages.length ?? 0;
  return (
    <header
      className={styles.strip}
      aria-label={onLibrary ? m.frame_library_bar() : m.frame_document_bar()}
      data-region="top"
      data-frame-layer="top"
      data-destination={onLibrary ? 'library' : 'document'}
    >
      <div className={styles.piece} data-top-piece="lead" data-bar="title" data-glass-group="top">
        <div className={styles.lead}>
          <LibraryButton current={onLibrary} />
          {onLibrary ? null : <SidebarToggle />}
        </div>
        <DocumentTabs
          onLibrary={onLibrary}
          pageCount={grid ? pageCount : undefined}
          after={grid ? <GridSources /> : null}
        />
      </div>
      <div
        className={`${styles.piece} ${styles.trail}`}
        data-top-piece="trail"
        data-bar="title-trail"
        data-glass-group="top"
      >
        {onLibrary ? (
          <>
            <PrivacyShield />
            <LibraryMenu />
          </>
        ) : (
          <>
            <FindEntry />
            <UndoRedo />
            <SaveButton />
            <PrivacyShield />
          </>
        )}
      </div>
      {onLibrary ? null : <TitleMenu anchor={activeTabElement} />}
    </header>
  );
}
