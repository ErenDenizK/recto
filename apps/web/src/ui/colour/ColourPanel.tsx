/**
 * The colour panel (`10-ink.md` §4; replaces MK-8's colour rows and every native colour
 * input): the content of the M4 popover the colour well opens (`ColourPicker.tsx`).
 *
 * ```
 * ⊙            Colour            ✕      eyedropper · title · close (44 px row)
 * [  Grid  |  Spectrum  |  Sliders  ]  Segmented, remembered per device
 * (the chosen view, 288 × 192; coarse 324 × 222)
 * Opacity ━━━━━━━━━━━━━━━━━━●  100%    checkerboard track (hidden when `opacity` is undefined)
 * (stroke preview on paper, 56 px)      when `preview` is given
 * Saved colours  [+] ● ● ● …           up to 12; right click, long press or Delete removes
 * Recent  ● ● ● ● ● ●                  last six colours committed here
 * ```
 *
 * - **Live, then one commit** (§4.2). Every change calls `onChange` at once (the preset or
 *   the selection previews); `onCommit` follows a 600 ms pause and the panel's close, so a
 *   selection gets one history step per settled change, not one per pixel of a drag.
 * - **Esc reverts** to the colour (and opacity) the panel opened with, and closes. A text
 *   field's own Esc (restoring its draft) comes first.
 * - **Eyedropper**: the panel hands the page to `Eyedropper` and tells its host
 *   (`onSamplingChange`) so the popover can step aside; a pick sets the colour.
 * - **No fill** (shape fills): ⊘ leads the saved row and sets `NO_FILL`.
 * - The views share one width; their sizes are whole pixels at both densities.
 */
