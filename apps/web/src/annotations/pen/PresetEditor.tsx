/**
 * The preset editor (`10-ink` §6, `03-markup` MK-8): a second press on the armed pen, the
 * Highlighter's cell, or ↑ on it, opens it; it is the same M4 popover as the colour panel
 * (`ui/Popover`), titled "Edit black pen", rising from the pen's cell.
 *
 * From top to bottom: the colour well and the six swatches (`editorSwatches`), the width on
 * the log taper slider with the stroke itself as its knob at the page's zoom (0.25–24 pt;
 * the Highlighter 6–18 pt), opacity on the checkerboard track (not for the Highlighter, which
 * is always opaque with Multiply), the stroke preview on paper, the pressure note once a pen
 * with pressure has been seen, and Reset to default. Edits apply live to the preset, which
 * persists per device. Esc or ✕ closes only the editor (the Esc ladder's first step) and
 * focus returns to the pen's cell.
 *
 * The pen's options are one press away without it: the ink strip (`markup/InkStrip.tsx`)
 * shows the same colour and width from arming. This editor holds the rest.
 */
import { Popover } from '@base-ui/react/popover';
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

import { formatNumber, formatPercent, m } from '../../i18n';
import { animateStyle, type Motion, reducedMotion, sheetPush } from '../../motion';
import { announce } from '../../shell/announcer';
import { useUiStore } from '../../state/ui-store';
import { Button } from '../../ui/Button';
import { ColourPanel, colourSliderSizer, SliderSizer } from '../../ui/colour/ColourPanel';
import { ColourWell } from '../../ui/colour/ColourWell';
import { useColourLists } from '../../ui/colour/saved-colours';
import { StrokePreview } from '../../ui/colour/StrokePreview';
import { PopoverHeader, PopoverPopup } from '../../ui/Popover';
import { Slider, useCoarsePointer } from '../../ui/Slider';
import { Swatch } from '../../ui/Swatch';
import { SwatchGroup } from '../../ui/SwatchGroup';
import { abovePalette } from '../../markup/anchor';
import { useAnnotationStore } from '../annotation-store';
import { penSession } from './ink-input';
import {
  DEFAULT_PRESETS,
  editorSwatches,
  inkFill,
  isHighlighter,
  type PenPreset,
  type PresetIndex,
  presetEditorTitle,
  presetName,
  presetWidthLimits,
  presetWidthStops,
  samePreset,
  widthText,
} from './presets';
import styles from './PresetEditor.module.css';

/** The colour panel's column (CSS px, `ColourPanel.module.css`), which the editor shares. */
const COLUMN = { fine: 288, coarse: 324 } as const;

/** The preset whose editor is (or was last) shown, and the cell it rises from. */
export interface Editing {
  readonly index: PresetIndex;
  readonly anchor: HTMLElement;
}

/** The editor's two pages (10-ink §6): the preset, and the colour views pushed in place. */
type EditorPage = 'preset' | 'colour';

/**
 * Moves Base UI's positioner, which it places with `transform: translate(x, y)`, up by `dy` px
 * now. Base UI follows a size change of the popover on its next measure, a frame or more
 * late, which would bob a popover anchored above the bar; placed here first, its own update
 * then writes the same position.
 */
function raise(positioner: HTMLElement, dy: number): void {
  if (Math.abs(dy) < 0.01) return;
  const at = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(positioner.style.transform);
  if (!at) return;
  positioner.style.transform = `translate(${at[1]}px, ${Number(at[2]) - dy}px)`;
}

/** A page change in flight: the height it starts from, its motion, the positioner's hold. */
interface ResizeState {
  from: number;
  motion: Motion | null;
  /** While the height springs, the positioner keeps the larger of the two heights. */
  held: { readonly el: HTMLElement; readonly height: number } | null;
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
 * reduced motion sets the height at once and only fades. Above the bar its bottom edge stays
 * where it is: for the spring the positioner holds the larger height with the popover at its
 * foot (`raise`), so Base UI need not chase the size frame by frame. Both pages share the colour panel's
 * column and its slider columns (`SliderSizer`), so every label, track and readout sits on the
 * same lines on either page. Focus goes to ‹ Back on the way in and to the well on the way out.
 */
export function PresetEditor({
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
  const resize = useRef<ResizeState>({ from: -1, motion: null, held: null });
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
    // Above the bar the popover grows and shrinks from its bottom edge, which stays put.
    const positioner = popup.parentElement;
    const pinned = positioner?.dataset.side === 'top' ? positioner : null;
    const held = state.held?.el === pinned ? state.held : null;
    const running = state.motion?.stop();
    state.motion = null;
    popup.style.removeProperty('height');
    const to = popup.getBoundingClientRect().height;
    const start = running?.value ?? from;
    // The height the positioner is placed for now: what it holds, else the page that left.
    const placed = held?.height ?? from;
    // *Sheet push* inside the popover (language §7.3, X8, as Settings).
    sheetPush(popup.querySelector(`[data-editor-page="${page}"]`), page === 'colour' ? 1 : -1);
    if (Math.abs(to - start) >= 1 && !reducedMotion()) {
      if (pinned) {
        const hold = Math.max(start, to);
        raise(pinned, hold - placed);
        pinned.style.height = `${hold}px`;
        state.held = { el: pinned, height: hold };
      }
      popup.setAttribute('data-resizing', '');
      const motion = animateStyle(popup, 'height', start, to, {
        spring: 'smooth',
        ...(running ? { velocity: running.velocity } : {}),
      });
      state.motion = motion;
      void motion.finished.then(() => {
        if (state.motion !== motion) return;
        state.motion = null;
        popup.removeAttribute('data-resizing');
        const hold = state.held;
        state.held = null;
        if (!hold) return;
        raise(hold.el, to - hold.height);
        hold.el.style.removeProperty('height');
      });
    } else {
      popup.removeAttribute('data-resizing');
      state.held = null;
      if (pinned) {
        raise(pinned, to - placed);
        pinned.style.removeProperty('height');
      }
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
        anchor={abovePalette(() => anchor)}
        side="top"
        align="center"
        sideOffset={12}
        className={styles.editor}
        positionerClassName={styles.editorPositioner}
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
            labels={[...new Set([...shared.labels, ...sizer.labels])]}
            readouts={[...new Set([...shared.readouts, ...sizer.readouts])]}
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
// Pressure
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
