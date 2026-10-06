/**
 * The one Slider (`10-ink.md` §3; supersedes `09-primitives` §10 and the retired `ui/Range`), on Base
 * UI's `Slider` for its semantics (`role="slider"` on a native range input), pointer capture
 * and track press.
 *
 * - **Scales and rounding** live in `slider-math.ts`. Base UI works on the knob's *position*
 *   (0–`SCALE`), and this wrapper maps it to the value: linear, or logarithmic for widths,
 *   rounded to `step` (or two significant digits on a log scale). The value is controlled.
 * - **Tracks.** `fill` (neutral fill to the knob), `gradient` (the caller's CSS gradient is
 *   the scale, with an optional checkerboard for opacity) and `taper` (the width track: one
 *   SVG path that thickens towards the end, with the knob drawn as the stroke itself).
 * - **Feel** (§3.2). Holding the knob turns it into a lens: a CSS copy of the track inside
 *   it, magnified, never a backdrop filter (Q-5). Detents are magnetic within 4 px (mouse)
 *   or 6 px (touch, pen) and tick the knob as they catch. A drag past an end stretches the
 *   track by up to 6 px and springs back. A press on the track springs the knob to the
 *   point and a drag can continue from there. All of it is CSS driven by two registered
 *   numbers on the root (`--slider-pos`, `--slider-stretch`), so the knob, the fill and the
 *   lens copy move as one. Reduced motion turns off the lens, the stretch, the tick and the
 *   springs; values still snap.
 * - **Value bubble** (§3.1): while held, above the knob, kept inside the viewport.
 *   `bubble="auto"` shows it for touch and pen only (a finger hides the knob; a readout
 *   beside the slider serves the mouse), `"always"` for every pointer, `"never"` not at all.
 *   It is `aria-hidden`; `aria-valuetext` carries the value.
 * - **Commits.** `onValueChange` follows the knob live; `onValueCommitted` fires once per
 *   drag or track press, on release, and once per key press: one history step each (§2.3).
 * - **Keys** (§3.4): arrows one step (the next detent on a slider with detents), Shift and
 *   PageUp/PageDown ten, Home and End the ends. Recto has no right-to-left locale, so the
 *   arrows are not mirrored.
 * - **Density.** `(pointer: coarse)` and `(any-pointer: coarse)` give track 8, knob 28 and a
 *   44 px hit height; otherwise 6, 22 and 32 (09 §2.1, Q-9).
 */
import { Slider as BaseSlider } from '@base-ui/react/slider';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { formatNumber } from '../i18n';
import { reducedMotion } from '../motion/reduced-motion';
import {
  bubbleShift,
  DETENT_SNAP_PX,
  detentsIn,
  keyStep,
  knobDiameter,
  positionToValue,
  roundValue,
  type SliderRange,
  type SliderScale,
  snapToDetent,
  stretchFor,
  taperPath,
  valueToPosition,
} from './slider-math';
import styles from './Slider.module.css';

/** Base UI's position resolution: steps along the travel. */
const SCALE = 1000;
/** How long a track-press spring, a follow and the stretch's release run (ms, the tokens). */
const SPRING_MS = { quick: 420, track: 150, pop: 410 } as const;
/** How long the bubble takes to fade out (ms). */
const BUBBLE_EXIT_MS = 100;

export type SliderTrack = 'fill' | 'gradient' | 'taper';
export type SliderBubble = 'auto' | 'always' | 'never';

