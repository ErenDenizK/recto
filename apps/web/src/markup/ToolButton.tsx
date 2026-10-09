/**
 * The palette's tool button (`03-markup` MK-4): the one control for Select, Eraser, Lasso, Text
 * box, Note, Image, Edit text and Redact, and the shape of Done, Sign and the choice tools.
 *
 * - A `ui/IconButton` of the bar size, the M control (32 fine, 44 coarse; system-audit-2026-10
 *   §3.3) with a 20 px Phosphor glyph; with `showLabel` the circle stretches to a pill with the
 *   name beside the glyph (Edit text, Redact, Sign, Done), the same states. A labelled choice
 *   (Sign ▾) adds a 16 px caret after its name (`caret`, §3.7).
 * - Armed (`aria-pressed` with `data-tool`): the one armed form of §3.5, the
 *   `--tool-active-fill` disc from `ui/IconButton.module.css`, the glyph in its outline weight
 *   (callers pass `filled={false}`: 10-ink §2.4); exactly one tool is pressed across the
 *   palette and the pen well.
 * - Tooltip: the name and key, then "· Esc: Select" when armed, and "Press again for choices"
 *   on a tool whose second press opens choices (`markup_choices_hint`).
 */
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
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
  /** A labelled choice: the caret after the name (§3.7). */
  readonly caret?: boolean | undefined;
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
  caret = false,
  tool,
  item,
  className,
  ...rest
}: PaletteButtonProps) {
  const labelled = showLabel ? (
    <>
      {icon}
      <span data-label="">{label}</span>
      {caret ? <Icon name="caret-down" className={styles.caret} /> : null}
    </>
  ) : (
    icon
  );
  return (
    <IconButton
      label={label}
      tooltip={tooltip}
      icon={labelled}
      shortcut={command === undefined ? undefined : shortcutOf(command)}
      tooltipSide="top"
      size="bar"
      className={
        [showLabel ? styles.labelled : '', className].filter(Boolean).join(' ') || undefined
      }
      data-tool={tool}
      data-item={item}
      data-capsule-item={item === 'done' ? 'markup' : item}
      data-labelled={showLabel ? '' : undefined}
      data-caret={showLabel && caret ? '' : undefined}
      {...rest}
    />
  );
}
