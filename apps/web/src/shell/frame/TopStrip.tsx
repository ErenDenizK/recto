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
 * - Material: docked M3 (materials.css): the frame colour at rest over the bare canvas, glass
 *   where the page passes beneath it while scrolling; hairline on the bottom edge only.
 * - Landmark `header` named "Document bar" / "Library bar"; Tab order ◆ → ▤ → active tab → "N
 *   more" → + → Find → ↶ → ↷ → Save → ◎; F6 lands on the active tab (the Library: ◆).
 *
 * The inspector toggle stays at the trailing end until the inspector leaves (D2-9, spec 3.9).
 */

import { LibraryMenu } from '../../home/LibraryMenu';
import { m } from '../../i18n';
import { PrivacyShield } from '../../privacy/PrivacyShield';
import { useUiStore } from '../../state/ui-store';
import { useHasDocuments, useWorkspaceStore } from '../../state/workspace-store';
import { IconButton } from '../../ui/IconButton';
import { useCommandShortcut } from '../use-command-shortcut';
import { DocumentTabs } from './DocumentTabs';
import { FindEntry } from './FindEntry';
import { tabDomId } from './ids';
import { LibraryButton } from './LibraryButton';
import { SaveButton } from './SaveButton';
import { SidebarToggle } from './SidebarToggle';
import { TitleMenu } from './TitleMenu';
import styles from './TopStrip.module.css';
import { UndoRedo } from './UndoRedo';
import { Icon } from '../../ui/Icon';

/** The active tab, where the title menu opens and gives focus back. */
export const activeTabElement = (): HTMLElement | null => {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  return id === undefined ? null : document.getElementById(tabDomId(id));
};

export function TopStrip() {
  const hasDocuments = useHasDocuments();
  const onLibrary = useUiStore((s) => s.destination === 'home') || !hasDocuments;
  return (
    <header
      className={styles.strip}
      aria-label={onLibrary ? m.frame_library_bar() : m.frame_document_bar()}
      data-region="top"
      data-frame-layer="top"
      data-bar="title"
      data-destination={onLibrary ? 'library' : 'document'}
    >
      <div className={styles.lead}>
        <LibraryButton current={onLibrary} />
        {onLibrary ? null : <SidebarToggle />}
      </div>
      <DocumentTabs onLibrary={onLibrary} />
      <div className={styles.trail}>
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
            <InspectorToggle />
            <PrivacyShield />
          </>
        )}
      </div>
      {onLibrary ? null : <TitleMenu anchor={activeTabElement} />}
    </header>
  );
}

/** The inspector's toggle, until the inspector leaves (D2-9). */
function InspectorToggle() {
  const open = useUiStore((s) => s.rightPanelOpen);
  const toggle = useUiStore((s) => s.toggleRightPanel);
  const shortcut = useCommandShortcut('view.toggleRightPanel');
  return (
    <IconButton
      label={open ? m.right_panel_hide() : m.right_panel_show()}
      icon={<Icon name="sidebar-simple" />}
      shortcut={shortcut}
      aria-pressed={open}
      aria-controls={open ? 'right-panel' : undefined}
      onClick={toggle}
    />
  );
}
