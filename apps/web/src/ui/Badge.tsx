/**
 * Badge (components/09-primitives.md §17): a count or a short status beside a label (Review
 * counts, Find hits, saved signatures, the unsaved dot, a signature's status).
 *
 * - `count`: a pill 16 px high (20 coarse), at least as wide as it is high, padding 5, an 11/14
 *   caption at 600 in tabular numerals on `--badge-fill`. Caps at "99+"; zero hides it. An
 *   increase pops it once on the pop spring; reduced motion only swaps the number.
 * - `dot`: 6 px (8 coarse) in the primary colour.
 * - `status`: a 12 px glyph (16 coarse) in the status colour and the caller's words, no fill
 *   (colour is never the only cue, A-19).
 * - `label`: a short word on the count's fill, a pill 20 px high (24 coarse), caption at 600 in
 *   the primary colour: a fact about a file beside its explanation (Document info's "has form",
 *   "tagged"). Neutral, never the warning colour: the explanation says what changes.
 *
 * Decorative: `aria-hidden`, never focusable. The count is part of the host's accessible name
 * ("Review, 3 items"), which the host writes.
 */
import { type ReactNode, useState } from 'react';

import styles from './Badge.module.css';

/** Counts above this show as "99+" (09 §17.5). */
export const BADGE_MAX = 99;

/** "7", "99", "99+"; null when the badge hides (zero or less). */
export function badgeText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count > BADGE_MAX ? `${BADGE_MAX}+` : String(Math.floor(count));
}

export type BadgeProps =
  | { readonly kind?: 'count'; readonly count: number; readonly className?: string | undefined }
  | { readonly kind: 'dot'; readonly className?: string | undefined }
  | {
      readonly kind: 'label';
      readonly children: ReactNode;
      readonly className?: string | undefined;
    }
  | {
      readonly kind: 'status';
      readonly tone: 'success' | 'warning' | 'danger';
      readonly icon: ReactNode;
      readonly children: ReactNode;
      readonly className?: string | undefined;
    };

export function Badge(props: BadgeProps) {
  // Only an increase pops (09 §17.7): a new key replays the entrance once. Derived from the
  // previous count during render, so no effect runs and nothing flashes.
  const count =
    props.kind === 'dot' || props.kind === 'status' || props.kind === 'label' ? 0 : props.count;
  const [seen, setSeen] = useState(count);
  const [pops, setPops] = useState(0);
  if (count !== seen) {
    if (count > seen) setPops(pops + 1);
    setSeen(count);
  }
  const className = [styles.badge, props.className].filter(Boolean).join(' ');

  if (props.kind === 'dot') {
    return <span className={className} data-kind="dot" aria-hidden="true" />;
  }
  if (props.kind === 'label') {
    return (
      <span className={className} data-kind="label" aria-hidden="true">
        {props.children}
      </span>
    );
  }
  if (props.kind === 'status') {
    return (
      <span className={className} data-kind="status" data-tone={props.tone} aria-hidden="true">
        {props.icon}
        <span>{props.children}</span>
      </span>
    );
  }
  const text = badgeText(count);
  if (text === null) return null;
  return (
    <span
      key={pops}
      className={className}
      data-kind="count"
      data-pop={pops > 0 ? '' : undefined}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}
