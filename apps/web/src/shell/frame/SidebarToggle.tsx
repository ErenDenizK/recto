/**
 * ▤ Sidebar (`components/01-frame.md` F3): toggles the sidebar (Mod+B), in a document on
 * medium and up and in the compact-height bar (spec 01.7). Pressed while the sidebar shows:
 * the n5 fill and `aria-pressed`; focus stays on the button. It replaces the rail's toggle
 * (5.1); the inspector toggle (3.9) leaves with the inspector (D2-9).
 */

import { m } from '../../i18n';
import { IconButton } from '../../ui/IconButton';
import { useCommandShortcut } from '../use-command-shortcut';
import { toggleSidebar, useSidebarShown } from './frame-store';
import { SIDEBAR_ID } from './ids';
import { Icon } from '../../ui/Icon';

export function SidebarToggle() {
  const open = useSidebarShown();
  const shortcut = useCommandShortcut('view.toggleLeftPanel');
  return (
    <IconButton
      label={open ? m.frame_sidebar_hide() : m.frame_sidebar_show()}
      icon={<Icon name="sidebar-simple" />}
      shortcut={shortcut}
      aria-pressed={open}
      aria-controls={open ? SIDEBAR_ID : undefined}
      data-testid="sidebar-toggle"
      onClick={toggleSidebar}
    />
  );
}
