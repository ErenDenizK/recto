/**
 * The page eyedropper (`10-ink.md` §4.1, §4.3): a 96 px loupe showing 11 × 11 page pixels at
 * 8× with the centre pixel ringed, over a transparent layer that covers the viewport.
 *
 * - **Source.** `sample(x, y)` returns the page pixels under a client point
 *   (`viewer/page-pixels.ts` reads the rendered page bitmap); the loupe never blurs or
 *   copies the screen (Q-5).
 * - **Pointer.** With a mouse or pen the loupe sits on the pointer. With a finger it sits
 *   above the finger (`TOUCH_OFFSET`) and samples there, so the finger never hides it. A press
 *   picks on release; a press off every page cancels. Esc cancels.
 * - **Keyboard.** The layer takes focus: arrows move the loupe one pixel (Shift ten), Enter
 *   or Space picks, Esc cancels. The colour under the loupe is announced by name and hex
 *   once the loupe rests (the instructions are the layer's description).
 * - It moves by transform at whole pixels, so it rests sharp (Q-2).
 */
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { m } from '../../i18n';
import type { PixelBlock, PixelSampler } from '../../viewer/page-pixels';
import { pixelHex } from '../../viewer/page-pixels';
import { colourName } from './colour-math';
import styles from './Eyedropper.module.css';

/** Page pixels across the loupe, and the zoom of each. */
export const LOUPE_PIXELS = 11;
export const LOUPE_ZOOM = 8;
/** How far above a finger the loupe samples, CSS px. */
export const TOUCH_OFFSET = 64;
/** Quiet time before the colour under a resting loupe is announced (ms). */
const ANNOUNCE_MS = 350;

export interface EyedropperProps {
  readonly sample: PixelSampler;
  readonly onPick: (hex: string) => void;
  readonly onCancel: () => void;
  /** Where the loupe starts (client px); default: the middle of the viewport. */
  readonly start?: { readonly x: number; readonly y: number } | undefined;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

function drawLoupe(canvas: HTMLCanvasElement, block: PixelBlock | null): void {
  const dpr = window.devicePixelRatio || 1;
  const side = LOUPE_PIXELS * LOUPE_ZOOM;
  const device = Math.round(side * dpr);
  if (canvas.width !== device) {
    canvas.width = device;
    canvas.height = device;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const cell = device / LOUPE_PIXELS;
  for (let row = 0; row < LOUPE_PIXELS; row++) {
    for (let col = 0; col < LOUPE_PIXELS; col++) {
      const x = Math.round(col * cell);
      const y = Math.round(row * cell);
      const w = Math.round((col + 1) * cell) - x;
      const h = Math.round((row + 1) * cell) - y;
      const offset = block ? Math.floor((block.size - LOUPE_PIXELS) / 2) : 0;
      const index = block ? ((row + offset) * block.size + col + offset) * 4 : -1;
      const hex = block ? pixelHex(block.data, index) : null;
      // Off the page: a quiet two-grey check, so "nothing here" reads as itself.
      context.fillStyle = hex ?? ((row + col) % 2 === 0 ? '#d5d7dc' : '#eff0f3');
      context.fillRect(x, y, w, h);
    }
  }
  // A faint pixel grid, one device pixel wide.
  context.fillStyle = 'rgb(0 0 0 / 0.07)';
  for (let i = 1; i < LOUPE_PIXELS; i++) {
    const at = Math.round(i * cell);
    context.fillRect(at, 0, 1, device);
    context.fillRect(0, at, device, 1);
  }
}

export function Eyedropper({ sample, onPick, onCancel, start }: EyedropperProps) {
  const [point, setPoint] = useState<Point>(() => ({
    x: Math.round(start?.x ?? window.innerWidth / 2),
    y: Math.round(start?.y ?? window.innerHeight / 2),
  }));
  const [announcement, setAnnouncement] = useState('');
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLDivElement>(null);
  const picked = useRef<string | null>(null);
  const pressed = useRef(false);
  const hintId = useId();

  useEffect(() => {
    layerRef.current?.focus({ preventScroll: true });
  }, []);

  // Sample and draw where the loupe is; announce once it rests.
  useLayoutEffect(() => {
    const block = sample(point.x, point.y, LOUPE_PIXELS);
    picked.current = block?.centre ?? null;
    const canvas = canvasRef.current;
    if (canvas) drawLoupe(canvas, block);
    loupeRef.current?.style.setProperty('--loupe-colour', block?.centre ?? 'transparent');
    const timer = window.setTimeout(() => {
      const hex = block?.centre;
      setAnnouncement(hex ? `${colourName(hex)}, ${hex}` : m.colour_eyedropper_off_page());
    }, ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [point, sample]);

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const offset = event.pointerType === 'touch' ? TOUCH_OFFSET : 0;
    setPoint({ x: Math.round(event.clientX), y: Math.round(event.clientY - offset) });
  };

  const finish = () => {
    const hex = picked.current;
    if (hex) onPick(hex);
    else onCancel();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setPoint((p) => ({
        x: Math.min(window.innerWidth - 1, Math.max(0, p.x + move.x)),
        y: Math.min(window.innerHeight - 1, Math.max(0, p.y + move.y)),
      }));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      finish();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return createPortal(
    // A 2-D surface for the pointer and the keys alike: an application region by design.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={layerRef}
      className={styles.layer}
      role="application"
      aria-label={m.colour_eyedropper()}
      aria-describedby={hintId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pressed.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={moveTo}
      onPointerUp={(event) => {
        if (!pressed.current) return;
        pressed.current = false;
        moveTo(event);
        // The release point's colour: sample synchronously, the layout effect has not run.
        const offset = event.pointerType === 'touch' ? TOUCH_OFFSET : 0;
        const block = sample(Math.round(event.clientX), Math.round(event.clientY - offset), 1);
        picked.current = block?.centre ?? null;
        finish();
      }}
      onPointerCancel={() => {
        pressed.current = false;
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={loupeRef}
        className={styles.loupe}
        style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className={styles.pixels} />
        <span className={styles.centre} />
      </div>
      <p id={hintId} className="visually-hidden">
        {m.colour_eyedropper_hint()}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </div>,
    document.body,
  );
}
