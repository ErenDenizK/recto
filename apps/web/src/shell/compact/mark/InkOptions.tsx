/**
 * The drawer's second row for Pen and Highlight (`design/phone-2026-10/README.md` §3 row 2):
 * three colour swatches, a hairline, and three sizes, each a 44 px target, presets and never a
 * picker (`ink-presets.ts`). The swatches are the shared `ui/Swatch` (10-ink §5: the dot, the
 * contrast ring, the selection ring in the primary text colour); the sizes take the same ring
 * around a dot of the armed ink at three diameters, so the row reads as one family. Choosing
 * keeps the drawer open: only a tool closes it.
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { CSSProperties } from 'react';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { type PenPreset, type PresetIndex } from '../../../annotations/pen/presets';
import { m } from '../../../i18n';
import { needsContrastRing } from '../../../ui/colour/colour-math';
import { Swatch } from '../../../ui/Swatch';
import swatchStyles from '../../../ui/Swatch.module.css';
import { SwatchGroup } from '../../../ui/SwatchGroup';
import { useToolStore } from '../../../viewer/tool-store';
import {
  HIGHLIGHTER_SIZES,
  HIGHLIGHTER_TINTS,
  highlighterSlot,
  nearestSize,
  PEN_SIZES,
  writingSlots,
} from './ink-presets';
import styles from './InkOptions.module.css';

/** The sizes' dot diameters, px: fine, medium, bold. */
const SIZE_DOTS = [6, 10, 15] as const;
const SIZE_NAMES = [m.compact_size_fine, m.compact_size_medium, m.compact_size_bold] as const;

/** Pen: the three writing pens' colours, and the armed pen's width. */
export function PenOptions() {
  const pen = useAnnotationStore((s) => s.pen);
  const slots = writingSlots(pen);
  const active = slots.includes(pen.active) ? pen.active : slots[0];
  const preset = active === undefined ? undefined : pen.presets[active];
  if (active === undefined || !preset) return null;
  return (
    <div className={styles.row} data-testid="compact-ink-options">
      <SwatchGroup
        label={m.compact_ink_colour()}
        value={preset.color}
        className={styles.swatches}
        onValueChange={(color) => {
          const index = slots.find((i) => pen.presets[i].color.toUpperCase() === color);
          if (index === undefined) return;
          useAnnotationStore.getState().armPreset(index);
          useToolStore.getState().setLastPen(index);
        }}
      >
        {slots.map((i) => (
          <Swatch key={i} value={pen.presets[i].color} tooltip={false} />
        ))}
      </SwatchGroup>
      <span className={styles.rule} aria-hidden="true" />
      <Sizes index={active} preset={preset} sizes={PEN_SIZES} />
    </div>
  );
}

/** Highlight: three tints and three widths of the Highlighter preset. */
export function HighlightOptions() {
  const pen = useAnnotationStore((s) => s.pen);
  const index = highlighterSlot(pen);
  const preset = index === undefined ? undefined : pen.presets[index];
  if (index === undefined || !preset) return null;
  return (
    <div className={styles.row} data-testid="compact-ink-options">
      <SwatchGroup
        label={m.compact_ink_colour()}
        value={preset.color}
        className={styles.swatches}
        onValueChange={(color) => useAnnotationStore.getState().editPreset(index, { color })}
      >
        {HIGHLIGHTER_TINTS.map((tint) => (
          <Swatch key={tint} value={tint} tooltip={false} />
        ))}
      </SwatchGroup>
      <span className={styles.rule} aria-hidden="true" />
      <Sizes index={index} preset={preset} sizes={HIGHLIGHTER_SIZES} />
    </div>
  );
}

function Sizes({
  index,
  preset,
  sizes,
}: {
  readonly index: PresetIndex;
  readonly preset: PenPreset;
  readonly sizes: readonly number[];
}) {
  const chosen = nearestSize(preset.width, sizes);
  const color = preset.color.toUpperCase();
  return (
    <RadioGroup
      aria-label={m.compact_ink_size()}
      value={String(chosen)}
      onValueChange={(value) => {
        const width = sizes[Number(value)];
        if (width !== undefined) useAnnotationStore.getState().editPreset(index, { width });
      }}
      className={`${swatchStyles.group} ${styles.sizes}`}
    >
      {SIZE_DOTS.map((dot, i) => (
        <Radio.Root
          key={dot}
          value={String(i)}
          aria-label={SIZE_NAMES[i]?.() ?? ''}
          className={swatchStyles.swatch}
          data-ring-dark={needsContrastRing(color, 'dark') ? '' : undefined}
          data-ring-light={needsContrastRing(color, 'light') ? '' : undefined}
          style={
            {
              '--swatch': color,
              '--sw-dot': `${dot}px`,
              '--sw-dot-on': `${dot}px`,
              '--sw-ring-size': '26px',
            } as CSSProperties
          }
        >
          <span className={swatchStyles.ring} aria-hidden="true" />
          <span className={swatchStyles.dot} aria-hidden="true" />
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

/** The chip's badge for the pens: a dot of the armed ink over the glyph's foot. */
export function InkBadge() {
  const color = useAnnotationStore((s) => s.pen.presets[s.pen.active].color);
  return (
    <span
      className={styles.badge}
      style={{ '--swatch': color } as CSSProperties}
      data-ring-dark={needsContrastRing(color, 'dark') ? '' : undefined}
      data-ring-light={needsContrastRing(color, 'light') ? '' : undefined}
      aria-hidden="true"
    />
  );
}
