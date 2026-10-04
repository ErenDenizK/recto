/**
 * Scroll area (09-primitives §21): every scroller in the chrome (sidebar lists, long menus,
 * sheets, the shortcut overlay, Recents), never the stage. On Base UI's `ScrollArea`: native
 * scrolling in the viewport, an overlay scrollbar drawn by us.
 *
 * - **Scrollbar.** 6 px on fine pointers, 10 while hovered, inset 2, a capsule thumb in
 *   `--scroll-thumb`; no track fill. On coarse pointers it shows only while scrolling. It
 *   fades in and out over 120 ms.
 * - **Soft edges.** Where content continues past an edge, a 12 px `mask-image` fade
 *   (G-19), from Base UI's `data-overflow-y-start` / `-end` on the root.
 * - **Behaviour.** `overscroll-behavior: contain` (M-23), so a list at its end does not scroll
 *   the page behind it. `scroll-padding` comes from the free rectangle the frame publishes
 *   (`--free-top`, `--free-end`, `--free-bottom`, `--free-start`, 0 until it does), so focus
 *   moved by keys is never hidden under chrome (A-12). The viewport is focusable only when
 *   it has no focusable child (Base UI's default).
 * - `viewportRef` reaches the scrolling element (a virtualised list measures it).
 *
 * The global `* { scrollbar-width: thin }` rule stays as the fallback for scrollers that are
 * not yet scroll areas.
 */
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import type { CSSProperties, ReactNode, Ref } from 'react';

import styles from './ScrollArea.module.css';

export interface ScrollAreaProps {
  readonly children: ReactNode;
  /** On the root: give it its size (a height or a flex share). */
  readonly className?: string | undefined;
  readonly viewportClassName?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly viewportRef?: Ref<HTMLDivElement> | undefined;
  /** Horizontal scrolling too (default vertical only). */
  readonly horizontal?: boolean | undefined;
  /** The region's accessible name, when the viewport itself takes focus. */
  readonly label?: string | undefined;
  readonly 'data-testid'?: string | undefined;
}

export function ScrollArea({
  children,
  className,
  viewportClassName,
  style,
  viewportRef,
  horizontal = false,
  label,
  'data-testid': testId,
}: ScrollAreaProps) {
  return (
    <BaseScrollArea.Root
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-testid={testId}
      {...(style === undefined ? {} : { style })}
    >
      <BaseScrollArea.Viewport
        ref={viewportRef}
        className={[styles.viewport, viewportClassName].filter(Boolean).join(' ')}
        {...(label === undefined ? {} : { 'aria-label': label })}
      >
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className={styles.scrollbar} orientation="vertical">
        <BaseScrollArea.Thumb className={styles.thumb} />
      </BaseScrollArea.Scrollbar>
      {horizontal ? (
        <BaseScrollArea.Scrollbar className={styles.scrollbar} orientation="horizontal">
          <BaseScrollArea.Thumb className={styles.thumb} />
        </BaseScrollArea.Scrollbar>
      ) : null}
    </BaseScrollArea.Root>
  );
}
