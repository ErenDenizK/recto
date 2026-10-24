/**
 * The Library ⋯ menu (`02-library` L12, decision 02.18; DSN-47): the app's doors, Settings… ·
 * Keyboard shortcuts (fine pointers only) · About Recto. Try the sample, Combine files… and
 * Batch… are the launcher's buttons, their one home on the Library (DSN-46). Spec L12 places the
 * menu in the top strip: the frame's strip and compact bar mount it (D2-1). Base UI `Menu` with
 * the menu recipe (M4); guard: none, nothing here changes a document.
 */
import { Menu } from '@base-ui/react/menu';
import { useRef } from 'react';

import { commandRegistry } from '../commands/registry';
import { openSettings } from '../settings/open-settings';
import { PRODUCT_NAME } from '../shell/about/build-info';
import { usePointerCapabilities } from '../shell/frame/input-modality';
import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import iconButtonStyles from '../ui/IconButton.module.css';
import menuStyles from '../ui/Menu.module.css';
import { Tooltip } from '../ui/Tooltip';

interface Item {
  readonly id: string;
  readonly label: () => string;
  readonly run: (trigger: HTMLElement | null) => void;
  /** Shown only with a fine pointer (Keyboard shortcuts, 02.18). */
  readonly fineOnly?: boolean;
}

const ITEMS: readonly Item[] = [
  {
    id: 'settings',
    label: m.settings_command,
    // Focus returns to the ⋯ trigger when Settings closes (the menu has closed by then).
    run: (trigger) => openSettings(undefined, { returnTo: trigger }),
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
  const trigger = useRef<HTMLButtonElement>(null);
  const fine = pointers.primary === 'fine' || pointers.anyFine;
  return (
    <Menu.Root>
      <Tooltip label={m.library_more()}>
        <Menu.Trigger
          ref={trigger}
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
                onClick={() => item.run(trigger.current)}
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
