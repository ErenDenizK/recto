/**
 * The aura (owner feedback 2026-10-08, "missing aura"; 2026-10-09, G3 and G5; the CSS form of
 * `02-library` L3's field): five soft lobes in the mark's mint, lime and yellow lime, fixed to
 * the window behind the app's content, which give the glass above them something to refract.
 *
 * Slowly alive on the Library (G3): each lobe drifts on its own 37–59 s loop by transform and
 * opacity alone, so the compositor moves layers painted once and nothing lays out or repaints
 * (Q-1, A-23). The drift pauses while the document is hidden (`data-paused`, from `visibilitychange`) and on the
 * cost ladder's steps 2 and 3; it never starts under reduced motion (the system's or the
 * setting's), where the aura is still. Decorative: `aria-hidden` and pointer-transparent.
 *
 * Two tones: `library`, behind the Library's column, and `reader`, the same light dimmer and
 * still behind the reader's canvas when Settings › Background glow is on (G5): a document view
 * keeps Q-10's zero frames at rest, so only the Library drifts. The shell lays it once, behind
 * the stage and fixed to the window (owner feedback 2026-10-10, R15), so a sheet, the sidebar or
 * a scroll lock that moves the free rectangle never cuts it or bares the canvas at an edge.
 */
import { useSyncExternalStore } from 'react';

import styles from './Aura.module.css';

const LOBES = ['mint', 'lime', 'yellow', 'glint', 'low'] as const;

function subscribeVisibility(listener: () => void): () => void {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
}

const documentHidden = () => document.visibilityState === 'hidden';

/** Whether the document is hidden (a background tab, a minimised window). */
function useDocumentHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, documentHidden, () => false);
}

export function Aura({
  tone,
  testId,
}: {
  readonly tone: 'library' | 'reader';
  readonly testId?: string;
}) {
  const hidden = useDocumentHidden();
  return (
    <div
      className={styles.aura}
      aria-hidden="true"
      data-tone={tone}
      data-paused={hidden || undefined}
      data-testid={testId}
    >
      {LOBES.map((lobe) => (
        <span key={lobe} className={styles.lobe} data-lobe={lobe} />
      ))}
    </div>
  );
}
