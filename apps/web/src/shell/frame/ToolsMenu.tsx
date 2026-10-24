/**
 * The dock's Tools entry (R28 tools-visibility prototype, DSN-76; flag `tools-flag.ts`): the
 * document power tools the README sells, as a menu above the dock. Each row is a doorway to the
 * command the title menu already runs (DSN-46: a second appearance needs a reason, recorded in
 * DSN-76), so `commandRegistry.execute(id)` is the whole act and a row dims with the command's
 * own reason. The menu is the dock's More recipe (`ui/Menu.module.css`, Base UI Menu): Esc
 * closes it and returns focus to the entry, the arrows move through the rows.
 */
import { Menu } from '@base-ui/react/menu';
import { useState } from 'react';

import { commandRegistry } from '../../commands/registry';
import { m } from '../../i18n';
import { abovePalette } from '../../markup/anchor';
import { Icon, type IconName } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { Tooltip } from '../../ui/Tooltip';
import styles from './Dock.module.css';
import toolStyles from './ToolsMenu.module.css';

export interface ToolEntry {
  /** The command the title menu (or the dock's More) runs for the same act. */
  readonly id: string;
  readonly label: () => string;
  readonly description: () => string;
  readonly icon: IconName;
}

/** The tools, in the order the README sells them; every id is a registered command. */
export const TOOL_ENTRIES: readonly ToolEntry[] = [
  { id: 'tool.redact', label: m.tools_redact, description: m.tools_redact_hint, icon: 'redact' },
  { id: 'document.ocr', label: m.tools_ocr, description: m.tools_ocr_hint, icon: 'scan' },
  {
    id: 'mode.compare',
    label: m.tools_compare,
    description: m.tools_compare_hint,
    icon: 'compare',
  },
  {
    id: 'documents.mergeAll',
    label: m.tools_combine,
    description: m.tools_combine_hint,
    icon: 'stack',
  },
  { id: 'section.split', label: m.tools_split, description: m.tools_split_hint, icon: 'columns' },
  {
    id: 'document.compress',
    label: m.tools_compress,
    description: m.tools_compress_hint,
    icon: 'file',
  },
];

export function ToolsMenu() {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  return (
    <Menu.Root>
      <Tooltip label={m.dock_tools()} side="top">
        <Menu.Trigger
          ref={setTrigger}
          className={`btn btn-quiet ${styles.item}`}
          data-capsule-item="tools"
          data-dock-item="tools"
        >
          <Icon name="sliders-horizontal" className={styles.icon} />
          <span data-btn-label="">{m.dock_tools()}</span>
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          side="top"
          align="center"
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
        <span className={menuStyles.label}>{tool.label()}</span>
        <span className={toolStyles.hint}>{reason ?? tool.description()}</span>
      </span>
    </Menu.Item>
  );
}
