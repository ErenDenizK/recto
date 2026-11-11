/**
 * The action panel (DSN-93, `home-recents.html`): one smoked panel of rows beside Continue, "Ways
 * to start" (the group's label): Open or drop files ⌘O, Combine files ›, Fill and sign ›, Scan
 * where scan is on and a camera exists, All commands ⌘K. Each row is 72 high with a 24 px glyph
 * in the secondary colour (Open's is lime), the label at the action step and a keycap or a
 * caret. A hairline runs between rows. Batch and the conversions are reached through ⌘K.
 *
 * One tab stop: a roving tabindex, with the arrows moving down and up, Home and End going to the
 * ends, Enter or Space running the row. Open or drop files carries `data-library-open` and
 * `library-open`; Combine, Sign and Scan keep the launcher's test ids (`library-combine-files`,
 * `library-sign`, `library-scan`); All commands is `home-all-commands`.
 *
 * While a file is dragged over the window an inset ring takes the panel and Open's label becomes
 * "Drop to open" (with the count when the drag tells it).
 */
import { type KeyboardEvent, useId, useRef, useState } from 'react';

import { useCommand } from '../commands/use-commands';
import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { openScan } from '../scan/scan-flag';
import { useWorkspaceStore } from '../state/workspace-store';
import { Icon, type IconName } from '../ui/Icon';
import { Keycaps } from '../ui/Keycaps';
import { dropTitle } from './DropOverlay';
import styles from './DeskPanel.module.css';
import { combineFiles, openPdfs } from './home-actions';

interface Row {
  readonly id: string;
  readonly testId: string;
  readonly icon: IconName;
  readonly label: string;
  /** A keycap of this command's shortcut, or a caret when there is none. */
  readonly keys?: string;
  readonly caret: boolean;
  readonly run: () => void;
}

export function DeskPanel({
  scan,
  dragging,
  dragCount,
}: {
  /** The Scan row shows (scan is on and a camera exists). */
  readonly scan: boolean;
  /** A file drag is over the window. */
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
}) {
  // A file waiting on its password still counts as opening; the prompt is what is on screen.
  const opening = useWorkspaceStore((s) => s.opening > 0);
  const [focused, setFocused] = useState('open');
  const listRef = useRef<HTMLDivElement>(null);
  const base = useId();
  const open = useCommand('file.open');
  const palette = useCommand('view.palette');

  const rows: Row[] = [
    {
      id: 'open',
      testId: 'library-open',
      icon: 'folder-open',
      label: dragging ? dropTitle(dragCount) : m.home_open_drop(),
      caret: false,
      run: () => void openPdfs(),
    },
    {
      id: 'combine',
      testId: 'library-combine-files',
      icon: 'stack',
      label: m.home_combine_files(),
      caret: true,
      run: () => void combineFiles(),
    },
    {
      id: 'sign',
      testId: 'library-sign',
      icon: 'signature',
      label: m.home_fill_sign(),
      caret: true,
      run: () => void commandRegistry.execute('file.signPdf'),
    },
    ...(scan
      ? [
          {
            id: 'scan',
            testId: 'library-scan',
            icon: 'scan' as const,
            label: m.scan_button(),
            caret: true,
            run: openScan,
          },
        ]
      : []),
    {
      id: 'commands',
      testId: 'home-all-commands',
      icon: 'dots-three',
      label: m.home_all_commands(),
      caret: false,
      run: () => void commandRegistry.execute('view.palette'),
    },
  ];
  const tabbable = rows.some((row) => row.id === focused) ? focused : 'open';

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-intent]'));
    const index = items.findIndex((item) => item === event.currentTarget);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = (index + 1) % items.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = items[next];
    if (target === undefined) return;
    setFocused(target.getAttribute('data-intent') ?? 'open');
    target.focus();
  };

  return (
    <div
      ref={listRef}
      className={styles.panel}
      role="group"
      aria-label={m.desk_intents_label()}
      data-count={rows.length}
      data-dragging={dragging || undefined}
      data-testid="library-launcher"
    >
      {rows.map((row) => {
        const shortcut =
          row.id === 'open'
            ? open?.shortcuts[0]
            : row.id === 'commands'
              ? palette?.shortcuts[0]
              : undefined;
        return (
          <button
            key={row.id}
            type="button"
            // the panel's rows are lit rows, not action buttons
            // eslint-disable-next-line recto/q9-controls
            className={styles.row}
            data-intent={row.id}
            data-hot={row.id === 'open' || undefined}
            data-testid={row.testId}
            aria-busy={(row.id === 'open' && opening) || undefined}
            aria-labelledby={`${base}-${row.id}`}
            tabIndex={row.id === tabbable ? 0 : -1}
            onFocus={() => setFocused(row.id)}
            onKeyDown={onKeyDown}
            onClick={row.run}
            {...(row.id === 'open' ? { 'data-library-open': '' } : {})}
          >
            <Icon name={row.icon} size={24} className={styles.glyph} />
            <span id={`${base}-${row.id}`} className={styles.label}>
              {row.label}
            </span>
            <span className={styles.spacer} />
            {shortcut !== undefined ? (
              <Keycaps shortcut={shortcut} />
            ) : row.caret ? (
              <Icon name="caret-right" size={16} className={styles.caret} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
