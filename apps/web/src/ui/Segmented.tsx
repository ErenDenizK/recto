/**
 * Segmented control (09-primitives §6): two to four mutually exclusive views or values (the
 * colour panel's Grid · Spectrum · Sliders, Compare's Side by side · Overlay, the Settings
 * Theme and Glass rows, Save a copy's Format).
 *
 * - **Semantics.** `radio` (default): Base UI `RadioGroup`, one Tab stop, the arrows move and
 *   choose. `tabs`: Base UI `Tabs`, the arrows move and activate (automatic activation); the
 *   caller renders its panels as children (`SegmentedPanel`), inside the same tabs root.
 * - **Sizes.** Track 32 px fine and 44 coarse (Q-9), inset 2, so the thumb is 28 / 40; labels
 *   13/18 (15/20 coarse). Segments share the width equally while the widest label fits; else
 *   each takes its content's width; and when even that overflows the container (Turkish at
 *   1.8×, a narrow sheet) the control renders as a `Select` with the same options and name.
 *   The choice is measured from a hidden copy of the labels, so it never oscillates.
 * - **Thumb.** One element behind the labels, placed by layout: it sits in the checked
 *   segment's own grid cell, so it is exactly there at any size, under CSS `zoom` and in any
 *   engine, with nothing measured to place it. A change animates it from where it was on the
 *   press spring with a FLIP whose offsets are fractions of its own width (zoom cancels out),
 *   retargeting from where it is if a second change arrives mid-flight; reduced motion moves
 *   it at once. It is a neutral fill with a 1 px control border (the fill alone is 1.65:1
 *   against the track), never lime.
 * - **Touch.** A finger on the checked segment can drag the thumb across the others; the
 *   choice commits on release (a tap still chooses as usual).
 * - **States.** The checked label is 600, the others 500 in the secondary colour (Q-8
 *   weights), hover one step on fine pointers; a disabled segment is dimmed and its `reason`
 *   is its tooltip and description ("All open: open a second document").
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Tabs } from '@base-ui/react/tabs';
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { reducedMotion, springToLinear } from '../motion';
import styles from './Segmented.module.css';
import { Select } from './Select';
import { Tooltip } from './Tooltip';

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A count after the label, in tabular numerals ("All open 3"). */
  readonly count?: number | undefined;
  readonly disabled?: boolean | undefined;
  /** Why the segment is disabled. */
  readonly reason?: string | undefined;
}

export interface SegmentedProps<T extends string> {
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly options: readonly SegmentedOption<T>[];
  /** The group's accessible name. */
  readonly label: string;
  readonly semantics?: 'radio' | 'tabs' | undefined;
  /** Tabs only: the panels (`SegmentedPanel`), rendered after the control. */
  readonly children?: ReactNode;
  readonly className?: string | undefined;
}

/** How the segments are laid out (09 §6.2). */
export type SegmentedLayout = 'equal' | 'content' | 'select';

/**
 * The layout for the widths of the labels (each with its padding) and the room inside the
 * track: equal shares while the widest fits, content widths while their sum fits, else a
 * Select.
 */
export function segmentedLayout(widths: readonly number[], room: number): SegmentedLayout {
  if (widths.length === 0) return 'equal';
  // Half a pixel of slack: sub-pixel label widths must not flip the layout.
  const slack = 0.5;
  if (Math.max(...widths) * widths.length <= room + slack) return 'equal';
  if (widths.reduce((a, b) => a + b, 0) <= room + slack) return 'content';
  return 'select';
}

/** Movement before a touch on the checked segment becomes a drag (CSS px). */
const DRAG_SLOP_PX = 4;

let pressCurve: { easing: string; duration: number } | undefined;

