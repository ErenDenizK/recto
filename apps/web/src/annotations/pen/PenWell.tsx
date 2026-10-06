/**
 * The pen well (`03-markup` MK-6; ADR-0021: four presets, the fourth is the Highlighter): the
 * three pens and the Highlighter as cells of one quiet well in the Draw group.
 *
 * - **Cells** are toolbar buttons with `aria-pressed` (not a radiogroup), so one arrow path
 *   serves the whole palette; `--bar-button` targets (32 fine, 44 coarse; Q-9). A pen's dot is
 *   its real ink at 10, 13 or 16 px by width (12, 15, 18 coarse); the Highlighter is a 20 × 8
 *   tint capsule. Dots are content colours with the inner contrast ring where their edge would
 *   fall below 3:1 on the glass (`needsDotRing`).
 * - **Armed** is a ring, never lime (`language.md` §1.9, 03.4): a 2 px ring in the primary
 *   text colour with a gap, springing in on *select*; only while the pen itself is armed.
 * - **Press** arms the preset and says it ("Red pen, 2 pt"); a press on the armed cell, or ↑ on
 *   it, opens its editor (`PresetEditor.tsx`, MK-8). Arming never opens anything.
 * - The Highlighter cell folds separately in narrow windows (03.9), so the palette renders the
 *   pens and the Highlighter as two items of one well (`cells`).
 */
import { type CSSProperties, type KeyboardEvent, useId, useState } from 'react';

import { m } from '../../i18n';
import { armedTooltip } from '../../markup/ToolButton';
import { announce } from '../../shell/announcer';
import { Tooltip } from '../../ui/Tooltip';
import { useToolStore } from '../../viewer/tool-store';
import { useAnnotationStore } from '../annotation-store';
import { activateTool } from '../commands';
import { toolDefinition } from '../tools';
import { type Editing, PresetEditor } from './PresetEditor';
import {
  dotSize,
  inkFill,
  isHighlighter,
  needsDotRing,
  type PenPreset,
  type PresetIndex,
  presetLabel,
} from './presets';
import styles from './PenWell.module.css';

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

/** Arms a preset the way its cell does, and says which (MK-6 §6). */
export function armPenPreset(index: PresetIndex): void {
  useAnnotationStore.getState().armPreset(index);
  void activateTool(toolDefinition('ink'));
  announce(presetLabel(index, useAnnotationStore.getState().pen.presets[index]), { key: 'tool' });
}

export interface PenWellProps {
  /** The cells to show, in well order: the pens, and the Highlighter unless it is folded. */
  readonly cells: readonly PresetIndex[];
  /** The palette items the cells measure as (`data-item`): pens, then the Highlighter. */
  readonly items?: { readonly pens: string; readonly highlighter: string } | undefined;
}

export function PenWell({ cells, items }: PenWellProps) {
  const presets = useAnnotationStore((s) => s.pen.presets);
  const active = useAnnotationStore((s) => s.pen.active);
  const penArmed = useToolStore((s) => s.mode === 'ink');
  const editorOpen = useToolStore((s) => s.editorOpen);
  const lastPen = useToolStore((s) => s.lastPen);
  // Kept after closing, so the editor keeps its content while it fades out.
  const [editing, setEditing] = useState<Editing | null>(null);
  const hintId = useId();
  const open = editorOpen && penArmed && editing?.index === active;

  const press = (index: PresetIndex, anchor: HTMLElement) => {
    const tools = useToolStore.getState();
    if (penArmed && index === active) {
      if (open) tools.setEditorOpen(false);
      else {
        setEditing({ index, anchor });
        tools.setEditorOpen(true);
      }
      return;
    }
    tools.setEditorOpen(false);
    armPenPreset(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: PresetIndex) => {
    if (event.key !== 'ArrowUp' || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (!(penArmed && index === active)) armPenPreset(index);
    setEditing({ index, anchor: event.currentTarget });
    useToolStore.getState().setEditorOpen(true);
  };

  const pens = cells.filter((i) => !isHighlighter(presets[i]));
  const highlighter = cells.filter((i) => isHighlighter(presets[i]));

  const cell = (i: PresetIndex) => {
    const preset = presets[i];
    const label = presetLabel(i, preset);
    const armed = penArmed && i === active;
    return (
      <Tooltip key={i} label={armedTooltip(label, armed, armed)} side="top">
        <button
          type="button"
          aria-pressed={armed}
          aria-label={label}
          aria-describedby={armed ? hintId : undefined}
          aria-haspopup="dialog"
          aria-keyshortcuts={
            i === lastPen && !isHighlighter(preset) ? 'P' : isHighlighter(preset) ? 'H' : undefined
          }
          className={styles.cell}
          data-pen-preset={i}
          data-item={isHighlighter(preset) ? items?.highlighter : undefined}
          data-editing={open && editing?.index === i ? '' : undefined}
          onClick={(event) => press(i, event.currentTarget)}
          onKeyDown={(event) => onKeyDown(event, i)}
        >
          <InkMark preset={preset} />
        </button>
      </Tooltip>
    );
  };

  return (
    <>
      <span className={styles.well} data-pen-well="" data-item={items?.pens}>
        {pens.map(cell)}
        {highlighter.map(cell)}
      </span>
      <span id={hintId} hidden>
        {m.markup_choices_hint()}
      </span>
      {editing ? (
        <PresetEditor
          open={open}
          editing={editing}
          onClose={(byCell) => {
            // A press on the open preset's own cell toggles it there (`press`).
            if (!byCell) useToolStore.getState().setEditorOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
