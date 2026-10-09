/**
 * ▤ Sidebar (`components/01-frame.md` F3): toggles the sidebar (Mod+B), in a document on
 * medium and up and in the compact-height bar (spec 01.7). Pressed while the sidebar shows:
 * the n5 fill and `aria-pressed`; focus stays on the button. It replaces the rail's toggle
 * (5.1); the inspector toggle (3.9) left with the inspector (D2-9).
 *
 * The glyph morphs with the sidebar (motion-2026-10 frame.md §1): Phosphor's sidebar-simple,
 * whose leading pane fills from its edge as the sidebar slides in and empties as it goes, on
 * the sidebar's own `--spring-smooth` (`SidebarToggle.module.css`).
 */

import { m } from '../../i18n';
import { IconButton } from '../../ui/IconButton';
import { useCommandShortcut } from '../use-command-shortcut';
import { toggleSidebar, useSidebarShown } from './frame-store';
import { SIDEBAR_ID } from './ids';
import styles from './SidebarToggle.module.css';

/** Phosphor's sidebar-simple (regular), the frame and its pane's rule. */
const FRAME_PATH =
  'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM40,56H80V200H40ZM216,200H96V56H216V200Z';

/** ▤ with its pane filled while `open`. */
function SidebarGlyph({ open }: { readonly open: boolean }) {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      focusable="false"
      aria-hidden="true"
      className={styles.glyph}
      data-icon="sidebar-simple"
      data-open={open || undefined}
    >
      <path d={FRAME_PATH} />
      <rect className={styles.pane} x="40" y="56" width="40" height="144" />
    </svg>
  );
}

export function SidebarToggle() {
  const open = useSidebarShown();
  const shortcut = useCommandShortcut('view.toggleLeftPanel');
  return (
    <IconButton
      label={open ? m.frame_sidebar_hide() : m.frame_sidebar_show()}
      icon={<SidebarGlyph open={open} />}
      shortcut={shortcut}
      aria-pressed={open}
      aria-controls={open ? SIDEBAR_ID : undefined}
      data-testid="sidebar-toggle"
      onClick={toggleSidebar}
    />
  );
}
