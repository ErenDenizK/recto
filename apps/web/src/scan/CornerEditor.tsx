/**
 * Corner adjust (plan bm-scan-plan §3 "Review strip", "adjust the four corners"): the page's
 * source picture with its outline and four draggable handles. Each handle is a button with a
 * 44 px target (`--hit-min`), moved by a drag or by the arrow keys (1 %, Shift 5 %), and named for
 * its corner. Corners are kept in source pixels; the box is the picture's own aspect, so a pointer
 * position maps straight to them. Limit: no loupe yet (plan §3), and a corner may cross another;
 * the warp then folds, which the preview shows before Done.
 */
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { m } from '../i18n';
import type { Quad } from './encode';
import { cornerPositions } from './scan-store';
import styles from './CornerEditor.module.css';

const LABELS = [
  () => m.scan_corner_tl(),
  () => m.scan_corner_tr(),
  () => m.scan_corner_br(),
  () => m.scan_corner_bl(),
] as const;

export interface CornerEditorProps {
  /** Object URL of the page's source picture (`ScanPage.sourceUrl`). */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly quad: Quad;
  readonly onChange: (quad: Quad) => void;
}

export function CornerEditor({ src, width, height, quad, onChange }: CornerEditorProps) {
  const box = useRef<HTMLDivElement>(null);
  const positions = cornerPositions(quad);
  const move = (index: number, x: number, y: number) => {
    const next = quad.map((p, i) =>
      i === index ? { x: Math.min(width, Math.max(0, x)), y: Math.min(height, Math.max(0, y)) } : p,
    ) as unknown as Quad;
    onChange(next);
  };

  const drag = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    move(
      index,
      ((event.clientX - rect.left) / rect.width) * width,
      ((event.clientY - rect.top) / rect.height) * height,
    );
  };

  const key = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const step = (event.shiftKey ? 0.05 : 0.01) * Math.max(width, height);
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    const p = quad[index];
    if (p) move(index, p.x + dx, p.y + dy);
  };

  return (
    <div className={styles.frame} data-testid="scan-corners">
      <div ref={box} className={styles.box} style={{ '--ar': width / height } as CSSProperties}>
        {src && <img className={styles.image} src={src} alt="" draggable={false} />}
        <svg className={styles.outline} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <polygon points={quad.map((p) => `${p.x},${p.y}`).join(' ')} />
        </svg>
        {quad.map((p, index) => (
          <button
            key={index}
            type="button"
            // A corner handle is direct manipulation on the picture, not an action capsule.
            // eslint-disable-next-line recto/q9-controls
            className={styles.handle}
            style={{ left: `${(p.x / width) * 100}%`, top: `${(p.y / height) * 100}%` }}
            aria-label={LABELS[positions[index] ?? index]?.()}
            data-corner={index}
            onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
            onPointerMove={(e) => drag(index, e)}
            onKeyDown={(e) => key(index, e)}
          >
            <span className={styles.dot} />
          </button>
        ))}
      </div>
    </div>
  );
}
