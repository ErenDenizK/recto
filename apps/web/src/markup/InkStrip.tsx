/**
 * The ink strip (`10-ink` §2; replaces `03-markup` MK-7's options tier and chip): the armed
 * tool's colour and size, one press away from the moment it arms.
 *
 * ```
 * ◉  ● ● ● ● ● ●  │  ╺━━━━━━━●━━━━━━━━━━╸  1.5 pt
 * ```
 *
 * - **◉ the colour well** (`ui/colour/ColourPicker`): the current colour inside the conic hue
 *   ring, which opens the colour panel (Grid · Spectrum · Sliders, eyedropper, saved colours)
 *   above it.
 * - **Six swatches** (`ui/Swatch`): a pen's black, blue, red, green and purple, then its own
 *   or the last custom colour, else orange (`editorSwatches`); the Highlighter's four tints,
 *   a custom tint and a 50 % grey. The selected swatch is the colour's own ring (§5).
 * - **The width slider** (`ui/Slider`, §3): the log scale with the pen's detents, the tapered
 *   track, and the knob drawn as the stroke itself, in its ink, at the page's zoom; the
 *   readout in tabular numerals ("1.5 pt", TR "1,5 pt").
 * - **Per tool** (§2.1): the Highlighter its tints and 6–18 pt; the eraser Whole stroke ·
 *   Partial and its size; a text box its colour and a font-size stepper; a note its colour;
 *   shapes their stroke colour and width. Tools without options have no strip (`hasInkStrip`).
 *
 * Every change goes through `applyStyle` (experience-redesign §6.3): with a selection it edits
 * the selection (one history step per control), else the armed tool's style, which for a pen
 * is its armed preset (persisted per device). Opacity is not here: it lives in the colour panel
 * and the preset editor, and the knob shows it.
 *
 * The strip is content, not glass (Q-4): it sits in the palette's own glass, inline or as a
 * second row (`MarkupPalette.tsx`). No label text shows inside it; accessible names carry the
 * meaning and tooltips name each control after the delay (§2.2). It is a `toolbar` named
 * "{tool} options"; the swatches are one radio stop (§2.3).
 */
import { type ReactNode, useRef } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { normalizeHex } from '../annotations/colors';
import { toolStyleGroup } from '../annotations/drafts';
import {
  editorSwatches,
  inkFill,
  isHighlighter,
  type PenPreset,
  presetWidthLimits,
  presetWidthStops,
  WIDTH_STOPS,
  widthText,
} from '../annotations/pen/presets';
import { FONT_SIZES, strokeWidthText } from '../annotations/StyleControls';
import { toolDefinition } from '../annotations/tools';
import { formatNumber, m } from '../i18n';
import { useApplyDialogStore } from '../redaction/apply-store';
import { showRedactionsPanel } from '../redaction/commands';
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { ColourPicker } from '../ui/colour/ColourPicker';
import { useColourLists } from '../ui/colour/saved-colours';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Segmented } from '../ui/Segmented';
import { Slider } from '../ui/Slider';
import { Swatch } from '../ui/Swatch';
import { SwatchGroup } from '../ui/SwatchGroup';
import { ERASER_SIZES, type EraserSize, type ToolMode, useToolStore } from '../viewer/tool-store';
import { useRovingTabindex } from './roving';
import styles from './InkStrip.module.css';

/** What the strip shows for the armed tool (§2.1). */
export type StripKind = 'pen' | 'highlighter' | 'eraser' | 'text' | 'note' | 'shape' | 'redact';

/** The strip for `mode` (the pen's depends on its armed preset), or none. */
export function stripKind(mode: ToolMode, preset: PenPreset | undefined): StripKind | null {
  if (mode === 'ink') return preset && isHighlighter(preset) ? 'highlighter' : 'pen';
  if (mode === 'eraser') return 'eraser';
  // Until the pending-marks bar (D1-6) holds Apply, the Redact tool keeps it here.
  if (mode === 'redact') return 'redact';
  switch (toolStyleGroup(mode)) {
    case 'text':
      return 'text';
    case 'note':
      return 'note';
    case 'shape':
      return 'shape';
    default:
      return null;
  }
}

/** Whether the armed tool shows a strip (Select, Lasso, Image, Stamp, Sign, Edit text: none). */
export function useStripKind(): StripKind | null {
  const mode = useToolStore((s) => s.mode);
  const preset = useAnnotationStore((s) => s.pen.presets[s.pen.active]);
  return stripKind(mode, preset);
}

