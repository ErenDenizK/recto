/**
 * Icon (ADR-0027 §2.6–§2.7; components/09-primitives.md §30; language.md §5.1): one Phosphor
 * glyph from `icons.generated.tsx`, drawn as filled paths on Phosphor's 256 grid in
 * `currentColor`, so it takes its control's colour and the regular weight's line is 1/16 of
 * the box (I-3).
 *
 * - **Size from context** (quality-bar Q-9): 20 px in controls, 16 px in menus and rows. The
 *   controls size their glyphs in their own CSS (`.button svg { width: var(--icon-md) }`), which
 *   wins over the 16 px default here; `size` sets the box where no control does, and a
 *   control's rule still wins over it, so one bar never mixes sizes.
 * - **Outline at rest, fill when selected** (I-2): a glyph with a fill twin (the tools, tabs,
 *   segments and toggles; `fill` in the manifest) swaps to it when its control is pressed,
 *   checked, selected or current (`aria-pressed`, `aria-checked`, `aria-selected`,
 *   `aria-current`), with the *select* motion (I-8, language.md §7.3: a 120 ms cross-fade and
 *   the pop). `filled` forces either weight. Action glyphs (close, plus, check, carets, arrows,
 *   more) have no twin and never swap.
 * - **Decorative by default**: `aria-hidden` unless `label` names it; the control carries the
 *   accessible name (09 §4: IconButton's label is mandatory).
 */
import type { ComponentPropsWithoutRef, CSSProperties } from 'react';

import styles from './Icon.module.css';
import { ICONS, type IconName } from './icons.generated';

export type { IconName } from './icons.generated';

/** The icon boxes of language.md §5.1: rows and menus, bars, coarse-pointer bars. */
export type IconSize = 16 | 20 | 24;

interface IconProps extends Omit<ComponentPropsWithoutRef<'svg'>, 'children' | 'name'> {
  readonly name: IconName;
  /** The box in px where no control sizes it (default 16). */
  readonly size?: IconSize | undefined;
  /** `true` always the fill twin, `false` never; left out, the control's state decides. */
  readonly filled?: boolean | undefined;
  /** An accessible name, for the rare glyph that stands alone; otherwise it is hidden. */
  readonly label?: string | undefined;
}

const paths = (data: readonly string[]) => data.map((d) => <path key={d} d={d} />);

export function Icon({ name, size, filled, label, className, style, ...rest }: IconProps) {
  const { r, f } = ICONS[name];
  const box =
    size === undefined ? style : ({ ...style, '--icon-box': `${size}px` } as CSSProperties);
  return (
    <svg
      viewBox="0 0 256 256"
      fill="currentColor"
      focusable="false"
      className={className ? `${styles.icon} ${className}` : styles.icon}
      style={box}
      data-icon={name}
      data-filled={f ? (filled === undefined ? 'auto' : String(filled)) : undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...rest}
    >
      {f ? (
        <>
          <g className={styles.regular}>{paths(r)}</g>
          <g className={styles.fill}>{paths(f)}</g>
        </>
      ) : (
        paths(r)
      )}
    </svg>
  );
}