interface Drag {
  readonly id: number;
  readonly x: number;
  dragging: boolean;
  preview: number;
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  semantics = 'radio',
  children,
  className,
}: SegmentedProps<T>) {
  const frameRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const motion = useRef<Animation | null>(null);
  const shown = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const [layout, setLayout] = useState<SegmentedLayout>('equal');
  const checked = options.findIndex((option) => option.value === value);

  /** Puts the thumb in segment `index`'s cell, animating from where it is unless `instant`. */
  const place = (index: number, instant: boolean) => {
    const thumb = thumbRef.current;
    if (!thumb || shown.current === index) return;
    const first = instant || shown.current === null ? null : thumb.getBoundingClientRect();
    motion.current?.cancel();
    motion.current = null;
    shown.current = index;
    thumb.style.gridColumn = index < 0 ? '' : String(index + 1);
    thumb.hidden = index < 0;
    if (!first || first.width === 0 || index < 0 || reducedMotion()) return;
    const last = thumb.getBoundingClientRect();
    if (last.width === 0) return;
    // Fractions of the thumb's own width, so CSS zoom on any ancestor cancels out.
    const dx = ((first.left - last.left) / last.width) * 100;
    const sx = first.width / last.width;
    if (Math.abs(dx) < 0.05 && Math.abs(sx - 1) < 0.001) return;
    pressCurve ??= springToLinear('press');
    const animation = thumb.animate(
      [{ transform: `translateX(${dx}%) scaleX(${sx})` }, { transform: 'none' }],
      { duration: pressCurve.duration, easing: pressCurve.easing },
    );
    animation.onfinish = () => {
      if (motion.current === animation) motion.current = null;
      animation.cancel();
    };
    motion.current = animation;
  };

  // The thumb follows the checked segment; the first placement (and a new layout) is instant.
  useLayoutEffect(() => {
    if (layout === 'select') {
      shown.current = null;
      return;
    }
    place(checked, shown.current === null);
  });

  // Choose the layout from the hidden copy of the labels whenever the room or the labels change.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const measure = measureRef.current;
    if (!frame || !measure) return undefined;
    const decide = () => {
      const widths = Array.from(measure.children, (child) => child.getBoundingClientRect().width);
      const box = frame.getBoundingClientRect();
      const inset =
        Number.parseFloat(getComputedStyle(measure).getPropertyValue('--seg-inset')) || 2;
      // The copy is drawn at the frame's zoom, so the inset is scaled the same way.
      const scale =
        measure.offsetWidth > 0 ? measure.getBoundingClientRect().width / measure.offsetWidth : 1;
      setLayout(segmentedLayout(widths, box.width - 2 * inset * scale));
    };
    decide();
    const observer = new ResizeObserver(decide);
    observer.observe(frame);
    observer.observe(measure);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(
    () => () => {
      motion.current?.cancel();
    },
    [],
  );

  // --- Touch drag of the thumb ----------------------------------------------------------

  const indexAt = (clientX: number): number => {
    const root = rootRef.current;
    if (!root) return -1;
    const segments = Array.from(root.querySelectorAll<HTMLElement>('[data-segment]'));
    return segments.findIndex((segment) => {
      const box = segment.getBoundingClientRect();
      return clientX >= box.left && clientX < box.right;
    });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    const target = (event.target as Element).closest('[data-segment]');
    if (!target?.hasAttribute('data-checked')) return;
    drag.current = { id: event.pointerId, x: event.clientX, dragging: false, preview: checked };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current?.id !== event.pointerId) return;
    if (!current.dragging) {
      if (Math.abs(event.clientX - current.x) < DRAG_SLOP_PX) return;
      current.dragging = true;
      // The finger keeps the drag wherever it goes (a synthetic pointer has nothing to capture).
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Not an active pointer: the moves still reach the root while they stay over it.
      }
    }
    const index = indexAt(event.clientX);
    if (index < 0 || index === current.preview || options[index]?.disabled) return;
    current.preview = index;
    place(index, false);
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (current?.id !== event.pointerId) return;
    drag.current = null;
    if (!current.dragging) return;
    const next = options[current.preview];
    if (event.type === 'pointerup' && next && current.preview !== checked) {
      onValueChange(next.value);
    } else {
      place(checked, false);
    }
  };

  // --- Rendering ------------------------------------------------------------------------

  const segmentContent = (option: SegmentedOption<T>) => (
    <>
      <span className={styles.text}>{option.label}</span>
      {option.count !== undefined ? <span className={styles.count}>{option.count}</span> : null}
    </>
  );

  const withReason = (option: SegmentedOption<T>, element: ReactElement) =>
    option.disabled && option.reason ? (
      <Tooltip key={option.value} label={option.label} reason={option.reason} disabled>
        {element}
      </Tooltip>
    ) : (
      element
    );

  // Every segment has its own column, so the thumb can share the checked one's cell.
  const cell = (i: number): CSSProperties => ({ gridColumn: i + 1 });
  const rootClass = [styles.root, className].filter(Boolean).join(' ');
  const rootProps = {
    ref: rootRef,
    className: rootClass,
    'data-layout': layout,
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
  const thumb = <span ref={thumbRef} className={styles.thumb} aria-hidden="true" />;

  let control: ReactNode;
  if (layout === 'select') {
    control = (
      <Select
        label={label}
        value={value}
        onValueChange={onValueChange}
        options={options.map((option) => ({
          value: option.value,
          label: option.label,
          disabled: option.disabled,
        }))}
        block
      />
    );
  } else if (semantics === 'tabs') {
    control = (
      <Tabs.List {...rootProps} aria-label={label} activateOnFocus>
        {thumb}
        {options.map((option, i) =>
          withReason(
            option,
            <Tabs.Tab
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={styles.segment}
              style={cell(i)}
              data-segment=""
              data-checked={option.value === value ? '' : undefined}
            >
              {segmentContent(option)}
            </Tabs.Tab>,
          ),
        )}
      </Tabs.List>
    );
  } else {
    control = (
      <RadioGroup
        {...rootProps}
        aria-label={label}
        value={value}
        onValueChange={(next) => onValueChange(next)}
      >
        {thumb}
        {options.map((option, i) =>
          withReason(
            option,
            <Radio.Root
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={styles.segment}
              style={cell(i)}
              data-segment=""
            >
              {segmentContent(option)}
            </Radio.Root>,
          ),
        )}
      </RadioGroup>
    );
  }

  const frame = (
    <div ref={frameRef} className={styles.frame}>
      {control}
      {/* The labels at their natural widths, for the layout choice; never seen or read. */}
      <div ref={measureRef} className={styles.measure} aria-hidden="true">
        {options.map((option) => (
          <span key={option.value} className={styles.segment} data-measure="">
            {segmentContent(option)}
          </span>
        ))}
      </div>
    </div>
  );

  if (semantics !== 'tabs') return frame;
  return (
    <Tabs.Root value={value} onValueChange={(next) => onValueChange(next as T)}>
      {frame}
      {children}
    </Tabs.Root>
  );
}

/** A panel of a `semantics="tabs"` segmented control. */
export function SegmentedPanel({
  value,
  className,
  children,
}: {
  readonly value: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <Tabs.Panel value={value} className={className}>
      {children}
    </Tabs.Panel>
  );
}