import { ContextMenu } from '@base-ui/react/context-menu';
import { ChevronLeft, Pipette, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import { formatNumber, formatPercent, m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { readJson, writeJson } from '../../state/safe-storage';
import { type PixelSampler, samplePagePixels } from '../../viewer/page-pixels';
import menuStyles from '../Menu.module.css';
import { Segmented } from '../Segmented';
import { Slider, useCoarsePointer } from '../Slider';
import { NO_FILL, Swatch, swatchName } from '../Swatch';
import { SwatchGroup } from '../SwatchGroup';
import { ColourGrid } from './ColourGrid';
import { cssRgba } from './colour-math';
import styles from './ColourPanel.module.css';
import { ColourSliders } from './ColourSliders';
import { ColourSpectrum } from './ColourSpectrum';
import { Eyedropper } from './Eyedropper';
import {
  addSavedColour,
  noteRecentColour,
  removeSavedColour,
  SAVED_MAX,
  useColourLists,
} from './saved-colours';
import { StrokePreview } from './StrokePreview';

/** The view the panel shows, remembered per device (§4.2). */
export type ColourView = 'grid' | 'spectrum' | 'sliders';
export const COLOUR_VIEW_KEY = 'pdf-editor:ui:colour-view:v1';
/** Quiet time after a change before it is committed (ms, §4.2). */
export const COMMIT_PAUSE_MS = 600;

const VIEWS: readonly ColourView[] = ['grid', 'spectrum', 'sliders'];
/** The views' width (CSS px): whole-pixel grid columns at each density. */
const VIEW_WIDTH = { fine: 288, coarse: 324 } as const;

function storedView(): ColourView {
  const value = readJson(COLOUR_VIEW_KEY);
  return VIEWS.includes(value as ColourView) ? (value as ColourView) : 'grid';
}

export interface ColourPanelProps {
  /** `#RRGGBB`, or `NO_FILL` when `allowNoFill`. */
  readonly value: string;
  /** 0–1; undefined hides the opacity row (the Highlighter, text). */
  readonly opacity?: number | undefined;
  /** Live, on every change. */
  readonly onChange: (value: string, opacity: number | undefined) => void;
  /** After a 600 ms pause and on close: one history step for a selection. */
  readonly onCommit?: ((value: string, opacity: number | undefined) => void) | undefined;
  /** ✕ (after committing) or Esc (after reverting). */
  readonly onClose: (reason: 'close' | 'escape') => void;
  /** The stroke preview's width (points) and kind; none without. */
  readonly preview?: { readonly width: number; readonly kind: 'pen' | 'highlighter' } | undefined;
  /** Offer ⊘ (shape fills). */
  readonly allowNoFill?: boolean | undefined;
  /** The eyedropper's source; default: the rendered page bitmap. */
  readonly sampler?: PixelSampler | undefined;
  /** The eyedropper started (true) or ended (false): the host steps aside meanwhile. */
  readonly onSamplingChange?: ((sampling: boolean) => void) | undefined;
  /** The title element's id, for the host popover's `aria-labelledby`. */
  readonly titleId?: string | undefined;
  /** The title (default "Colour"). */
  readonly title?: string | undefined;
  /**
   * The panel is a page pushed inside another popover (the pen's preset editor, §6): the
   * title row leads with ‹ Back (which commits, then calls this) beside the eyedropper, and
   * the panel is a group named by its title instead of the popover's content.
   */
  readonly onBack?: (() => void) | undefined;
  /** More labels and readouts for the shared slider columns (`SliderSizer`). */
  readonly sizer?: SliderSizerProps | undefined;
}

export interface SliderSizerProps {
  readonly labels?: readonly string[] | undefined;
  readonly readouts?: readonly string[] | undefined;
}

/**
 * The labels and readouts every slider of the colour panel can show (Hue, Saturation,
 * Brightness, Opacity; "360°", "100%"), so the columns are the same in every view and the
 * Opacity track starts where the Hue track does (10-ink §4.1).
 */
export function colourSliderSizer(): {
  readonly labels: readonly string[];
  readonly readouts: readonly string[];
} {
  return {
    labels: [m.colour_hue(), m.colour_saturation(), m.colour_brightness(), m.colour_opacity()],
    readouts: [m.slider_readout_degrees({ value: formatNumber(360) }), formatPercent(1)],
  };
}

/**
 * The shared slider columns, drawn as nothing: a zero-height subgrid row in the first row of a
 * `[label] [track] [readout]` grid (`.panel`, or a page that matches it), holding every label
 * and readout the grid's sliders may show. The label and readout columns take the widest of
 * them, so tracks start and end on one line in every view, whatever the language, and do not
 * move when a view with other sliders is chosen.
 */
export function SliderSizer({ labels = [], readouts = [] }: SliderSizerProps) {
  return (
    <div className={styles.sizer} aria-hidden="true">
      <span className={styles.sizerCell}>
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </span>
      <span />
      <span className={`${styles.sizerCell} ${styles.sizerReadout}`}>
        {readouts.map((readout) => (
          <span key={readout}>{readout}</span>
        ))}
      </span>
    </div>
  );
}

export function ColourPanel({
  value,
  opacity,
  onChange,
  onCommit,
  onClose,
  preview,
  allowNoFill = false,
  sampler = samplePagePixels,
  onSamplingChange,
  titleId,
  title,
  onBack,
  sizer,
}: ColourPanelProps) {
  const [initial] = useState(() => ({ value, opacity }));
  const [view, setView] = useState<ColourView>(storedView);
  const [sampling, setSampling] = useState<{ x: number; y: number } | null>(null);
  const [fullNotice, setFullNotice] = useState(false);
  const { saved, recent } = useColourLists();
  const ownTitleId = useId();
  const commitTimer = useRef<number | undefined>(undefined);
  const latest = useRef({ value, opacity });
  const lastCommitted = useRef({ value, opacity });
  const committedSinceOpen = useRef(false);
  const coarse = useCoarsePointer();
  const isHex = value !== NO_FILL;

  // The host may change the colour too (an undo while the panel is open).
  useLayoutEffect(() => {
    latest.current = { value, opacity };
  }, [value, opacity]);

  const commitNow = () => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = undefined;
    const now = latest.current;
    const before = lastCommitted.current;
    if (now.value === before.value && now.opacity === before.opacity) return;
    lastCommitted.current = now;
    committedSinceOpen.current = true;
    onCommit?.(now.value, now.opacity);
    if (now.value !== NO_FILL && now.value !== initial.value) noteRecentColour(now.value);
  };

  // A pending commit is flushed when the panel goes away (closed by its host).
  const flush = useRef(commitNow);
  useLayoutEffect(() => {
    flush.current = commitNow;
  });
  useEffect(
    () => () => {
      if (commitTimer.current !== undefined) flush.current();
    },
    [],
  );

  const change = (nextValue: string, nextOpacity: number | undefined = opacity) => {
    latest.current = { value: nextValue, opacity: nextOpacity };
    onChange(nextValue, nextOpacity);
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(commitNow, COMMIT_PAUSE_MS);
  };

  const close = () => {
    commitNow();
    onClose('close');
  };

  const back = () => {
    commitNow();
    onBack?.();
  };

  const revert = () => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = undefined;
    latest.current = initial;
    onChange(initial.value, initial.opacity);
    if (committedSinceOpen.current) {
      lastCommitted.current = initial;
      onCommit?.(initial.value, initial.opacity);
    }
    onClose('escape');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented || sampling) return;
    event.preventDefault();
    event.stopPropagation();
    revert();
  };

  const chooseView = (next: ColourView) => {
    setView(next);
    writeJson(COLOUR_VIEW_KEY, next);
  };

  const startSampling = (x: number, y: number) => {
    setSampling({ x, y });
    onSamplingChange?.(true);
  };

  const endSampling = () => {
    setSampling(null);
    onSamplingChange?.(false);
  };

  const addCurrent = () => {
    if (!isHex) return;
    const result = addSavedColour(value);
    if (result === 'full') {
      setFullNotice(true);
      announce(m.colour_saved_full());
    } else if (result === 'added') {
      setFullNotice(false);
      announce(m.colour_saved_added({ name: swatchName(value) }));
    }
  };

  const removeSaved = (hex: string) => {
    removeSavedColour(hex);
    setFullNotice(false);
    announce(m.colour_saved_removed({ name: swatchName(hex) }));
  };

  const hexValue = isHex ? value.toUpperCase() : '#FFFFFF';
  const viewColour = isHex ? hexValue : (recent[0] ?? '#000000');
  const opacityPercent = Math.round((opacity ?? 1) * 100);
  const shared = colourSliderSizer();

  const eyedropper = (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={m.colour_eyedropper()}
      aria-pressed={sampling !== null}
      onClick={(event) => {
        // A keyboard click has no position: the loupe starts mid-viewport.
        const pointer = event.detail > 0;
        startSampling(
          pointer ? event.clientX : window.innerWidth / 2,
          pointer ? event.clientY : window.innerHeight / 2,
        );
      }}
    >
      <Pipette aria-hidden="true" />
    </button>
  );

  return (
    // The panel listens for Esc on behalf of every control inside it.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.panel}
      onKeyDown={onKeyDown}
      data-sampling={sampling ? '' : undefined}
      data-colour-panel=""
      {...(onBack ? { role: 'group', 'aria-labelledby': titleId ?? ownTitleId } : {})}
    >
      <SliderSizer
        labels={[...shared.labels, ...(sizer?.labels ?? [])]}
        readouts={[...shared.readouts, ...(sizer?.readouts ?? [])]}
      />
      <div className={styles.header} data-nav={onBack ? '' : undefined}>
        <div className={styles.headerSide}>
          {onBack ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label={m.common_back()}
              onClick={back}
              data-colour-back=""
            >
              <ChevronLeft aria-hidden="true" />
            </button>
          ) : null}
          {eyedropper}
        </div>
        <h2 id={titleId ?? ownTitleId} className={styles.title}>
          {title ?? m.colour_title()}
        </h2>
        <div className={styles.headerSide} data-end="">
          <button
            type="button"
            className={styles.iconButton}
            aria-label={m.common_close()}
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <Segmented
        className={styles.views}
        label={m.colour_views()}
        value={view}
        onValueChange={chooseView}
        options={[
          { value: 'grid', label: m.colour_view_grid() },
          { value: 'spectrum', label: m.colour_view_spectrum() },
          { value: 'sliders', label: m.colour_view_sliders() },
        ]}
      />

      <div className={styles.view} data-view={view}>
        {view === 'grid' ? <ColourGrid value={viewColour} onChange={(hex) => change(hex)} /> : null}
        {view === 'spectrum' ? (
          <ColourSpectrum value={viewColour} onChange={(hex) => change(hex)} />
        ) : null}
        {view === 'sliders' ? (
          <ColourSliders value={viewColour} onChange={(hex) => change(hex)} />
        ) : null}
      </div>

      {opacity !== undefined ? (
        <Slider
          className={styles.opacity}
          label={m.colour_opacity()}
          showLabel
          readout
          min={0}
          max={100}
          step={1}
          value={opacityPercent}
          track="gradient"
          checkerboard
          gradient={`linear-gradient(to right, ${cssRgba(hexValue, 0)}, ${cssRgba(hexValue)})`}
          knobColor={cssRgba(hexValue, opacity)}
          bubble="never"
          format={(v) => formatPercent(v / 100)}
          valueText={(v) => m.slider_value_percent({ value: formatNumber(v) })}
          disabled={!isHex}
          onValueChange={(v) => change(value, v / 100)}
        />
      ) : null}

      {preview && isHex ? (
        <StrokePreview
          colour={hexValue}
          opacity={opacity ?? 1}
          width={preview.width}
          kind={preview.kind}
          size={coarse ? VIEW_WIDTH.coarse : VIEW_WIDTH.fine}
        />
      ) : null}

      <section className={styles.section} aria-labelledby={`${ownTitleId}-saved`}>
        <h3 id={`${ownTitleId}-saved`} className={styles.caption}>
          {m.colour_saved()}
        </h3>
        <div className={styles.savedRow}>
          <button
            type="button"
            className={styles.add}
            aria-label={m.colour_saved_add_label()}
            aria-disabled={!isHex || saved.length >= SAVED_MAX || undefined}
            aria-describedby={fullNotice ? `${ownTitleId}-full` : undefined}
            onClick={addCurrent}
          >
            <span className={styles.addDot} aria-hidden="true">
              <svg viewBox="0 0 10 10" focusable="false">
                <path d="M5 1.5v7M1.5 5h7" />
              </svg>
            </span>
          </button>
          {saved.length > 0 || allowNoFill ? (
            <SwatchGroup
              label={m.colour_saved()}
              value={isHex ? hexValue : NO_FILL}
              onValueChange={(next) => change(next)}
              className={styles.swatches}
            >
              {allowNoFill ? <Swatch value={NO_FILL} /> : null}
              {saved.map((hex) => (
                <ContextMenu.Root key={hex}>
                  <ContextMenu.Trigger
                    className={styles.savedTrigger}
                    onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                      if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        removeSaved(hex);
                      }
                    }}
                  >
                    <Swatch value={hex} />
                  </ContextMenu.Trigger>
                  <ContextMenu.Portal>
                    <ContextMenu.Positioner sideOffset={4} collisionPadding={8}>
                      <ContextMenu.Popup className={menuStyles.popup}>
                        <ContextMenu.Item
                          className={menuStyles.item}
                          onClick={() => removeSaved(hex)}
                        >
                          {m.colour_saved_remove()}
                        </ContextMenu.Item>
                      </ContextMenu.Popup>
                    </ContextMenu.Positioner>
                  </ContextMenu.Portal>
                </ContextMenu.Root>
              ))}
            </SwatchGroup>
          ) : null}
        </div>
        {fullNotice ? (
          <p id={`${ownTitleId}-full`} className={styles.notice}>
            {m.colour_saved_full()}
          </p>
        ) : null}
      </section>

      {recent.length > 0 ? (
        <section className={styles.section} aria-labelledby={`${ownTitleId}-recent`}>
          <h3 id={`${ownTitleId}-recent`} className={styles.caption}>
            {m.colour_recent()}
          </h3>
          <SwatchGroup
            label={m.colour_recent()}
            value={isHex ? hexValue : null}
            onValueChange={(next) => change(next)}
            className={styles.swatches}
          >
            {recent.map((hex) => (
              <Swatch key={hex} value={hex} />
            ))}
          </SwatchGroup>
        </section>
      ) : null}

      {sampling ? (
        <Eyedropper
          sample={sampler}
          start={sampling}
          onPick={(hex) => {
            endSampling();
            change(hex);
          }}
          onCancel={endSampling}
        />
      ) : null}
    </div>
  );
}
