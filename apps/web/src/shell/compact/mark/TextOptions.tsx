/**
 * The drawer's second row for Text (`design/phone-2026-10/README.md` §3 row 2: "size S/M/L and
 * colour"): three colour swatches, a hairline, and three sizes, as the ink options' row
 * (`InkOptions.tsx`), presets and never a picker (`text-presets.ts`). They set the style new
 * boxes take (`setStyle('text', …)`, kept on the device as on the desktop). Each size is an "A"
 * inside the swatch's selection ring, so the row reads as one family with the ink's.
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { m } from '../../../i18n';
import { Swatch } from '../../../ui/Swatch';
import swatchStyles from '../../../ui/Swatch.module.css';
import { SwatchGroup } from '../../../ui/SwatchGroup';
import { nearestSize } from './ink-presets';
import inkStyles from './InkOptions.module.css';
import { TEXT_COLOURS, TEXT_SIZES } from './text-presets';
import styles from './TextOptions.module.css';

const SIZE_NAMES = [
  m.compact_text_size_small,
  m.compact_text_size_medium,
  m.compact_text_size_large,
] as const;

export function TextOptions() {
  const style = useAnnotationStore((s) => s.styles.text);
  const chosen = nearestSize(style.fontSize, TEXT_SIZES);
  return (
    <div className={inkStyles.row} data-testid="compact-text-options">
      <SwatchGroup
        label={m.compact_text_colour()}
        value={style.color.toUpperCase()}
        className={inkStyles.swatches}
        onValueChange={(color) => useAnnotationStore.getState().setStyle('text', { color })}
      >
        {TEXT_COLOURS.map((colour) => (
          <Swatch key={colour} value={colour} tooltip={false} />
        ))}
      </SwatchGroup>
      <span className={inkStyles.rule} aria-hidden="true" />
      <RadioGroup
        aria-label={m.compact_text_size()}
        value={String(chosen)}
        onValueChange={(value) => {
          const fontSize = TEXT_SIZES[Number(value)];
          if (fontSize !== undefined) useAnnotationStore.getState().setStyle('text', { fontSize });
        }}
        className={`${swatchStyles.group} ${inkStyles.sizes}`}
      >
        {TEXT_SIZES.map((size, i) => (
          <Radio.Root
            key={size}
            value={String(i)}
            aria-label={SIZE_NAMES[i]?.() ?? ''}
            className={swatchStyles.swatch}
          >
            <span className={swatchStyles.ring} aria-hidden="true" />
            <span className={styles.letter} data-size={i} aria-hidden="true">
              A
            </span>
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  );
}
