/**
 * A minimal segmented control (`09-primitives` §6) for two to four mutually exclusive
 * views or values, built first for the colour panel's Grid · Spectrum · Sliders. Radio
 * semantics only (Base UI `RadioGroup`: one Tab stop, the arrows move and choose); the tabs
 * form, the drag of the thumb across segments on touch and the fall-back to a Select when it
 * overflows come with the rest of D0-3.
 *
 * - Track 32 px fine, 44 coarse (Q-9's control heights), inset 2, so the thumb is 28 / 40.
 *   Segments share the width equally.
 * - The thumb is one element behind the labels, moved by transform to the checked segment
 *   (measured, so labels of any length work) on the press spring; reduced motion moves it at
 *   once. It is a neutral fill with a 1 px control border (the fill alone is 1.65:1 against
 *   the track), never lime.
 * - The checked label is 600, the others 500 in the secondary colour (Q-8 weights).
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { useLayoutEffect, useRef } from 'react';

import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean | undefined;
}

export interface SegmentedProps<T extends string> {
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
  /** The group's accessible name. */
  readonly label: string;
  readonly className?: string | undefined;
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);

  // The thumb follows the checked segment's box; measured again when the size changes.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const place = () => {
      const checked = root.querySelector<HTMLElement>('[data-segment][data-checked]');
      if (!checked) {
        root.style.setProperty('--thumb-w', '0px');
        return;
      }
      // Exact boxes, not the rounded offsets: equal segments are often fractional.
      const box = checked.getBoundingClientRect();
      const origin = root.getBoundingClientRect();
      const left = box.left - origin.left - root.clientLeft;
      root.style.setProperty('--thumb-x', `${left}px`);
      root.style.setProperty('--thumb-w', `${box.width}px`);
    };
    place();
    // Transitions only after the first placement, so the thumb never flies in on mount.
    const frame = requestAnimationFrame(() => root.setAttribute('data-ready', ''));
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [value]);

  return (
    <RadioGroup
      ref={rootRef}
      aria-label={label}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      className={[styles.root, className].filter(Boolean).join(' ')}
    >
      <span className={styles.thumb} aria-hidden="true" />
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={styles.segment}
          data-segment=""
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
