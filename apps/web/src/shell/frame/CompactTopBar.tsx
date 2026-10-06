/**
 * The compact top bar (`components/01-frame.md` F9; flows.md §6.1, §6.3, §6.4; M-6): the full
 * edition's frame on compact and compact-height windows (a narrow desktop window, a desktop at
 * 400 % zoom; phones themselves get the compact edition, ADR-0033).
 *
 *   document:        ‹ 3 │ report.pdf ▾ │ ↶ │ ↷ │ ⌕         44 px buttons, title ≥ 64 px
 *   compact-height:  ‹ 3 │ ▤ │ report.pdf ▾ │ ↶ │ ↷ │ ⌕
 *   Library:         ◆ Recto                    │ ◎ │ ⋯
 *
 * - ‹ N goes to the Library (named "Library, 3 open documents"); the title opens the title
 *   menu (the only home of Save here); ↶ ↷ as the strip's; ⌕ lays the Find field over the bar.
 * - **Folding:** below 336 px ↷ leaves the bar and the title menu gains a first row "Redo"
 *   (spec 01.8; A-20's 320 px case). ⓘ (facts) arrives with D4-3.
 * - **Short viewports** (`data-tight`, height < 352): the bar folds into one 44 px capsule at
 *   the bottom, holding ‹ N, the title, ↶ and ⋯ (More takes ↷, Find, Markup, Go to page and
 *   Focus), so 320 × 256 keeps chrome near 17 % of the window (A-20; F1 §6). The dock and the
 *   pill step aside in viewing there.
 * - Hides on scroll with the dock (`hide-on-scroll.ts`): moved out by transform and `inert`
 *   from the first frame.
 */
import { Menu } from '@base-ui/react/menu';
import { useSyncExternalStore } from 'react';

import { commandRegistry } from '../../commands/registry';
import { formatNumber, m } from '../../i18n';
import { PrivacyShield } from '../../privacy/PrivacyShield';
import { useLock } from '../../state/lock-store';
import { matchesMark, useSavedStore } from '../../state/saved-store';
import { useUiStore } from '../../state/ui-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { IconButton } from '../../ui/IconButton';
import menuStyles from '../../ui/Menu.module.css';
import { AppGlyph } from '../AppGlyph';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './CompactTopBar.module.css';
import { FindEntry } from './FindEntry';
import { openTitleMenu, useFrameStore } from './frame-store';
import { LibraryMenu } from './LibraryMenu';
import { SidebarToggle } from './SidebarToggle';
import { TitleMenu } from './TitleMenu';
import { UndoRedo } from './UndoRedo';
import { Icon } from '../../ui/Icon';

/** Below this width ↷ moves into the title menu (spec 01.8). */
export const REDO_FOLD_WIDTH = 336;

const subscribeWidth = (listener: () => void) => {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
};
const windowWidth = () => window.innerWidth;

const titleButton = () => document.getElementById('compact-title');

export function CompactTopBar({
  short,
  tight,
}: {
  /** compact-height: the bar gets ▤ (spec 01.7). */
  readonly short: boolean;
  /** A short viewport: the bar becomes the bottom capsule. */
  readonly tight: boolean;
}) {
  const doc = useActiveDocument();
  const width = useSyncExternalStore(subscribeWidth, windowWidth, windowWidth);
  const onLibrary = useUiStore((s) => s.destination === 'home') || doc === undefined;
  const count = useWorkspaceStore((s) => s.workspace.documentOrder.length);
  const hidden = useFrameStore((s) => s.chromeHidden);
  const focus = useFrameStore((s) => s.focusMode);
  const away = hidden || (focus && !tight);
  const redoFolds = width < REDO_FOLD_WIDTH || tight;

  return (
    <header
      className={styles.bar}
      aria-label={onLibrary ? m.frame_library_bar() : m.frame_document_bar()}
      data-region="top"
      data-frame-layer={tight ? undefined : 'top'}
      data-bar="title"
      data-tight={tight || undefined}
      data-away={away || undefined}
      data-fold-redo={(redoFolds && !onLibrary) || undefined}
      data-hides-on-scroll=""
      inert={away}
    >
      {onLibrary ? (
        <>
          <p className={styles.brand}>
            <AppGlyph size={20} />
            <span>{m.frame_brand()}</span>
          </p>
          <span className={styles.spacer} />
          <PrivacyShield />
          <LibraryMenu />
        </>
      ) : (
        <>
          <BackButton count={count} />
          {short && !tight ? <SidebarToggle /> : null}
          <TitleButton />
          <UndoRedo />
          {tight ? <MoreMenu /> : <FindEntry form="button" />}
          <TitleMenu anchor={titleButton} withRedo={redoFolds} />
        </>
      )}
    </header>
  );
}

/** ‹ N: back to the Library, with the number of open documents. */
function BackButton({ count }: { readonly count: number }) {
  const shortcut = useCommandShortcut('view.home');
  return (
    <IconButton
      className={styles.back}
      label={m.frame_back_name({ count })}
      shortcut={shortcut}
      data-testid="home-button"
      icon={
        <span className={styles.backIcon}>
          <Icon name="caret-left" aria-hidden="true" />
          <span className={styles.backCount}>{formatNumber(count)}</span>
        </span>
      }
      onClick={() => void commandRegistry.execute('view.home')}
    />
  );
}

/** The title, the document menu's trigger (F9 §5). */
function TitleButton() {
  const doc = useActiveDocument();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const marks = useSavedStore((s) => s.marks);
  const lock = useLock(doc?.id);
  const open = useFrameStore((s) => s.titleMenu !== null);
  if (!doc) return null;
  const edited = !matchesMark(workspace, doc.id, marks[doc.id]);
  return (
    <button
      type="button"
      id="compact-title"
      className={styles.title}
      aria-label={m.frame_compact_title_name({ name: doc.title })}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-testid="document-menu"
      title={doc.title}
      onClick={() => openTitleMenu('menu')}
    >
      <span className={styles.titleText}>{doc.title}</span>
      {edited ? <span className={styles.edited} aria-hidden="true" /> : null}
      {lock ? <Icon name="lock-simple" className={styles.lock} aria-hidden="true" /> : null}
      <Icon name="caret-down" className={styles.caret} aria-hidden="true" />
    </button>
  );
}

/** ⋯ in the short capsule: what the folded bar, the dock and the pill held (F1 §6). */
function MoreMenu() {
  const items: readonly { id: string; label: () => string; run: () => void }[] = [
    { id: 'edit.redo', label: m.cmd_redo, run: () => void commandRegistry.execute('edit.redo') },
    {
      id: 'search.open',
      label: m.frame_find,
      run: () => void commandRegistry.execute('search.open'),
    },
    {
      id: 'mode.edit',
      label: m.frame_markup,
      run: () => void commandRegistry.execute('mode.edit'),
    },
    {
      id: 'nav.goToPage',
      label: m.goto_title,
      run: () => void commandRegistry.execute('nav.goToPage'),
    },
    {
      id: 'view.focus',
      label: m.frame_focus,
      run: () => void commandRegistry.execute('view.focus'),
    },
  ];
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <IconButton
            label={m.frame_more()}
            icon={<Icon name="dots-three" />}
            data-testid="compact-more"
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            {items.map((item) => (
              <Menu.Item key={item.id} className={menuStyles.item} onClick={item.run}>
                <span className={menuStyles.label}>{item.label()}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
