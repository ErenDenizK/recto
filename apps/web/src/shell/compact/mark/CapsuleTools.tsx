/**
 * The single capsule's editing content (EDN-24, EDN-29; plan "Component structure"): the five
 * tools (Pen, Highlight, Text, Edit text, Sign) and Done, inside the `compact-capsule` nav the
 * host renders. It replaces `EditIsland` unless the address says `?phonebar=0`.
 *
 * - **The tools** are a `role="group"` of toggle buttons, 48 px slots with 24 px glyphs: the
 *   pressed one is `pressedTool(...)` (the Eraser counts as the tool it took over from), carries
 *   `aria-pressed`, `aria-expanded` for its tray and `data-compact-tool-chip` (the Use flight and
 *   `chipOf()` find it there). A tap is `tapCapsuleTool`.
 * - **Undo and Redo** are chips beside the tray, outside this row (`RedoChip.tsx`): five tools and
 *   Done fill the capsule's width.
 * - **The wash** is one lime circle under the pressed tool, the armed tool's one lime (DSN-89);
 *   it slides between tools by a transform on `smooth` (MOT-14: no layout), the position a
 *   stylesheet rule of `data-index`, so nothing is inline at rest (Q-2). Reduced motion: it fades.
 * - **Done** is the capsule's one word, a text pill at the trailing end (DSN-91); under 350 px it
 *   is a check icon, its name unchanged.
 *
 * `installTrayOpener()` runs here, so a tool that goes from off to on (a signature field, the
 * selection bar's Edit text) opens its tray. Every target is 44 px or more (Q-9).
 */
import { useEffect } from 'react';

import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { type CompactTool, useCompactStore } from '../compact-store';
import { eraserFrom, exitEditing } from './bridge';
import { installTrayOpener, pressedTool, tapCapsuleTool } from './capsule-state';
import styles from './CapsuleTools.module.css';
import { useCompactTools } from './registry';

/** The tray the pressed tool controls (`CapsuleTray.tsx`). */
export const TRAY_ID = 'compact-tool-tray';

/** The capsule's tools, left to right; the Eraser lives in the Pen's and Highlight's trays. */
export const CAPSULE_TOOLS: readonly CompactTool[] = [
  'pen',
  'highlight',
  'text',
  'edit-text',
  'sign',
];

export function CapsuleTools() {
  const tool = useCompactStore((s) => s.tool);
  const lastTool = useCompactStore((s) => s.lastTool);
  const trayOpen = useCompactStore((s) => s.trayOpen);
  const specs = useCompactTools();
  const pressed = pressedTool(tool, eraserFrom());
  // The wash rests under the last pressed tool while the tool is off, so it fades in place.
  const index = Math.max(
    0,
    CAPSULE_TOOLS.indexOf(pressed ?? pressedTool(lastTool, eraserFrom()) ?? 'pen'),
  );

  useEffect(() => installTrayOpener(), []);

  return (
    <>
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
      <Button
        variant="quiet"
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
