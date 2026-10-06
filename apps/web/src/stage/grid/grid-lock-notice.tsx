/**
 * The Lock notice at a grid cell (`components/06-navigation.md` §2.3 Locked, PG4 §4;
 * `04-context` §19): a refused lift says why where the finger or the pointer is, for three
 * seconds, as the sidebar's thumbnails do: `lock-simple` and the reason. A status message
 * (`role="status"`), so the reason is read too. Content-coloured, not glass: it sits on the
 * canvas beside solid cells (Q-4).
 */
import { useEffect } from 'react';
import { create } from 'zustand';

import { Icon } from '../../ui/Icon';
import styles from './GridHeader.module.css';

/** How long the notice stays (ms). */
export const GRID_LOCK_NOTICE_MS = 3000;

interface Notice {
  readonly text: string;
  /** Centre x and top y in the grid frame's coordinates. */
  readonly x: number;
  readonly y: number;
  readonly serial: number;
}

const useNotice = create<{ notice: Notice | null }>()(() => ({ notice: null }));

/** Shows `text` over `cell` until it times out or another notice replaces it. */
export function showGridLockNotice(cell: HTMLElement, text: string): void {
  const frame = cell.closest<HTMLElement>('[data-pages-grid]');
  if (!frame) return;
  const box = frame.getBoundingClientRect();
  const at = cell.getBoundingClientRect();
  useNotice.setState((s) => ({
    notice: {
      text,
      x: Math.round(at.left - box.left + at.width / 2),
      y: Math.round(at.top - box.top + 12),
      serial: (s.notice?.serial ?? 0) + 1,
    },
  }));
}

/** The notice, rendered in the grid's frame. */
export function GridLockNotice() {
  const notice = useNotice((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      if (useNotice.getState().notice?.serial === notice.serial) {
        useNotice.setState({ notice: null });
      }
    }, GRID_LOCK_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div
      role="status"
      className={styles.lockNotice}
      style={{ left: notice.x, top: notice.y }}
      data-testid="grid-lock-notice"
    >
      <Icon name="lock-simple" className={styles.lockIcon} />
      <span>{notice.text}</span>
    </div>
  );
}
