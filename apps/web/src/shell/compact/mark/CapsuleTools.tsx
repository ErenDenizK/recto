/**
 * The single capsule's editing content (EDN-24, Labs `phone-capsule`; plan "Component
 * structure"): Undo, a hairline, the four tools (Pen, Highlight, Text, Sign), a hairline and
 * Done, inside the `compact-capsule` nav the host renders. It replaces `EditIsland` while the
 * switch is on.
 *
 * - **Undo** is fixed at the leading end, always there, `aria-disabled` at the editing floor
 *   (`canUndoHere`). Redo is the chip above it (`RedoChip.tsx`).
 * - **The tools** are a `role="group"` of toggle buttons: the pressed one is `trayTool(...)` (the
 *   Eraser counts as the tool it took over from, Edit text as Text), carries `aria-pressed`,
 *   `aria-expanded` for its tray and `data-compact-tool-chip` (the Use flight and `chipOf()` find
 *   it there). Edit text stays registered but is not in the row. A tap is `tapCapsuleTool`.
 * - **The wash** is one element under the pressed tool; it slides between tools by a transform
 *   on `smooth` (MOT-14: no layout), the position a stylesheet rule of `data-index`, so nothing
 *   is inline at rest (Q-2). Reduced motion: it fades (`CapsuleTools.module.css`).
 * - **Done** is the one lime (`prominent`); under 350 px it is a check icon, its name unchanged.
 *
 * `installTrayOpener()` runs here, so a tool that goes from off to on (a signature field, the
 * selection bar's Edit text) opens its tray. Every target is 44 px (Q-9).
 */
import { useEffect } from 'react';

import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { type CompactTool, useCompactStore } from '../compact-store';
import { canUndoHere, eraserFrom, exitEditing, undo } from './bridge';
import { installTrayOpener, tapCapsuleTool, trayTool } from './capsule-state';
import styles from './CapsuleTools.module.css';
import { useCompactTools } from './registry';

/** The tray the pressed tool controls (`CapsuleTray.tsx`). */
export const TRAY_ID = 'compact-tool-tray';

/** The capsule's tools, left to right; Edit text and the Eraser live in the trays. */
export const CAPSULE_TOOLS: readonly CompactTool[] = ['pen', 'highlight', 'text', 'sign'];

export function CapsuleTools() {
  const tool = useCompactStore((s) => s.tool);
  const lastTool = useCompactStore((s) => s.lastTool);
  const trayOpen = useCompactStore((s) => s.trayOpen);
  const history = useWorkspaceStore((s) => s.history);
  const specs = useCompactTools();
  const undoable = canUndoHere(history);
  const pressed = trayTool(tool, eraserFrom());
  // The wash rests under the last pressed tool while the tool is off, so it fades in place.
  const index = Math.max(
    0,
    CAPSULE_TOOLS.indexOf(pressed ?? trayTool(lastTool, eraserFrom()) ?? 'pen'),
  );

  useEffect(() => installTrayOpener(), []);

  return (
    <>
      <IconButton
        label={m.compact_undo()}
        tooltipSide="top"
        icon={<Icon name="arrow-u-up-left" />}
        className={styles.undo}
        aria-disabled={!undoable || undefined}
        data-testid="compact-undo"
        onClick={() => undo()}
      />
      <span className={styles.rule} aria-hidden="true" />
      <div
        className={styles.group}
        role="group"
        aria-label={m.compact_tools()}
        data-index={index}
        data-armed={pressed !== null || undefined}
      >
        <span className={styles.wash} aria-hidden="true" data-testid="compact-capsule-wash" />
        {CAPSULE_TOOLS.map((id) => {
          const spec = specs.get(id);
          if (!spec) return null;
          const on = pressed === id;
          return (
            <IconButton
              key={id}
              label={spec.label()}
              tooltipSide="top"
              icon={<Icon name={spec.glyph} />}
              className={styles.tool}
              aria-pressed={on}
              aria-expanded={on ? trayOpen : undefined}
              aria-controls={on ? TRAY_ID : undefined}
              data-compact-tool-chip={on ? '' : undefined}
              data-capsule-focus={id === 'pen' ? '' : undefined}
              data-testid={`compact-capsule-tool-${id}`}
              onClick={(event) => {
                void receivePulse(event.currentTarget);
                tapCapsuleTool(id);
              }}
            />
          );
        })}
      </div>
      <span className={styles.rule} aria-hidden="true" />
      <Button
        variant="prominent"
        className={styles.done}
        aria-label={m.compact_done()}
        data-testid="compact-edit-done"
        onClick={exitEditing}
      >
        <span className={styles.doneText}>{m.compact_done()}</span>
        <Icon name="check" className={styles.doneIcon} />
      </Button>
    </>
  );
}
