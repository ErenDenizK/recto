/**
 * PageTarget (05-canvas §6; system-audit-2026-10 §3.8; quality-bar Q-14): a transparent button
 * laid over a region of the page, a link's hotspot or a line the text editor opens. It is part
 * of the page, not chrome: nothing shows at rest, so the page reads as authored.
 *
 * - Placed by its layer (`style`: left, top, width, height in CSS pixels), radius 2 (pages and
 *   on-page marks), no padding, no border.
 * - Keyboard focus takes the inset two-band ring (`styles/focus.css`), which stays inside the
 *   region and is never clipped by its neighbours. Any mark the layer adds (a hover in the
 *   page's selection blue, an open line's outline) goes in `--shadow-own` or the background, so
 *   the ring's dark band keeps it.
 * - The layer's own states (live, selecting, blocked) come with `className` and data
 *   attributes; the target owns only the box and the focus ring.
 */
import type { ComponentPropsWithRef } from 'react';

import styles from './PageTarget.module.css';

export type PageTargetProps = Omit<ComponentPropsWithRef<'button'>, 'type' | 'children'>;

export function PageTarget({ className, ...rest }: PageTargetProps) {
  return (
    <button
      {...rest}
      type="button"
      className={[styles.target, className].filter(Boolean).join(' ')}
      data-page-target=""
    />
  );
}
