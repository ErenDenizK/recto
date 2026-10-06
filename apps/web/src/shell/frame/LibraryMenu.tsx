/**
 * ⋯ on the Library's strip (`components/01-frame.md` F2 §1; family 04's Library menu): the
 * app's own items while no document shows: Settings…, Keyboard shortcuts, About Recto. In a
 * document the strip has no ⋯ (view options live in the pill, app items in the dock's More);
 * until the dock (D2-2) brings More, the title menu ends with the same three rows.
 */
import { Menu } from '@base-ui/react/menu';
import { MoreHorizontal } from 'lucide-react';

import { commandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { openSettings } from '../../settings/open-settings';
import { IconButton } from '../../ui/IconButton';
import menuStyles from '../../ui/Menu.module.css';

/** The app items, shared with the title menu's interim tail. */
export const APP_ITEMS = [
  { id: 'settings', label: () => m.frame_settings(), run: () => openSettings() },
  {
    id: 'shortcuts',
    label: () => m.frame_keyboard_shortcuts(),
    run: () => void commandRegistry.execute('help.shortcuts'),
  },
  {
    id: 'about',
    label: () => m.menu_about_page(),
    run: () => void commandRegistry.execute('help.aboutPage'),
  },
] as const;

export function LibraryMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <IconButton label={m.frame_more()} icon={<MoreHorizontal />} data-testid="library-menu" />
        }
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            {APP_ITEMS.map((item) => (
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
