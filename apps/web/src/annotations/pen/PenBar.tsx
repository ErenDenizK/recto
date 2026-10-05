/**
 * The pen's presets in the Draw group (experience-redesign spec §6.2, §7.4, §10), plugged into
 * the tool bar through `registerPenSlots` (PenBar.register.ts).
 *
 * Four ink dots of their real colour: the dot's size hints the width (10, 13 or 16 px), the
 * Highlighter is an 18 × 9 px capsule (its editor offers the four tints, 6–18 pt and no
 * opacity: it is always opaque, craft spec §5.4), and the armed preset has
 * a 2 px accent ring, not a fill, so its colour shows. The four sit in one quiet well so they
 * read as one control. These dots are the only colour that enters the chrome through content
 * (DESIGN.md §3).
 *
 * Tap a preset to arm it; tap the armed one again for its editor, the one popover recipe
 * (`ui/Popover`) rising from the dot (10-ink §6 on today's layout): the eight inks as swatches
 * (`ui/SwatchGroup`) and the colour well that opens the colour panel (`ui/colour/`), the width
 * on the log slider with the taper track, the detents of the old stops and the stroke itself
 * as the knob at the page's zoom (0.25–24 pt; the Highlighter 6–18 pt), opacity on the
 * checkerboard track, and "Reset to default". Edits change that preset and persist per
 * device. Nothing opens on its own: arming never opens the editor.
 *
 * Keyboard: the presets are a radiogroup inside the bar's roving tabindex. Left and Right
 * move between them (past either end, on to the bar), Space or Enter arms, Space or Enter on
 * the armed preset opens its editor, and Shift+Enter opens the focused preset's editor.
 * Arming says the preset ("Blue pen, 1.5 pt").
 *
 * The options tier (`PenTier`) holds one honesty note, and only once a pen with pressure has
 * been seen: the variable width lives in the stroke's appearance, and viewers that redraw
 * ink themselves show one width (spec §6.7, §13 decision 9). Otherwise the tier stays empty
 * and hidden. Tiers open only on request (P again, review finding 5), so the preset editor
 * repeats the note, where a tap on the armed preset leads.
 *
 * The armed preset's tooltip says how to leave it ("Black pen, 1.5 pt · Esc: Select").
 *
 * The eraser's options tier (`EraserTier`, craft spec §5.6; 10-ink §2.1): Whole stroke or
 * Partial on a segmented control, and the eraser's size on a slider with a detent at each of
 * its four sizes, 6 · 12 · 24 · 48 px (the cursor is that circle on the page). Both are
 * remembered per device (`tool-store.ts`). Partial's tooltip, also its description, says that
 * highlighter strokes and highlights are erased whole.
 */
