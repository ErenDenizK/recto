/**
 * The ink strip (`10-ink` §2; replaces `03-markup` MK-7's options tier and chip): the armed
 * tool's colour and size, one press away from the moment it arms.
 *
 * ```
 * ◉  ● ● ●  │  ╺━━━━━━━●━━━━━━━━━━╸  1.5 pt
 * ```
 *
 * - **◉ the colour well** (`ui/colour/ColourPicker`): the armed tool's colour inside the conic
 *   hue ring, which opens the colour panel (Grid · Spectrum · Sliders, eyedropper, saved
 *   colours) above it. It is named by the colour ("Colour: Blue").
 * - **Recent colours** (`ink-recents.ts`; owner answer to G8, 2026-10-09): up to four colours
 *   this pen (or tool) had before, newest first, never its current one. There is no fixed
 *   swatch row: it repeated the dock's pens ("repeat?"), and the pens stay the dock's, as in
 *   Apple Notes. Before a pen has changed colour the row is empty. A text box, a note and the
 *   shapes have no pens in the dock, so their own palette fills the row after their recents.
 * - **The width slider** (`ui/Slider`, §3): the pen's detents evenly spaced (log between them),
 *   the tapered track, and the stroke inside the knob, in its ink, at the page's zoom; the
 *   readout in tabular numerals ("1.5 pt", TR "1,5 pt").
 * - **Per tool** (§2.1): the Highlighter its colour and 6–18 pt; the eraser Whole stroke ·
 *   Partial and its size; a text box its colour and a font-size stepper; a note its colour;
 *   shapes their stroke colour and width. Tools without options have no strip (`hasInkStrip`).
 *
 * Every change goes through `applyStyle` (experience-redesign §6.3): with a selection it edits
 * the selection (one history step per control), else the armed tool's style, which for a pen
 * is its armed preset (persisted per device). Opacity is not here: it lives in the colour panel
 * and the preset editor, and the knob shows it.
 *
 * The strip is content, not glass (Q-4): it sits in its own small glass piece floating above
 * the palette (`StripPiece.tsx`, owner feedback F3). No label text shows inside it; accessible
 * names carry the meaning and tooltips name each control after the delay (§2.2). It is a
 * `toolbar` named "{tool} options"; the recent colours are one radio stop (§2.3).
 *
 * The width sliders show no value bubble: the readout sits right beside the track, in view of a
 * finger on the knob, and a bubble rising from the knob over the strip's rim read as a notch
 * stuck on the knob (owner feedback F3, "bug").
 */
import { type ReactNode, useRef } from 'react';

import { useAnnotationStore } from '../annotations/annotation-store';
import { normalizeHex } from '../annotations/colors';
import { toolStyleGroup } from '../annotations/drafts';
import {
  editorSwatches,
  HIGHLIGHTER_SWATCHES,
  inkFill,
  isHighlighter,
  PEN_SWATCHES,
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
import { useUiStore } from '../state/ui-store';
import { Button } from '../ui/Button';
import { ColourPicker } from '../ui/colour/ColourPicker';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Segmented } from '../ui/Segmented';
import { Slider } from '../ui/Slider';
import { Swatch } from '../ui/Swatch';
import { SwatchGroup } from '../ui/SwatchGroup';
import { ERASER_SIZES, type EraserSize, type ToolMode, useToolStore } from '../viewer/tool-store';
import {
  INK_RECENT_SHOWN,
  type InkRecentKey,
  noteInkLeft,
  shownRecents,
  useInkRecents,
} from './ink-recents';
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

/**
 * The colour (§2.1; owner answer to G8): the well with the tool's current colour, which opens
 * the colour panel, then up to four colours this tool had before (`ink-recents.ts`), newest
 * first. No fixed swatches: the pens' colours are the dock's (`PenWell`), and the full
 * palette is one press away in the panel. Every pick goes through `applyStyle`, so the armed
 * pen's dot in the dock follows the panel live; the colour the tool leaves becomes its first
 * recent once the panel commits (a 600 ms pause or its close) or a recent is picked.
 */
