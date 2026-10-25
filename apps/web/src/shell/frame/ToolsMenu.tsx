/**
 * The dock's Tools entry (R28 tools-visibility, DSN-76, in force): the
 * document power tools the README sells, as a menu above the dock. Each row is a doorway to the
 * command the title menu already runs (DSN-46: a second appearance needs a reason, recorded in
 * DSN-76), so `commandRegistry.execute(id)` is the whole act and a row dims with the command's
 * own reason, and no tooltip repeats the visible label (RA-20). The menu is the dock's More recipe (`ui/Menu.module.css`, Base UI Menu): Esc
 * closes it and returns focus to the entry, the arrows move through the rows.
 */
import { Menu } from '@base-ui/react/menu';
import { useState } from 'react';

import { commandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { abovePalette } from '../../markup/anchor';
import { Icon, type IconName } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import styles from './Dock.module.css';
import toolStyles from './ToolsMenu.module.css';

export interface ToolEntry {
  /** The command the title menu (or the dock's More) runs for the same act. */
  readonly id: string;
  /** The label the command already wears where it lives (DSN-52: one command, one label). */
  readonly label?: () => string;
  readonly description: () => string;
  readonly icon: IconName;
}

/**
 * The tools, in the order the README sells them; every id is a registered command. A row wears
 * the title menu's label for its command (`command.title`, or the override the title menu
 * passes: Split…, Compare with…), Redact the dock More's.
 */
export const TOOL_ENTRIES: readonly ToolEntry[] = [
  {
    id: 'tool.redact',
    label: m.dock_more_redact,
    description: m.tools_redact_hint,
    icon: 'redact',
  },
  { id: 'document.ocr', description: m.tools_ocr_hint, icon: 'scan' },
  { id: 'mode.compare', label: m.menu_compare, description: m.tools_compare_hint, icon: 'compare' },
  { id: 'documents.mergeAll', description: m.tools_combine_hint, icon: 'stack' },
  { id: 'section.split', label: m.menu_split, description: m.tools_split_hint, icon: 'scissors' },
  {
    id: 'document.compress',
    description: m.tools_compress_hint,
    icon: 'arrows-in-simple',
  },
];

export function ToolsMenu() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Menu.Root>
      <Menu.Trigger
        ref={setTrigger}
        className={`btn btn-quiet ${styles.item}`}
        data-capsule-item="tools"
        data-dock-item="tools"
      >
        <Icon name="wrench" className={styles.icon} />
        <span data-btn-label="">{m.dock_tools()}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          anchor={abovePalette(() => trigger)}
        >
          <Menu.Popup className={menuStyles.popup} aria-label={m.dock_tools()}>
            {TOOL_ENTRIES.map((tool) => (
              <ToolItem key={tool.id} tool={tool} />
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ToolItem({ tool }: { readonly tool: ToolEntry }) {
  const command = commandRegistry.get(tool.id);
  if (!command) return null;
  const enabled = commandRegistry.isEnabled(command);
  const reason = enabled ? undefined : commandRegistry.disabledReason(command);
  return (
    <Menu.Item
      className={`${menuStyles.item} ${toolStyles.row}`}
      data-command={tool.id}
      disabled={!enabled}
      onClick={() => void commandRegistry.execute(tool.id)}
    >
      <Icon name={tool.icon} aria-hidden="true" />
      <span className={toolStyles.text}>
        <span className={menuStyles.label}>{tool.label?.() ?? command.title}</span>
        <span className={toolStyles.hint}>{reason ?? tool.description()}</span>
      </span>
    </Menu.Item>
  );
}
