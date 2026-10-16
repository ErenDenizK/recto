/**
 * The top strip (`components/01-frame.md` F2; flows.md §2.3, §6.1): the slim frame on medium
 * and up, 44 px on a fine pointer and 56 px on a coarse one (quality-bar Q-9's bars; XD-3).
 *
 *   document:  (◆) (▤) (tabs: active ▾ ● ⓘ "N more ▾" +)      (⌕ Find) (↶ ↷) (Save) (◎)
 *   Library:   (◆ Library) (tabs +)                                                (⋯)
 *              ((◎) (⋯) once the monitor counts an external request, DSN-46)
 *
 * - No ⋯ in a document: view options live in the page pill, app items in the dock's More. The
 *   mode switch, layout switch, Document and Export buttons and the command search field are
 *   gone; ⌘K stays a key.
 * - **Priority when space runs out** (F2 §2): the Find field becomes ⌕ below 1280 px; other
 *   tabs go into "N more"; the active tab never truncates below 112 px; ◆ ▤ ↶ ↷ Save ◎ never
 *   fold.
 * - **Never signals Markup** (`language.md` §0.1 principle 8) and carries no lime at rest:
 *   Save and the active tab are neutral fills.
 * - **Separate glass pieces, no band** (owner feedback 2026-10-08, F1; R21 brief B-4, DSN-49):
 *   each group of controls floats as its own piece of the capsule's material (M2, `mat
 *   mat-bar`), its height (--piece-h) and its pill radius, as the phone's split top does
 *   (DSN-34): a circle around one control (◆, ▤, ⌕, ◎, the Library's ⋯) and a capsule around
 *   a group (the tabs, ↶ ↷, Save, Find's field), 8 px apart. The leading side holds where you
 *   are (◆ ▤ and the tabs; in the Pages grid the selected tab adds the page count), the
 *   trailing side what you do to the file (Find, ↶ ↷, Save, ◎). The canvas shows between
 *   every piece; the page scrolls beneath them. The `header` itself is a transparent,
 *   pointer-transparent line whose box (the inset and the pieces' height) is the free
 *   rectangle's top inset (frame-insets.ts), so jumps and fits land below the pieces (A-12).
 * - The leading side hugs its tabs up to `--lead-max` and never meets the trailing one (24 px
 *   between them at the least); past that the tabs shrink, then go into "N more"
 *   (DocumentTabs measures the room the pieces leave, not the piece itself).
 * - Landmark `header` named "Document bar" / "Library bar"; Tab order ◆ → ▤ → active tab → "N
 *   more" → + → Find → ↶ → ↷ → Save → ◎; F6 lands on the active tab (the Library: ◆). The
 *   pieces are presentational: they add no stop and no role.
 *
 * No inspector toggle (inventory 3.9): the inspector is gone and its parts live in the History
 * scrubber, the bars' ⋯, the title menu and its sheets (spec D2-9).
 */

import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { LibraryMenu } from '../../home/LibraryMenu';
import { m } from '../../i18n';
import { springWidth } from '../../motion/resize';
import { useExternalRequests } from '../../privacy/external-requests';
import { PrivacyShield } from '../../privacy/PrivacyShield';
import { useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../../state/workspace-store';
import { GridSources } from '../../stage/grid/GridPieces';
import { DocumentTabs } from './DocumentTabs';
import { FindEntry } from './FindEntry';
import { tabDomId } from './ids';
import { LibraryButton } from './LibraryButton';
import { OriginalPill } from './OriginalPill';
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

/**
 * One glass piece (DSN-49): a circle of --piece-h around one control (`solo`, σ 7, registry
 * `top-strip-solo`) or a capsule around a group (σ 8, `top-strip`). The pieces of the strip
 * count as one surface of Q-11's budget (`data-glass-group`).
 */
function Piece({
  name,
  round = false,
  children,
}: {
  readonly name: string;
  readonly round?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={round ? styles.solo : styles.piece}
      data-top-piece={name}
      data-glass-group="top"
    >
      {children}
    </div>
  );
}

export function TopStrip() {
  const hasDocuments = useHasDocuments();
  const onLibrary = useUiStore((s) => s.destination === 'home') || !hasDocuments;
  const grid = useStageView() === 'grid' && !onLibrary;
  const pageCount = useActiveDocument()?.pages.length ?? 0;
  // On the Library ◎ is a warning only: the promise itself is not repeated there (DSN-46).
  const warned = useExternalRequests().count > 0;
  const stripRef = useRef<HTMLElement>(null);

  // Each piece follows its content's width on a spring (G6; motion/resize.ts): Save, Find and
  // the tabs never make a piece jump. A tab growing in or collapsing moves the tabs piece
  // itself (DocumentTabs), which then only follows its layout. Pieces come and go with the
  // view (▤, the document's trailing side), so they are found again when it changes.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    const stops = [...strip.querySelectorAll<HTMLElement>('[data-top-piece]')].map((piece) =>
      piece.dataset.topPiece === 'tabs'
        ? springWidth(piece, { hold: () => piece.querySelector('[data-tab-motion]') !== null })
        : springWidth(piece),
    );
    return () => {
      for (const stop of stops) stop();
    };
  }, [onLibrary, warned]);

  return (
    <header
      ref={stripRef}
      className={styles.strip}
      aria-label={onLibrary ? m.frame_library_bar() : m.frame_document_bar()}
      data-region="top"
      data-frame-layer="top"
      data-destination={onLibrary ? 'library' : 'document'}
    >
      <div className={styles.side} data-top-side="lead" data-bar="title">
        {/* ◆ is a circle in a document, the "◆ Library" capsule on the Library. */}
        <Piece name="home" round={!onLibrary}>
          <LibraryButton current={onLibrary} />
        </Piece>
        {onLibrary ? null : (
          <Piece name="sidebar" round>
            <SidebarToggle />
          </Piece>
        )}
        {/* With no document open the piece holds + alone: a circle. */}
        <Piece name="tabs" round={!hasDocuments}>
          <DocumentTabs
            onLibrary={onLibrary}
            pageCount={grid ? pageCount : undefined}
            after={grid ? <GridSources /> : null}
          />
        </Piece>
      </div>
      <div
        className={`${styles.side} ${styles.trail}`}
        data-top-side="trail"
        data-bar="title-trail"
      >
        {/* The Library's trailing side is one control, ⋯ (R11, the owner's "maybe too big"). */}
        {onLibrary ? (
          <>
            {warned ? (
              <Piece name="privacy" round>
                <PrivacyShield />
              </Piece>
            ) : null}
            <Piece name="more" round>
              <LibraryMenu />
            </Piece>
          </>
        ) : (
          <>
            {/* ⌕ is a circle; Find's field (from 1280 px, or opened) grows it into a capsule. */}
            <Piece name="find" round>
              <FindEntry />
            </Piece>
            <Piece name="history">
              <UndoRedo />
            </Piece>
            <Piece name="save">
              <SaveButton />
            </Piece>
            <Piece name="privacy" round>
              <PrivacyShield />
            </Piece>
          </>
        )}
      </div>
      {onLibrary ? null : <TitleMenu anchor={activeTabElement} />}
      <OriginalPill onLibrary={onLibrary} />
    </header>
  );
}