import { Popover } from '@base-ui/react/popover';
import {
  type CSSProperties,
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { formatNumber, formatPercent, m } from '../../i18n';
import { animateStyle, type Motion, reducedMotion, springToLinear } from '../../motion';
import { announce } from '../../shell/announcer';
import type { PenBarProps } from '../../shell/FloatingToolbar.slots';
import { useUiStore } from '../../state/ui-store';
import { Button } from '../../ui/Button';
import { ColourPanel, colourSliderSizer, SliderSizer } from '../../ui/colour/ColourPanel';
import { ColourWell } from '../../ui/colour/ColourWell';
import { useColourLists } from '../../ui/colour/saved-colours';
import { StrokePreview } from '../../ui/colour/StrokePreview';
import { PopoverHeader, PopoverPopup } from '../../ui/Popover';
import { Segmented } from '../../ui/Segmented';
import { Slider, useCoarsePointer } from '../../ui/Slider';
import { Swatch } from '../../ui/Swatch';
import { SwatchGroup } from '../../ui/SwatchGroup';
import { Tooltip } from '../../ui/Tooltip';
import {
  ERASER_SIZES,
  type EraserMode,
  type EraserSize,
  useToolStore,
} from '../../viewer/tool-store';
import { useAnnotationStore } from '../annotation-store';
import { penSession } from './ink-input';
import {
  DEFAULT_PRESETS,
  dotSize,
  editorSwatches,
  isHighlighter,
  needsDotRing,
  type PenPreset,
  PRESET_INDICES,
  type PresetIndex,
  presetEditorTitle,
  presetLabel,
  presetName,
  presetWidthLimits,
  presetWidthStops,
  samePreset,
  widthText,
} from './presets';
import styles from './PenBar.module.css';

/** `#rrggbb` at `alpha` as `rgb()`, the dot's fill. */
function inkFill(color: string, alpha: number): string {
  const n = Number.parseInt(color.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

function InkMark({ preset }: { readonly preset: PenPreset }) {
  return (
    <span
      className={styles.mark}
      data-shape={isHighlighter(preset) ? 'capsule' : 'dot'}
      data-ring={needsDotRing(preset) ? '' : undefined}
      style={
        {
          '--dot': `${dotSize(preset.width)}px`,
          '--ink': inkFill(preset.color, preset.opacity),
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

/** The colour panel's column (CSS px, `ColourPanel.module.css`), which the editor shares. */
const COLUMN = { fine: 288, coarse: 324 } as const;

/** The preset whose editor is (or was last) shown, and the dot it rises from. */
interface Editing {
  readonly index: PresetIndex;
  readonly anchor: HTMLElement;
}

export function PenBar({ armed, arm }: PenBarProps) {
  const pen = useAnnotationStore((s) => s.pen);
  const [open, setOpen] = useState(false);
  // Kept after closing, so the editor keeps its content while it fades out.
  const [editing, setEditing] = useState<Editing | null>(null);
  const hintId = useId();

  const openEditor = (index: PresetIndex, anchor: HTMLElement) => {
    setEditing({ index, anchor });
    setOpen(true);
  };

  const tap = (index: PresetIndex, anchor: HTMLElement) => {
    if (armed && index === pen.active) {
      if (open && editing?.index === index) setOpen(false);
      else openEditor(index, anchor);
      return;
    }
    // Arming opens nothing (spec §6.2).
    setOpen(false);
    useAnnotationStore.getState().armPreset(index);
    arm();
    // Said instead of the generic "Pen tool" (same key), after a closed burst if any.
    announce(presetLabel(index, useAnnotationStore.getState().pen.presets[index]), {
      key: 'tool',
    });
  };

  const onDotKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: PresetIndex) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      openEditor(index, event.currentTarget);
      return;
    }
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const next = event.currentTarget
      .closest('[data-pen-presets]')
      ?.querySelector<HTMLElement>(`[data-pen-preset="${index + step}"]`);
    // Past either end the bar's roving tabindex moves on.
    if (step === 0 || !next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <>
      <div
        role="radiogroup"
        aria-label={m.pen_presets_label()}
        className={styles.presets}
        data-pen-presets=""
      >
        {PRESET_INDICES.map((i) => {
          const preset = pen.presets[i];
          const label = presetLabel(i, preset);
          const active = i === pen.active;
          return (
            <Tooltip
              key={i}
              label={armed && active ? m.bar_tool_escape({ tool: label }) : label}
              side="top"
            >
              <button
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={label}
                aria-describedby={armed && active ? hintId : undefined}
                className={styles.dot}
                data-pen-preset={i}
                data-armed={armed && active ? '' : undefined}
                data-editing={open && editing?.index === i ? '' : undefined}
                onClick={(event) => tap(i, event.currentTarget)}
                onKeyDown={(event) => onDotKeyDown(event, i)}
              >
                <InkMark preset={preset} />
              </button>
            </Tooltip>
          );
        })}
        <span id={hintId} hidden>
          {m.pen_preset_edit_hint()}
        </span>
      </div>
      {editing ? (
        <PresetEditor
          open={open}
          editing={editing}
          onClose={(byDot) => {
            // A press on the open preset's own dot toggles it there (`tap`).
            if (!byDot) setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** The editor's two pages (10-ink §6): the preset, and the colour views pushed in place. */
type EditorPage = 'preset' | 'colour';

/**
 * *Sheet push* inside the popover (language §7.3, as Settings): the page that comes in slides
 * 24 px from the side it comes from and fades in; nothing stays on it at rest (Q-2).
 */
function pushMotion(element: Element | null, direction: 1 | -1): void {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') return;
  const reduced = reducedMotion();
  const frames = reduced
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { transform: `translateX(${24 * direction}px)`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ];
  const curve = reduced ? { duration: 150, easing: 'ease-out' } : springToLinear('smooth');
  const animation = element.animate(frames, { duration: curve.duration, easing: curve.easing });
  animation.onfinish = () => animation.cancel();
}

/**
 * The preset editor (10-ink §6), one popover with two pages:
 *
 * - **Preset**: "Edit black pen" and ✕; the colour well, then six swatches
 *   (`editorSwatches`); Width on the log taper slider with the stroke as its knob; Opacity on
 *   the checkerboard (not for the Highlighter); the stroke preview on paper (colour, width and
 *   opacity, live); the pressure note when a pen with pressure was seen; Reset to default.
 * - **Colour**: the well pushes the colour panel's views in place (Grid, Spectrum, Sliders,
 *   opacity, saved and recent colours) with ‹ Back, so the pen has one editor and nothing
 *   opens over it (XD-3 finding 1). Esc there reverts the colour and comes back; Back keeps it.
 *
 * The popover keeps its anchor while its page changes. Its own height follows the new page on
 * the smooth spring through the motion core (`animateStyle`, Q-6's rule for a glass shape:
 * its own geometry, nothing clipped or scaled), while the new page slides in (*sheet push*);
 * reduced motion sets the height at once and only fades. Both pages share the colour panel's
 * column and its slider columns (`SliderSizer`), so every label, track and readout sits on the
 * same lines on either page. Focus goes to ‹ Back on the way in and to the well on the way out.
 */
function PresetEditor({
  open,
  editing,
  onClose,
}: {
  readonly open: boolean;
  readonly editing: Editing;
  /** `byDot`: the press that closes it was on the preset's own dot. */
  readonly onClose: (byDot: boolean) => void;
}) {
  const { index: i, anchor } = editing;
  const preset = useAnnotationStore((s) => s.pen.presets[i]);
  // The width knob is the stroke as it will draw at the page's zoom (10-ink §3.3).
  const zoom = useUiStore((s) => s.zoom);
  const coarse = useCoarsePointer();
  const { recent } = useColourLists();
  const [page, setPage] = useState<EditorPage>('preset');
  const [sampling, setSampling] = useState(false);
  // A fresh colour page each time it is pushed: Esc reverts to the colour it was pushed with.
  const [pushes, setPushes] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLButtonElement>(null);
  const resize = useRef<{ from: number; motion: Motion | null }>({ from: -1, motion: null });
  const colourTitleId = useId();

  const title = presetEditorTitle(i, preset);
  const edit = (patch: Partial<PenPreset>) => useAnnotationStore.getState().editPreset(i, patch);
  const swatches = editorSwatches(preset, recent);
  const swatchChosen = swatches.some((swatch) => swatch.color === preset.color.toUpperCase());
  // The Highlighter: its own width range (6–18 pt) and no opacity (craft spec §5.4).
  const highlighter = isHighlighter(preset);
  const limits = presetWidthLimits(preset);
  const pressure = usePressureSeen();
  const isDefault = samePreset(preset, DEFAULT_PRESETS[i]);
  // Every label and readout either page can show: their tracks share one start and one end.
  const sizer = {
    labels: [m.pen_editor_width(), m.annot_opacity()],
    readouts: [widthText(limits.max), widthText(limits.min), formatPercent(1)],
  };
  const shared = colourSliderSizer();

  // Each opening starts on the preset page.
  const [shownFor, setShownFor] = useState(editing);
  if (open && shownFor !== editing) {
    setShownFor(editing);
    setPage('preset');
    setSampling(false);
  }

  const go = (next: EditorPage) => {
    if (next === page) return;
    const popup = popupRef.current;
    resize.current.from = popup ? popup.getBoundingClientRect().height : -1;
    if (next === 'colour') setPushes((n) => n + 1);
    setPage(next);
  };

  // The page changed: the popover's height springs to the new page's, the page slides in.
  useLayoutEffect(() => {
    const popup = popupRef.current;
    const state = resize.current;
    const from = state.from;
    state.from = -1;
    if (!popup || from < 0) return;
    const running = state.motion?.stop();
    state.motion = null;
    popup.style.removeProperty('height');
    const to = popup.getBoundingClientRect().height;
    pushMotion(popup.querySelector(`[data-editor-page="${page}"]`), page === 'colour' ? 1 : -1);
    if (Math.abs(to - from) >= 1 && !reducedMotion()) {
      popup.setAttribute('data-resizing', '');
      const motion = animateStyle(popup, 'height', running?.value ?? from, to, {
        spring: 'smooth',
        ...(running ? { velocity: running.velocity } : {}),
      });
      state.motion = motion;
      void motion.finished.then(() => {
        if (state.motion !== motion) return;
        state.motion = null;
        popup.removeAttribute('data-resizing');
      });
    } else {
      popup.removeAttribute('data-resizing');
    }
    // Focus follows the page when it was on the page that left.
    const active = document.activeElement;
    if (active !== document.body && !popup.contains(active)) return;
    if (page === 'colour') popup.querySelector<HTMLElement>('[data-colour-back]')?.focus();
    else wellRef.current?.focus();
  }, [page]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        // While the eyedropper samples the page, a press there is its pick, not a dismissal;
        // on the colour page Esc is the panel's (revert, then back).
        if (sampling || (page === 'colour' && details.reason === 'escape-key')) {
          details.cancel();
          return;
        }
        const target = details.event?.target;
        onClose(target instanceof Node && anchor.contains(target));
      }}
    >
      <PopoverPopup
        ref={popupRef}
        anchor={anchor}
        side="top"
        align="center"
        sideOffset={12}
        className={styles.editor}
        data-annotation-keep=""
        data-testid="pen-preset-editor"
        data-page={page}
        data-sampling={sampling ? '' : undefined}
        finalFocus={() => anchor}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented || page !== 'preset') return;
          // Only the editor closes: the pen stays armed.
          event.preventDefault();
          onClose(false);
        }}
      >
        <div className={styles.page} data-editor-page="preset" hidden={page !== 'preset'}>
          <SliderSizer
            labels={[...shared.labels, ...sizer.labels]}
            readouts={[...shared.readouts, ...sizer.readouts]}
          />
          <PopoverHeader title={title} className={styles.header} />

          <div className={styles.colours}>
            <ColourWell
              ref={wellRef}
              value={preset.color}
              opacity={highlighter ? undefined : preset.opacity}
              label={m.pen_editor_more_colours()}
              onClick={() => go('colour')}
            />
            <span className={styles.wellDivider} aria-hidden="true" />
            <SwatchGroup
              label={m.colour_title()}
              value={swatchChosen ? preset.color : null}
              onValueChange={(color) => edit({ color })}
              className={styles.swatches}
            >
              {swatches.map((swatch) => (
                <Swatch key={swatch.color} value={swatch.color} name={swatch.name?.()} />
              ))}
            </SwatchGroup>
          </div>

          <Slider
            className={styles.slider}
            label={m.pen_editor_width()}
            showLabel
            readout
            scale="log"
            track="taper"
            detents={presetWidthStops(preset)}
            min={limits.min}
            max={limits.max}
            step={0.25}
            value={preset.width}
            knobColor={inkFill(preset.color, preset.opacity)}
            zoom={zoom}
            format={widthText}
            valueText={(width) =>
              m.slider_value_points({ value: formatNumber(width, { maximumFractionDigits: 2 }) })
            }
            onValueChange={(width) => edit({ width })}
          />
          {highlighter ? null : (
            <Slider
              className={styles.slider}
              label={m.annot_opacity()}
              showLabel
              readout
              track="gradient"
              gradient={`linear-gradient(to right, ${inkFill(preset.color, 0)}, ${preset.color})`}
              checkerboard
              knobColor={inkFill(preset.color, preset.opacity)}
              min={10}
              max={100}
              step={5}
              value={Math.round(preset.opacity * 100)}
              format={(percent) => formatPercent(percent / 100)}
              valueText={(percent) => m.slider_value_percent({ value: formatNumber(percent) })}
              onValueChange={(percent) => edit({ opacity: percent / 100 })}
            />
          )}

          <StrokePreview
            colour={preset.color}
            opacity={highlighter ? 1 : preset.opacity}
            width={preset.width}
            kind={highlighter ? 'highlighter' : 'pen'}
            size={coarse ? COLUMN.coarse : COLUMN.fine}
          />

          {pressure && !highlighter ? (
            <p className={styles.note} data-testid="pen-editor-width-note">
              {m.pen_width_note()}
            </p>
          ) : null}

          <Button
            variant="standard"
            className={styles.reset}
            disabled={isDefault}
            reason={m.pen_editor_reset_unneeded()}
            onClick={() => {
              useAnnotationStore.getState().resetPreset(i);
              const reset = useAnnotationStore.getState().pen.presets[i];
              announce(m.pen_preset_reset_done({ name: presetName(i, reset) }));
            }}
          >
            {m.pen_editor_reset()}
          </Button>
        </div>

        {page === 'colour' ? (
          <div className={styles.colourPage} data-editor-page="colour">
            <ColourPanel
              key={pushes}
              value={preset.color}
              opacity={highlighter ? undefined : preset.opacity}
              onChange={(color, opacity) =>
                edit(opacity === undefined ? { color } : { color, opacity })
              }
              onClose={(reason) => (reason === 'escape' ? go('preset') : onClose(false))}
              onBack={() => go('preset')}
              onSamplingChange={setSampling}
              titleId={colourTitleId}
              sizer={sizer}
            />
          </div>
        ) : null}
      </PopoverPopup>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// The options tier
// ---------------------------------------------------------------------------

/** Pointer events end strokes; the session's pressure flag can only change with them. */
function subscribePointers(listener: () => void): () => void {
  window.addEventListener('pointerup', listener, { capture: true });
  window.addEventListener('pointermove', listener, { capture: true, passive: true });
  return () => {
    window.removeEventListener('pointerup', listener, { capture: true });
    window.removeEventListener('pointermove', listener, { capture: true });
  };
}

/** Whether a pen has reported real pressure in this session (ink-input.ts). */
export function usePressureSeen(): boolean {
  return useSyncExternalStore(
    subscribePointers,
    () => penSession().pressureSeen,
    () => false,
  );
}

/** The pen's options tier: the variable-width honesty note, once pressure has been seen. */
export function PenTier() {
  const pressure = usePressureSeen();
  if (!pressure) return null;
  return (
    <p className={styles.note} data-testid="pen-width-note">
      {m.pen_width_note()}
    </p>
  );
}

// ---------------------------------------------------------------------------
// The eraser's options tier
// ---------------------------------------------------------------------------

const ERASER_MODES: readonly {
  readonly mode: EraserMode;
  readonly label: () => string;
  readonly tooltip: () => string;
}[] = [
  { mode: 'stroke', label: m.eraser_mode_stroke, tooltip: m.eraser_mode_stroke_tooltip },
  { mode: 'partial', label: m.eraser_mode_partial, tooltip: m.eraser_mode_partial_tooltip },
];

/** The eraser's size from the slider: the nearest of its four sizes (they are its detents). */
function nearestEraserSize(value: number): EraserSize {
  return ERASER_SIZES.reduce((best, size) =>
    Math.abs(Math.log(size / value)) < Math.abs(Math.log(best / value)) ? size : best,
  );
}

/** The eraser's options tier: Whole stroke or Partial, and its size (module header). */
export function EraserTier() {
  const eraserMode = useToolStore((s) => s.eraserMode);
  const eraserSize = useToolStore((s) => s.eraserSize);
  return (
    <div className={styles.eraserTier} data-testid="eraser-options">
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
      <span className={styles.divider} aria-hidden="true" />
      <Slider
        className={styles.eraserSize}
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
    </div>
  );
}
