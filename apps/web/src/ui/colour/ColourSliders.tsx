/**
 * The Sliders view (`10-ink.md` §4.1, §4.3): Hue, Saturation and Brightness as gradient-track
 * Sliders whose gradients follow the colour live, then a hex field.
 *
 * - **HSB state.** A grey has no hue and black no saturation, so the view keeps the hue and
 *   saturation it last had while the colour passes through them; the sliders do not jump.
 * - **Hex field.** `#1A1A1A`: 3 or 6 digits, with or without `#`, any case (`parseHex`).
 *   Enter or leaving the field applies a valid entry; an invalid one says so and, on leaving,
 *   the field goes back to the colour. Esc in a changed field restores it (and stays); Esc in
 *   an unchanged field reaches the panel (revert and close).
 * - **Tracks.** Hue is always the full rainbow (full saturation and brightness), as Apple
 *   draws it, so the scale reads even at black; Saturation and Brightness run from the
 *   colour's own ends.
 * - **Layout.** The three sliders are rows of the panel's columns (`ColourPanel.module.css`),
 *   so their tracks start where Opacity's does; the hex row spans them, its field ending
 *   under the readouts. An invalid entry's message takes the label's place, so the view's
 *   height never changes.
 * - Each slider says its value with its unit ("210 degrees", "60 percent").
 */
import { type KeyboardEvent, useId, useState } from 'react';

import { formatNumber, formatPercent, m } from '../../i18n';
import { Slider } from '../Slider';
import { type Hsb, hexToRgb, hsbToHex, hueRamp, parseHex, rgbToHsb } from './colour-math';
import styles from './ColourSliders.module.css';

export interface ColourSlidersProps {
  /** `#RRGGBB`. */
  readonly value: string;
  readonly onChange: (hex: string) => void;
}

interface Own extends Hsb {
  readonly hex: string;
}

function degrees(value: number): string {
  return m.slider_readout_degrees({ value: formatNumber(value) });
}

function percent(value: number): string {
  return formatPercent(value / 100);
}

export function ColourSliders({ value, onChange }: ColourSlidersProps) {
  const hex = value.toUpperCase();
  const [own, setOwn] = useState<Own | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();

  // HSB from the value, keeping the hue (and saturation) a grey (or black) cannot carry.
  let hsb: Hsb;
  if (own?.hex === hex) {
    hsb = own;
  } else {
    const derived = rgbToHsb(hexToRgb(hex));
    hsb = {
      h: derived.s === 0 && own ? own.h : derived.h,
      s: derived.b === 0 && own ? own.s : derived.s,
      b: derived.b,
    };
  }
  const h = Math.round(hsb.h);
  const s = Math.round(hsb.s * 100);
  const b = Math.round(hsb.b * 100);

  const apply = (next: Hsb) => {
    const colour = hsbToHex(next);
    setOwn({ ...next, hex: colour });
    if (colour !== hex) onChange(colour);
  };

  const commitDraft = (text: string): boolean => {
    const parsed = parseHex(text);
    if (!parsed) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    setDraft(null);
    if (parsed !== hex) onChange(parsed);
    return true;
  };

  const onHexKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (draft !== null) commitDraft(draft);
    } else if (event.key === 'Escape' && draft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setInvalid(false);
    }
  };

  const rows = [
    {
      label: m.colour_hue(),
      value: h,
      max: 360,
      gradient: `linear-gradient(to right, ${hueRamp(1, 1)})`,
      format: degrees,
      spoken: (v: number) => m.slider_value_degrees({ value: formatNumber(v) }),
      change: (v: number) => apply({ ...hsb, h: v }),
    },
    {
      label: m.colour_saturation(),
      value: s,
      max: 100,
      gradient: `linear-gradient(to right, ${hsbToHex({ ...hsb, s: 0 })}, ${hsbToHex({ ...hsb, s: 1 })})`,
      format: percent,
      spoken: (v: number) => m.slider_value_percent({ value: formatNumber(v) }),
      change: (v: number) => apply({ ...hsb, s: v / 100 }),
    },
    {
      label: m.colour_brightness(),
      value: b,
      max: 100,
      gradient: `linear-gradient(to right, #000000, ${hsbToHex({ ...hsb, b: 1 })})`,
      format: percent,
      spoken: (v: number) => m.slider_value_percent({ value: formatNumber(v) }),
      change: (v: number) => apply({ ...hsb, b: v / 100 }),
    },
  ];

  return (
    <div className={styles.view}>
      {rows.map((row) => (
        <Slider
          key={row.label}
          className={styles.slider}
          label={row.label}
          showLabel
          readout
          min={0}
          max={row.max}
          step={1}
          value={row.value}
          track="gradient"
          gradient={row.gradient}
          knobColor={hex}
          bubble="never"
          format={row.format}
          valueText={row.spoken}
          onValueChange={row.change}
        />
      ))}
      <div className={styles.hexRow}>
        {invalid ? (
          <span id={errorId} className={styles.error} role="status">
            {m.colour_hex_invalid()}
          </span>
        ) : (
          <label className={styles.hexLabel} htmlFor={`${errorId}-hex`}>
            {m.colour_hex()}
          </label>
        )}
        <input
          id={`${errorId}-hex`}
          className={styles.hex}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          maxLength={7}
          aria-label={m.colour_hex()}
          value={draft ?? hex}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setInvalid(false);
          }}
          onKeyDown={onHexKeyDown}
          onBlur={() => {
            if (draft !== null && !commitDraft(draft)) {
              setDraft(null);
              setInvalid(false);
            }
          }}
        />
      </div>
    </div>
  );
}