export function InkStrip({ kind }: { readonly kind: StripKind }) {
  const ref = useRef<HTMLDivElement>(null);
  const roving = useRovingTabindex(ref, '[aria-checked="true"]');
  const mode = useToolStore((s) => s.mode);
  const tool = toolDefinition(mode);
  const name = kind === 'highlighter' ? m.tool_highlighter() : tool.title();
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={m.bar_options({ tool: name })}
      aria-orientation="horizontal"
      className={styles.strip}
      data-ink-strip={kind}
      data-annotation-keep=""
      data-testid="ink-strip"
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
    >
      {kind === 'pen' || kind === 'highlighter' ? <PenStrip /> : null}
      {kind === 'eraser' ? <EraserStrip /> : null}
      {kind === 'text' || kind === 'note' || kind === 'shape' ? <StyleStrip kind={kind} /> : null}
      {kind === 'redact' ? <RedactStrip /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

const setColour = (color: string, opacity?: number) => {
  useAnnotationStore
    .getState()
    .applyStyle(opacity === undefined ? { color: normalizeHex(color) } : { color, opacity });
};

function Divider() {
  return <span className={styles.divider} aria-hidden="true" />;
}

/** The well and six swatches (§2.1). */
function Colours({
  colour,
  opacity,
  swatches,
  preview,
}: {
  readonly colour: string;
  /** Undefined: no opacity in the panel (the Highlighter, text). */
  readonly opacity?: number | undefined;
  readonly swatches: readonly {
    readonly color: string;
    readonly name?: (() => string) | undefined;
  }[];
  readonly preview?: { readonly width: number; readonly kind: 'pen' | 'highlighter' } | undefined;
}) {
  const hex = colour.toUpperCase();
  const chosen = swatches.some((s) => s.color.toUpperCase() === hex) ? hex : null;
  return (
    <span className={styles.colours}>
      <ColourPicker
        value={hex}
        opacity={opacity}
        onChange={(value, alpha) => setColour(value, alpha)}
        preview={preview}
        label={m.pen_editor_more_colours()}
        side="top"
      />
      <SwatchGroup
        label={m.annot_color()}
        value={chosen}
        onValueChange={(value) => setColour(value)}
        className={styles.swatches}
      >
        {swatches.map((swatch) => (
          <Swatch key={swatch.color} value={swatch.color} name={swatch.name?.()} />
        ))}
      </SwatchGroup>
    </span>
  );
}

/** The width slider (§3.3): log scale, detents, the taper track and the stroke as its knob. */
function Width({
  value,
  min,
  max,
  detents,
  ink,
  format,
}: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly detents: readonly number[];
  readonly ink: string;
  readonly format: (width: number) => string;
}) {
  const zoom = useUiStore((s) => s.zoom);
  return (
    <Slider
      className={styles.width}
      label={m.pen_editor_width()}
      readout
      scale="log"
      track="taper"
      detents={detents}
      min={min}
      max={max}
      step={0.25}
      value={value}
      knobColor={ink}
      zoom={zoom}
      format={format}
      valueText={(width) =>
        m.slider_value_points({ value: formatNumber(width, { maximumFractionDigits: 2 }) })
      }
      onValueChange={(strokeWidth) => useAnnotationStore.getState().applyStyle({ strokeWidth })}
    />
  );
}

/** A pen or the Highlighter: the armed preset (§2.1). */
function PenStrip() {
  const preset = useAnnotationStore((s) => s.pen.presets[s.pen.active]);
  const { recent } = useColourLists();
  const highlighter = isHighlighter(preset);
  const limits = presetWidthLimits(preset);
  return (
    <>
      <Colours
        colour={preset.color}
        opacity={highlighter ? undefined : preset.opacity}
        swatches={editorSwatches(preset, recent)}
        preview={{ width: preset.width, kind: highlighter ? 'highlighter' : 'pen' }}
      />
      <Divider />
      <Width
        value={preset.width}
        min={limits.min}
        max={limits.max}
        detents={presetWidthStops(preset)}
        ink={inkFill(preset.color, preset.opacity)}
        format={widthText}
      />
    </>
  );
}

/** The shapes' stroke, a text box's colour and size, a note's colour (§2.1). */
function StyleStrip({ kind }: { readonly kind: 'text' | 'note' | 'shape' }) {
  const style = useAnnotationStore((s) => s.styles[kind]);
  const { recent } = useColourLists();
  const like: PenPreset =
    kind === 'note'
      ? { color: style.color, width: 12, opacity: 1, kind: 'highlighter' }
      : { color: style.color, width: style.strokeWidth, opacity: style.opacity };
  return (
    <>
      <Colours
        colour={style.color}
        opacity={kind === 'shape' ? style.opacity : undefined}
        swatches={editorSwatches(like, recent)}
      />
      {kind === 'shape' ? (
        <>
          <Divider />
          <Width
            value={style.strokeWidth}
            min={0.5}
            max={12}
            detents={WIDTH_STOPS}
            ink={inkFill(style.color, style.opacity)}
            format={strokeWidthText}
          />
        </>
      ) : null}
      {kind === 'text' ? (
        <>
          <Divider />
          <FontSizeStepper size={style.fontSize} />
        </>
      ) : null}
    </>
  );
}

/** A text box's size (§2.1): − 12 pt +, through the type scale of `FONT_SIZES`. */
function FontSizeStepper({ size }: { readonly size: number }) {
  const set = (fontSize: number) => useAnnotationStore.getState().applyStyle({ fontSize });
  const smaller = [...FONT_SIZES].reverse().find((s) => s < size);
  const larger = FONT_SIZES.find((s) => s > size);
  return (
    <span role="group" aria-label={m.annot_font_size()} className={styles.stepper}>
      <IconButton
        size="bar"
        tooltipSide="top"
        label={m.markup_font_smaller()}
        icon={<Icon name="minus" />}
        aria-disabled={smaller === undefined ? 'true' : undefined}
        onClick={() => {
          if (smaller !== undefined) set(smaller);
        }}
      />
      <span className={styles.readout} aria-live="polite">
        {m.annot_points({ value: formatNumber(size) })}
      </span>
      <IconButton
        size="bar"
        tooltipSide="top"
        label={m.markup_font_larger()}
        icon={<Icon name="plus" />}
        aria-disabled={larger === undefined ? 'true' : undefined}
        onClick={() => {
          if (larger !== undefined) set(larger);
        }}
      />
    </span>
  );
}

const ERASER_MODES = [
  { mode: 'stroke', label: m.eraser_mode_stroke, tooltip: m.eraser_mode_stroke_tooltip },
  { mode: 'partial', label: m.eraser_mode_partial, tooltip: m.eraser_mode_partial_tooltip },
] as const;

/** The eraser's size from the slider: the nearest of its four sizes (they are its detents). */
function nearestEraserSize(value: number): EraserSize {
  return ERASER_SIZES.reduce((best, size) =>
    Math.abs(Math.log(size / value)) < Math.abs(Math.log(best / value)) ? size : best,
  );
}

/** The eraser (§2.1): Whole stroke · Partial, and its size on screen (6–48 px). */
function EraserStrip() {
  const eraserMode = useToolStore((s) => s.eraserMode);
  const eraserSize = useToolStore((s) => s.eraserSize);
  return (
    <>
      <Segmented
        className={styles.eraserModes}
        label={m.eraser_mode_label()}
        value={eraserMode}
        onValueChange={(mode) => useToolStore.getState().setEraserMode(mode)}
        options={ERASER_MODES.map(({ mode, label, tooltip }) => ({
          value: mode,
          label: label(),
          description: tooltip(),
        }))}
      />
      <Divider />
      <Slider
        className={styles.width}
        label={m.eraser_size_label()}
        readout
        scale="log"
        detents={ERASER_SIZES}
        min={ERASER_SIZES[0]}
        max={ERASER_SIZES[ERASER_SIZES.length - 1] ?? 48}
        value={eraserSize}
        format={(size) => m.eraser_size_option({ size: formatNumber(size) })}
        onValueChange={(size) => useToolStore.getState().setEraserSize(nearestEraserSize(size))}
      />
    </>
  );
}

/**
 * Redact: Apply, until the pending-marks bar of `04-context` (D1-6) holds it ("2 marks · Mark
 * area · Apply"). Not an ink option; it keeps J10 within reach meanwhile.
 */
function RedactStrip(): ReactNode {
  return (
    <Button
      variant="quiet"
      icon={<Icon name="shield-check" />}
      aria-haspopup="dialog"
      data-apply-redactions=""
      onClick={() => {
        showRedactionsPanel();
        useApplyDialogStore.getState().setOpen(true);
      }}
    >
      {m.bar_apply_redactions()}
    </Button>
  );
}