function Colours({
  recents: key,
  colour,
  opacity,
  preview,
  suggested = [],
}: {
  readonly recents: InkRecentKey;
  readonly colour: string;
  /** Undefined: no opacity in the panel (the Highlighter, text). */
  readonly opacity?: number | undefined;
  readonly preview?: { readonly width: number; readonly kind: 'pen' | 'highlighter' } | undefined;
  /** Colours that fill the row after the recents (tools with no pens in the dock). */
  readonly suggested?: readonly string[] | undefined;
}) {
  const hex = colour.toUpperCase();
  const recents = fillRecents(shownRecents(useInkRecents(key), hex), suggested, hex);
  // The colour the panel's changes started from, until they commit.
  const base = useRef<string | null>(null);
  return (
    <span className={styles.colours}>
      <ColourPicker
        value={hex}
        opacity={opacity}
        onChange={(value, alpha) => {
          base.current ??= hex;
          setColour(value, alpha);
        }}
        onCommit={(value) => {
          if (base.current !== null) noteInkLeft(key, base.current, value);
          base.current = null;
        }}
        preview={preview}
        side="top"
      />
      {recents.length > 0 ? (
        <SwatchGroup
          label={m.ink_recent_colours()}
          value={null}
          onValueChange={(value) => {
            noteInkLeft(key, hex, value);
            setColour(value);
          }}
          className={styles.swatches}
        >
          {recents.map((recent) => (
            <Swatch key={recent} value={recent} name={paletteSwatchName(recent)} />
          ))}
        </SwatchGroup>
      ) : null}
    </span>
  );
}

/**
 * The row for a tool whose colours are not the dock's (text box, note, shapes): its recents,
 * then its own palette (`editorSwatches`) up to the same four, so the strip never stands as a
 * lone well and a first colour is still one press. The pens and the Highlighter get no such
 * fill: their colours are the dock's pens (G8, "repeat?").
 */
function fillRecents(
  recents: readonly string[],
  suggested: readonly string[],
  current: string,
): readonly string[] {
  const out = [...recents];
  for (const colour of suggested) {
    if (out.length >= INK_RECENT_SHOWN) break;
    const hex = colour.toUpperCase();
    if (hex !== current && !out.includes(hex)) out.push(hex);
  }
  return out;
}

/** A palette colour's own name ("Blue"), else none (the Swatch names it by its nearest). */
function paletteSwatchName(hex: string): string | undefined {
  return [...PEN_SWATCHES, ...HIGHLIGHTER_SWATCHES].find((s) => s.color === hex)?.name();
}

/**
 * The width slider (§3.3): the stops scale (the detents evenly spaced, log between them), the
 * taper track and the stroke inside its knob.
 */
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
      bubble="never"
      scale="stops"
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
  const active = useAnnotationStore((s) => s.pen.active);
  const preset = useAnnotationStore((s) => s.pen.presets[s.pen.active]);
  const highlighter = isHighlighter(preset);
  const limits = presetWidthLimits(preset);
  return (
    <>
      <Colours
        recents={`pen:${active}`}
        colour={preset.color}
        opacity={highlighter ? undefined : preset.opacity}
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
  const like: PenPreset =
    kind === 'note'
      ? { color: style.color, width: 12, opacity: 1, kind: 'highlighter' }
      : { color: style.color, width: style.strokeWidth, opacity: style.opacity };
  return (
    <>
      <Colours
        recents={kind}
        colour={style.color}
        opacity={kind === 'shape' ? style.opacity : undefined}
        suggested={editorSwatches(like).map((swatch) => swatch.color)}
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
        bubble="never"
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
 * area · Apply"). Not an ink option; it keeps J10 within reach meanwhile. It opens the S19
 * sheet alone (07-sheets §20.1); the sidebar stays as it was.
 */
function RedactStrip(): ReactNode {
  return (
    <Button
      variant="quiet"
      icon={<Icon name="shield-check" />}
      aria-haspopup="dialog"
      data-apply-redactions=""
      onClick={() => useApplyDialogStore.getState().setOpen(true)}
    >
      {m.bar_apply_redactions()}
    </Button>
  );
}