export interface SliderProps {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Live, while dragging or on each key. */
  readonly onValueChange?: ((value: number) => void) | undefined;
  /** Once per drag, track press or key press (one history step). */
  readonly onValueCommitted?: ((value: number) => void) | undefined;
  /** Value units. Default: 1 on a linear scale, two significant digits on a log scale. */
  readonly step?: number | undefined;
  readonly scale?: SliderScale | undefined;
  /** Magnetic values (and the key stops): the pen's 0.5 · 1 · 1.5 · 2 · 3 · 5 · 8 · 12 pt. */
  readonly detents?: readonly number[] | undefined;
  readonly track?: SliderTrack | undefined;
  /** The gradient track's CSS image, e.g. `linear-gradient(to right, #000, #f00)`. */
  readonly gradient?: string | undefined;
  /** A checkerboard under the gradient and the knob's colour (opacity sliders). */
  readonly checkerboard?: boolean | undefined;
  /** A colour slider's knob colour (any CSS colour); on a taper track, the ink. */
  readonly knobColor?: string | undefined;
  /** Taper track: the zoom the stroke knob is drawn at (default 1, 100 %). */
  readonly zoom?: number | undefined;
  readonly bubble?: SliderBubble | undefined;
  /** The readout and bubble text ("1.5 pt"). Default: the number in the active locale. */
  readonly format?: ((value: number) => string) | undefined;
  /** The spoken value (`aria-valuetext`, "1.5 points"). Default: `format`. */
  readonly valueText?: ((value: number) => string) | undefined;
  /** Show `format(value)` after the track, in tabular numerals. */
  readonly readout?: boolean | undefined;
  /** The accessible name. */
  readonly label: string;
  /** Show the label before the track. */
  readonly showLabel?: boolean | undefined;
  /** Submits the value with a form. */
  readonly name?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
  readonly inputRef?: Ref<HTMLInputElement> | undefined;
}

// --- Media --------------------------------------------------------------------------------

const COARSE_QUERY = '(pointer: coarse), (any-pointer: coarse)';

