/**
 * The Library ⋯ menu (`02-library` L12, decision 02.18): Combine files… · Batch… · Settings… ·
 * Keyboard shortcuts (fine pointers only) · About Recto. Try the sample joins it first with the
 * teaching sample (D4-2). Spec L12 places the menu in the top strip; until the M9 top strip
 * (D2-1) hosts it, the launcher carries this trigger, and the strip can mount the same
 * component. Base UI `Menu` with the menu recipe (M4); guard: none, nothing here changes a
 * document.
 */
import { Menu } from '@base-ui/react/menu';

import { commandRegistry } from '../commands/registry';
import { PRODUCT_NAME } from '../shell/about/build-info';
import { usePointerCapabilities } from '../shell/frame/input-modality';
import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import iconButtonStyles from '../ui/IconButton.module.css';
import menuStyles from '../ui/Menu.module.css';
import { Tooltip } from '../ui/Tooltip';
import { combineFiles } from './home-actions';

interface Item {
  readonly id: string;
  readonly label: () => string;
  readonly run: () => void;
  /** Shown only with a fine pointer (Keyboard shortcuts, 02.18). */
  readonly fineOnly?: boolean;
}

const ITEMS: readonly Item[] = [
  { id: 'combine-files', label: m.library_combine_files, run: () => void combineFiles() },
  { id: 'batch', label: m.cmd_batch, run: () => void commandRegistry.execute('document.batch') },
  {
    id: 'settings',
    label: m.settings_command,
    run: () => void commandRegistry.execute('settings.open'),
  },
  {
    id: 'shortcuts',
    label: m.keyboard_shortcuts,
    run: () => void commandRegistry.execute('help.shortcuts'),
    fineOnly: true,
  },
  {
    id: 'about',
    label: () => m.about_command({ name: PRODUCT_NAME }),
    run: () => void commandRegistry.execute('help.about'),
  },
];

export function LibraryMenu({ className }: { readonly className?: string | undefined }) {
  const pointers = usePointerCapabilities();
  const fine = pointers.primary === 'fine' || pointers.anyFine;
  return (
    <Menu.Root>
      <Tooltip label={m.library_more()}>
        <Menu.Trigger
          className={[iconButtonStyles.button, className].filter(Boolean).join(' ')}
          data-size="bar"
          aria-label={m.library_more()}
          data-testid="library-menu"
        >
          <Icon name="dots-three" />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            {ITEMS.filter((item) => fine || item.fineOnly !== true).map((item) => (
              <Menu.Item
                key={item.id}
                className={menuStyles.item}
                data-testid={`library-menu-${item.id}`}
                onClick={item.run}
              >
                <span className={menuStyles.label}>{item.label()}</span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
