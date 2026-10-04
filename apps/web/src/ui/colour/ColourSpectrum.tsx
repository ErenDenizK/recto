/**
 * The Spectrum view (`10-ink.md` §4.1, §4.3): a plane of hue across and lightness down at
 * full saturation (Apple's spectrum), with a 28 px round loupe showing the colour under it.
 *
 * - **Drawing.** Three stacked CSS gradients: no canvas, no image (Q-12). A hue ramp, white
 *   fading to clear over the top half and clear to black over the bottom half, all in sRGB,
 *   which is HSL at full saturation; `spectrumColour` computes the same colour for a point,
 *   so the loupe shows exactly what is drawn under it.
 * - **Pointer.** Press and drag anywhere on the plane (pointer capture); the colour follows
 *   live.
 * - **Keyboard.** The loupe is one Tab stop holding two named sliders, "Hue" and
 *   "Lightness": Left and Right move the hue one degree, Up and Down the lightness one
 *   percent, Shift ten; PageUp and PageDown move the lightness ten, Home and End the hue to
 *   its ends. Focus moves to the slider of the axis that changed, so its value is spoken.
 * - **State.** A grey has no hue, so the point keeps its last hue while the colour stays
 *   grey; a colour picked here maps back to the same point.
 */
import { type CSSProperties, type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

import { formatNumber, m } from '../../i18n';
import { colourName, spectrumColour, spectrumPoint } from './colour-math';
import styles from './ColourSpectrum.module.css';

export interface ColourSpectrumProps {
  /** `#RRGGBB`. */
  readonly value: string;
  readonly onChange: (hex: string) => void;
}

interface Point {
  /** Hue, 0–1 across. */
  readonly x: number;
  /** 1 − lightness, 0–1 down. */
  readonly y: number;
  /** The colour this point produced, to know when `value` still matches it. */
  readonly hex: string;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function ColourSpectrum({ value, onChange }: ColourSpectrumProps) {
  const planeRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLInputElement>(null);
  const lightRef = useRef<HTMLInputElement>(null);
  const [own, setOwn] = useState<Point | null>(null);
  const [axis, setAxis] = useState<'hue' | 'lightness'>('hue');
  const hex = value.toUpperCase();
  // The point is ours while the value is the colour we produced; else it follows the value.
  const point: Point = own?.hex === hex ? own : { ...spectrumPoint(hex, own?.x ?? 0), hex };

  const set = (x: number, y: number) => {
    const next = { x: clamp01(x), y: clamp01(y) };
    const colour = spectrumColour(next.x, next.y);
    setOwn({ ...next, hex: colour });
    if (colour !== hex) onChange(colour);
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const plane = planeRef.current;
    if (!plane) return;
    const r = plane.getBoundingClientRect();
    set((event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height);
  };

  const hue = Math.round(point.x * 360);
  const lightness = Math.round((1 - point.y) * 100);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 10 : 1;
    let h = hue;
    let l = lightness;
    let changed: 'hue' | 'lightness';
    switch (event.key) {
      case 'ArrowLeft':
        h -= step;
        changed = 'hue';
        break;
      case 'ArrowRight':
        h += step;
        changed = 'hue';
        break;
      case 'ArrowUp':
        l += step;
        changed = 'lightness';
        break;
      case 'ArrowDown':
        l -= step;
        changed = 'lightness';
        break;
      case 'PageUp':
        l += 10;
        changed = 'lightness';
        break;
      case 'PageDown':
        l -= 10;
        changed = 'lightness';
        break;
      case 'Home':
        h = 0;
        changed = 'hue';
        break;
      case 'End':
        h = 360;
        changed = 'hue';
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    h = Math.min(360, Math.max(0, h));
    l = Math.min(100, Math.max(0, l));
    set(h / 360, 1 - l / 100);
    if (changed !== axis) {
      setAxis(changed);
      (changed === 'hue' ? hueRef : lightRef).current?.focus();
    }
  };

  const name = colourName(point.hex);
  const loupeStyle = {
    '--x': point.x,
    '--y': point.y,
    '--loupe-colour': point.hex,
  } as CSSProperties;

  return (
    // The plane is a pointer surface; its keyboard path is the loupe's two sliders.
    <div
      ref={planeRef}
      className={styles.plane}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        fromPointer(event);
        (axis === 'hue' ? hueRef : lightRef).current?.focus({ preventScroll: true });
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) fromPointer(event);
      }}
    >
      <div
        className={styles.loupe}
        style={loupeStyle}
        role="group"
        aria-label={m.colour_spectrum()}
      >
        <input
          ref={hueRef}
          type="range"
          className="visually-hidden"
          min={0}
          max={360}
          step={1}
          value={hue}
          aria-label={m.colour_hue()}
          aria-valuetext={`${m.slider_value_degrees({ value: formatNumber(hue) })}, ${name}`}
          tabIndex={axis === 'hue' ? 0 : -1}
          onKeyDown={onKeyDown}
          onChange={(event) => set(Number(event.currentTarget.value) / 360, point.y)}
          onFocus={() => setAxis('hue')}
        />
        <input
          ref={lightRef}
          type="range"
          className="visually-hidden"
          min={0}
          max={100}
          step={1}
          value={lightness}
          aria-label={m.colour_lightness()}
          aria-valuetext={`${m.slider_value_percent({ value: formatNumber(lightness) })}, ${name}`}
          tabIndex={axis === 'lightness' ? 0 : -1}
          onKeyDown={onKeyDown}
          onChange={(event) => set(point.x, 1 - Number(event.currentTarget.value) / 100)}
          onFocus={() => setAxis('lightness')}
        />
      </div>
    </div>
  );
}
