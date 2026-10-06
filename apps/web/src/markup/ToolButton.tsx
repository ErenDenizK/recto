/**
 * The palette's tool button (`03-markup` MK-4): the one control for Select, Eraser, Lasso, Text
 * box, Note, Image, Edit text and Redact, and the shape of Done, Sign and the choice tools.
 *
 * - A `ui/IconButton` circle (32 fine, 44 coarse; Q-9) with a 20 px Phosphor glyph, regular at
 *   rest and the fill twin when armed; with `showLabel` the circle stretches to a pill with
 *   the name beside the glyph (Edit text, Redact, Sign, Done), the same states.
 * - Armed (`aria-pressed` with `data-tool`): the lime fill with an ink glyph (dark theme) or
 *   the ink fill with a lime glyph (light), from `ui/IconButton.module.css`; exactly one tool
 *   is pressed across the palette and the pen well.
 * - Tooltip: the name and key, then "· Esc: Select" when armed, and "Press again for choices"
 *   on a tool whose second press opens choices (`markup_choices_hint`).
 */
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { commandRegistry } from '../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../commands/shortcuts';
import { m } from '../i18n';
import iconButtonStyles from '../ui/IconButton.module.css';
import { Tooltip } from '../ui/Tooltip';
import styles from './MarkupPalette.module.css';

/** The first shortcut of a command, for keycaps and `aria-keyshortcuts`. */
export const shortcutOf = (id: string) => commandRegistry.get(id)?.shortcuts[0];

/** The armed tool's tooltip says how to leave it: "Eraser · Esc: Select" (MK-4 §5). */
export function armedTooltip(text: string, armed: boolean, choices = false): string {
  const base = armed ? m.markup_armed({ tool: text }) : text;
  return choices ? `${base} · ${m.markup_choices_hint()}` : base;
}

export interface PaletteButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  /** Accessible name; the visible label with `showLabel`. */
  readonly label: string;
  readonly icon: ReactNode;
  /** Tooltip when it says more than the name. */
  readonly tooltip?: string | undefined;
  /** A command whose first key the tooltip and `aria-keyshortcuts` show. */
  readonly command?: string | undefined;
  readonly showLabel?: boolean | undefined;
  /** `data-tool`: a tool that arms (the armed fill). */
  readonly tool?: string | undefined;
  /** The palette item this button is (`data-item`, measured by the fold). */
  readonly item?: string | undefined;
}

export function PaletteButton({
  label,
  icon,
  tooltip,
  command,
  showLabel = false,
  tool,
  item,
  className,
  ...rest
}: PaletteButtonProps) {
  const shortcut = command === undefined ? undefined : shortcutOf(command);
  return (
    <Tooltip label={tooltip ?? label} shortcut={shortcut} side="top">
      <button
        type="button"
        aria-label={label}
        aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
        className={[iconButtonStyles.button, showLabel ? styles.labelled : '', className]
          .filter(Boolean)
          .join(' ')}
        data-size="bar"
        data-tool={tool}
        data-item={item}
        data-capsule-item={item === 'done' ? 'markup' : item}
        data-labelled={showLabel ? '' : undefined}
        {...rest}
      >
        {icon}
        {showLabel ? <span data-label="">{label}</span> : null}
      </button>
    </Tooltip>
  );
}