function subscribeCoarse(onChange: () => void): () => void {
  const query = window.matchMedia(COARSE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function isCoarse(): boolean {
  return window.matchMedia(COARSE_QUERY).matches;
}

/** Whether the pointer is coarse (touch screen present): the knob clamp and sizes follow. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, isCoarse, () => false);
}

/** The detent haptic (FB13): Android only, when the haptics setting is on. */
function detentHaptic(): void {
  if (document.documentElement.dataset.haptics !== 'on') return;
  navigator.vibrate?.(8);
}

function defaultFormat(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

// --- The component ------------------------------------------------------------------------

interface Interaction {
  readonly pointerType: string;
  readonly startValue: number;
  /** Pointer x minus the knob's centre at the press (0 for a track press). */
  readonly grabOffset: number;
  moved: boolean;
  snapped: number | undefined;
  last: number;
  stretched: boolean;
  committed: boolean;
}

interface Held {
  /** The knob is a lens while held (not on a taper track, not with reduced motion). */
  readonly lens: boolean;
}

export function Slider({
  value,
  min,
  max,
  onValueChange,
  onValueCommitted,
  step,
  scale = 'linear',
  detents,
  track = 'fill',
  gradient,
  checkerboard = false,
  knobColor,
  zoom = 1,
  bubble = 'auto',
  format = defaultFormat,
  valueText,
  readout = false,
  label,
  showLabel = false,
  name,
  disabled = false,
  className,
  style,
  inputRef,
}: SliderProps) {
  const range: SliderRange = { min, max, scale };
  const stops = detentsIn(detents, range);
  const position = valueToPosition(value, range);
  const coarse = useCoarsePointer();
  const labelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const interaction = useRef<Interaction | null>(null);
  // The interaction that just ended: Base UI's commit can arrive after our pointerup.
  const ended = useRef<Interaction | null>(null);
  const timers = useRef<{ jump?: number; release?: number; bubble?: number }>({});
  const [held, setHeld] = useState<Held | null>(null);
  const [bubbleState, setBubbleState] = useState<'hidden' | 'shown' | 'leaving'>('hidden');

  const knob = track === 'taper' ? 'stroke' : knobColor !== undefined ? 'colour' : 'plain';
  const stroke = track === 'taper' ? knobDiameter(value, zoom, coarse) : undefined;
  const lens = held?.lens === true;

  // The taper path is measured, so its round caps are true circles at any width.
  useLayoutEffect(() => {
    const trackEl = trackRef.current;
    const root = rootRef.current;
    if (track !== 'taper' || !trackEl || !root) return undefined;
    const draw = () => {
      const { width, height } = trackEl.getBoundingClientRect();
      const css = getComputedStyle(root);
      const start = Number.parseFloat(css.getPropertyValue('--sl-taper-start')) || 2;
      const end = Number.parseFloat(css.getPropertyValue('--sl-taper-end')) || 12;
      const d = taperPath(width, height, start, end);
      for (const svg of root.querySelectorAll<SVGSVGElement>('svg[data-taper]')) {
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.querySelector('path')?.setAttribute('d', d);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(trackEl);
    return () => observer.disconnect();
  }, [track]);

  // The bubble stays inside the viewport (§3.1), placed from the knob's final position so a
  // spring in flight does not move it.
  useLayoutEffect(() => {
    const bubbleEl = bubbleRef.current;
    const control = controlRef.current;
    if (bubbleState === 'hidden' || !bubbleEl || !control) return;
    const rect = control.getBoundingClientRect();
    const pad = Number.parseFloat(getComputedStyle(control).paddingLeft) || 0;
    const centre = rect.left + pad + position * (rect.width - 2 * pad);
    const dx = bubbleShift(centre, bubbleEl.offsetWidth, document.documentElement.clientWidth);
    bubbleEl.style.setProperty('--bubble-dx', `${dx}px`);
    const top = rect.top + rect.height / 2 - pad - 8 - bubbleEl.offsetHeight;
    bubbleEl.toggleAttribute('data-below', top < 8);
  }, [bubbleState, position]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      window.clearTimeout(pending.jump);
      window.clearTimeout(pending.release);
      window.clearTimeout(pending.bubble);
    };
  }, []);

  const emit = (next: number) => {
    if (next !== value) onValueChange?.(next);
  };

  const showBubble = (pointerType: string) =>
    bubble === 'always' || (bubble === 'auto' && pointerType !== 'mouse');

  const endInteraction = () => {
    const root = rootRef.current;
    const current = interaction.current;
    interaction.current = null;
    ended.current = current;
    setHeld(null);
    setBubbleState((state) => (state === 'hidden' ? state : 'leaving'));
    window.clearTimeout(timers.current.bubble);
    timers.current.bubble = window.setTimeout(() => setBubbleState('hidden'), BUBBLE_EXIT_MS);
    if (!root) return;
    if (current?.stretched) {
      root.setAttribute('data-release', '');
      root.style.setProperty('--slider-stretch', '0');
      window.clearTimeout(timers.current.release);
      timers.current.release = window.setTimeout(
        () => root.removeAttribute('data-release'),
        SPRING_MS.pop,
      );
    }
    const jump = root.dataset.jump;
    if (jump) {
      window.clearTimeout(timers.current.jump);
      timers.current.jump = window.setTimeout(
        () => root.removeAttribute('data-jump'),
        jump === 'spring' ? SPRING_MS.quick : SPRING_MS.track,
      );
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = interaction.current;
    const root = rootRef.current;
    const control = controlRef.current;
    if (!current || !root || !control) return;
    if (!current.moved) {
      current.moved = true;
      // A drag that continues from a track press follows on the short spring.
      if (root.dataset.jump === 'spring') root.dataset.jump = 'follow';
    }
    if (reducedMotion()) return;
    const rect = control.getBoundingClientRect();
    const pad = Number.parseFloat(getComputedStyle(control).paddingLeft) || 0;
    const x = event.clientX - current.grabOffset;
    const start = rect.left + pad;
    const end = rect.right - pad;
    const overshoot = x > end ? x - end : x < start ? x - start : 0;
    const share = rect.width > 0 ? stretchFor(overshoot) / rect.width : 0;
    root.style.setProperty('--slider-stretch', String(share));
    current.stretched ||= share !== 0;
  };

  const onPointerEnd = () => {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerEnd);
    document.removeEventListener('pointercancel', onPointerEnd);
    endInteraction();
  };

  const onControlPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (disabled || event.button !== 0 || !root) return;
    const target = event.target as Element;
    const thumb = target.closest('[data-slider-thumb]');
    let grabOffset = 0;
    if (thumb) {
      const r = thumb.getBoundingClientRect();
      grabOffset = event.clientX - (r.left + r.width / 2);
    }
    const reduced = reducedMotion();
    window.clearTimeout(timers.current.jump);
    window.clearTimeout(timers.current.release);
    root.removeAttribute('data-release');
    if (!thumb && !reduced) root.dataset.jump = 'spring';
    else root.removeAttribute('data-jump');
    interaction.current = {
      pointerType: event.pointerType,
      startValue: value,
      grabOffset,
      moved: false,
      snapped: stops.includes(value) ? value : undefined,
      last: value,
      stretched: false,
      committed: false,
    };
    setHeld({ lens: !reduced && track !== 'taper' });
    if (showBubble(event.pointerType)) {
      window.clearTimeout(timers.current.bubble);
      setBubbleState('shown');
    }
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerEnd);
    document.addEventListener('pointercancel', onPointerEnd);
  };

  const onBaseValueChange = (next: number, details: BaseSlider.Root.ChangeEventDetails) => {
    if (details.reason === 'input-change' || details.reason === 'keyboard') {
      // Assistive technology moved the native input (a swipe in VoiceOver): one step, as a
      // key press would, never one thousandth of the travel.
      const direction = next > Math.round(position * SCALE) ? 1 : -1;
      const stepped = keyStep(value, direction, 1, { ...range, step, detents: stops });
      if (stepped !== value) {
        onValueChange?.(stepped);
        onValueCommitted?.(stepped);
      }
      return;
    }
    let t = next / SCALE;
    let snapped: number | undefined;
    const current = interaction.current;
    if (stops.length > 0 && (details.reason === 'drag' || details.reason === 'track-press')) {
      const control = controlRef.current;
      const rect = control?.getBoundingClientRect();
      const pad = control ? Number.parseFloat(getComputedStyle(control).paddingLeft) || 0 : 0;
      const travel = rect ? rect.width - 2 * pad : 0;
      const pointerType = current?.pointerType ?? 'mouse';
      const threshold = pointerType === 'mouse' ? DETENT_SNAP_PX.fine : DETENT_SNAP_PX.coarse;
      const snap = snapToDetent(t, stops, range, travel, threshold);
      t = snap.position;
      snapped = snap.detent;
    }
    const nextValue = snapped ?? roundValue(positionToValue(t, range), range, step);
    if (current) {
      if (snapped !== undefined && snapped !== current.snapped && !reducedMotion()) {
        tickRef.current?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
          { duration: 60, easing: 'ease-out' },
        );
        detentHaptic();
      }
      current.snapped = snapped;
      current.last = nextValue;
    }
    emit(nextValue);
  };

  const onBaseValueCommitted = () => {
    // Keys are handled below; this is the end of a drag or a track press, reported by Base
    // UI either side of our own pointerup.
    const current = interaction.current ?? ended.current;
    ended.current = null;
    if (!current || current.committed) return;
    current.committed = true;
    if (current.last !== current.startValue) onValueCommitted?.(current.last);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const options = { ...range, step, detents: stops };
    const count = event.shiftKey ? 10 : 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = keyStep(value, 1, count, options);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = keyStep(value, -1, count, options);
        break;
      case 'PageUp':
        next = keyStep(value, 1, 10, options);
        break;
      case 'PageDown':
        next = keyStep(value, -1, 10, options);
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    // Handled here: Base UI's own key handler sees the prevented event and stands down.
    event.preventDefault();
    event.stopPropagation();
    if (next !== value) {
      onValueChange?.(next);
      onValueCommitted?.(next);
    }
  };

  const spoken = (valueText ?? format)(value);
  const rootStyle = {
    ...style,
    '--slider-pos': position,
    ...(gradient !== undefined ? { '--sl-gradient': gradient } : {}),
    ...(knobColor !== undefined ? { '--sl-knob-color': knobColor } : {}),
    ...(stroke ? { '--sl-stroke': `${stroke.diameter}px` } : {}),
  } as CSSProperties;

  const art = (
    <div className={styles.art}>
      {track === 'fill' ? <div className={styles.fill} /> : null}
      {track === 'taper' ? (
        <svg className={styles.taper} data-taper="" aria-hidden="true" focusable="false">
          <path />
        </svg>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={rootStyle}
      data-track={track}
      data-knob={knob}
      data-checker={checkerboard ? '' : undefined}
      data-lens={lens ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
    >
      {showLabel ? (
        <span id={labelId} className={styles.label}>
          {label}
        </span>
      ) : null}
      <BaseSlider.Root
        className={styles.slider}
        value={Math.round(position * SCALE)}
        min={0}
        max={SCALE}
        step={1}
        disabled={disabled}
        onValueChange={onBaseValueChange}
        onValueCommitted={onBaseValueCommitted}
      >
        <BaseSlider.Control
          ref={controlRef}
          className={styles.control}
          onPointerDown={onControlPointerDown}
        >
          <div ref={trackRef} className={styles.track}>
            {art}
          </div>
          {stops.length > 0 ? (
            <div className={styles.ticks} aria-hidden="true">
              {stops.map((detent) => {
                const at = valueToPosition(detent, range);
                return (
                  <span
                    key={detent}
                    className={styles.tickMark}
                    style={{ '--tick-pos': at } as CSSProperties}
                    data-passed={at <= position + 1e-9 ? '' : undefined}
                    data-current={detent === value ? '' : undefined}
                  />
                );
              })}
            </div>
          ) : null}
          <BaseSlider.Thumb
            className={styles.thumb}
            // Base UI places the thumb by percentage; the CSS transform places it instead.
            style={{ insetInlineStart: 0, top: '50%', translate: 'none' }}
            data-slider-thumb=""
            aria-label={showLabel ? undefined : label}
            aria-labelledby={showLabel ? labelId : undefined}
            aria-valuetext={spoken}
            inputRef={inputRef}
            onKeyDown={onKeyDown}
          >
            <span ref={tickRef} className={styles.tick}>
              <span className={styles.knob}>
                {knob !== 'plain' ? <span className={styles.swatch} /> : null}
                {knob !== 'stroke' ? (
                  <span className={styles.lens} aria-hidden="true">
                    <span className={styles.lensArt}>{art}</span>
                  </span>
                ) : null}
                {stroke?.notch ? (
                  <span className={styles.notch} data-notch={stroke.notch} aria-hidden="true">
                    <svg viewBox="0 0 8 8" focusable="false">
                      <path d={stroke.notch === '+' ? 'M1.5 4h5M4 1.5v5' : 'M1.5 4h5'} />
                    </svg>
                  </span>
                ) : null}
              </span>
            </span>
            {bubbleState !== 'hidden' ? (
              <span
                ref={bubbleRef}
                className={styles.bubble}
                data-leaving={bubbleState === 'leaving' ? '' : undefined}
                aria-hidden="true"
              >
                {format(value)}
              </span>
            ) : null}
          </BaseSlider.Thumb>
        </BaseSlider.Control>
      </BaseSlider.Root>
      {readout ? (
        <span className={styles.readout} aria-hidden="true">
          <span className={styles.sizer}>{format(min)}</span>
          <span className={styles.sizer}>{format(max)}</span>
          <span>{format(value)}</span>
        </span>
      ) : null}
      {name !== undefined ? <input type="hidden" name={name} value={String(value)} /> : null}
    </div>
  );
}
