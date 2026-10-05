/**
 * The History scrubber's slider (08-feedback FB7, coarse pointers): one detent per step,
 * oldest at the left; the title names the step under the knob ("Pen on page 4 · 14:02").
 * Dragging previews per detent and the release keeps; Cancel restores the step the scrubber
 * opened at. On the one Slider (`ui/Slider`, `10-ink` §3, quality-bar Q-9).
 *
 * Keys: the arrows, Page Up / Page Down, Home and End preview (the Slider's own keys); Enter
 * keeps; Esc restores (the popover's). A key's commit is not a keep: only a pointer's release
 * is, so stepping with the keys never closes the scrubber under the user.
 */
import { type KeyboardEvent, type Ref, useRef } from 'react';

import { m } from '../i18n';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import styles from './HistoryScrubber.module.css';
import type { ScrubberStep } from './labels';

export interface HistorySliderProps {
  /** Oldest first. */
  readonly steps: readonly ScrubberStep[];
  /** The entry index under the knob. */
  readonly active: number;
  readonly onActiveChange: (index: number) => void;
  readonly onKeep: (index: number) => void;
  readonly onCancel: () => void;
  readonly inputRef?: Ref<HTMLInputElement>;
}

export function HistorySlider({
  steps,
  active,
  onActiveChange,
  onKeep,
  onCancel,
  inputRef,
}: HistorySliderProps) {
  /** A pointer is on the slider: its release (the commit) keeps. */
  const pointer = useRef(false);
  const position = Math.max(
    0,
    steps.findIndex((step) => step.index === active),
  );
  const at = (value: number) => steps[Math.min(steps.length - 1, Math.max(0, Math.round(value)))];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onKeep(active);
  };

  return (
    // Enter on the slider inside keeps; the pointer flag tells a release from a key's commit.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.slider}
      onKeyDown={onKeyDown}
      onPointerDownCapture={() => {
        pointer.current = true;
      }}
    >
      <Slider
        label={m.history_slider_label()}
        value={position}
        min={0}
        max={Math.max(1, steps.length - 1)}
        step={1}
        bubble="never"
        inputRef={inputRef}
        disabled={steps.length < 2}
        valueText={(value) => at(value)?.phrase ?? ''}
        onValueChange={(value) => {
          const step = at(value);
          if (step && step.index !== active) onActiveChange(step.index);
        }}
        onValueCommitted={(value) => {
          if (!pointer.current) return;
          pointer.current = false;
          const step = at(value);
          if (step) onKeep(step.index);
        }}
      />
      <div className={styles.sliderFoot}>
        <span className={styles.count}>
          {m.history_slider_value({ index: position + 1, count: steps.length })}
        </span>
        <Button variant="quiet" onClick={onCancel}>
          {m.history_cancel()}
        </Button>
      </div>
    </div>
  );
}
