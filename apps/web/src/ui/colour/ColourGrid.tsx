/**
 * The Grid view (`10-ink.md` §4.1, §4.3): twelve greys on top, then nine rows of twelve hues,
 * dark to light (`colourGrid`, computed in OKLCH and clamped to sRGB).
 *
 * - A `radiogroup` of 120 radios with a 2-D keyboard: the arrows move and choose (Up and
 *   Down between rows, no wrap at the edges), Home and End go to the ends of the row. One
 *   Tab stop: the chosen cell, else the cell nearest the current colour.
 * - Each cell is named by the nearest colour name ("Dark blue"); the Tab-stop cell (the one
 *   the arrows reach) also has its hex as its description.
 * - Cells are whole pixels: 23 px columns (the last 24) with 1 px gaps across the view's
 *   288 px (coarse 26 / 27 across 324), so every edge is sharp at 1×.
 */
import { type KeyboardEvent, useId, useRef } from 'react';

import { m } from '../../i18n';
import { colourGrid, colourName, hexToRgb, rgbToOklab } from './colour-math';
import styles from './ColourGrid.module.css';

export interface ColourGridProps {
  /** `#RRGGBB`. */
  readonly value: string;
  readonly onChange: (hex: string) => void;
}

const COLUMNS = 12;

/** Rows of the grid, greys first. */
function table(): readonly (readonly string[])[] {
  const { greys, rows } = colourGrid();
  return [greys, ...rows];
}

/** The cell nearest a colour (OKLab), for the Tab stop when no cell matches. */
function nearestCell(cells: readonly (readonly string[])[], hex: string): [number, number] {
  const lab = rgbToOklab(hexToRgb(hex));
  let best: [number, number] = [0, 0];
  let bestD = Number.POSITIVE_INFINITY;
  cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const o = rgbToOklab(hexToRgb(cell));
      const d = (o[0] - lab[0]) ** 2 + (o[1] - lab[1]) ** 2 + (o[2] - lab[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [r, c];
      }
    });
  });
  return best;
}

export function ColourGrid({ value, onChange }: ColourGridProps) {
  const cells = table();
  const groupRef = useRef<HTMLDivElement>(null);
  const hexId = useId();
  const hex = value.toUpperCase();
  let checked: [number, number] | undefined;
  cells.forEach((row, r) => {
    const c = row.indexOf(hex);
    if (c >= 0 && !checked) checked = [r, c];
  });
  const [stopRow, stopCol] = checked ?? nearestCell(cells, hex);

  const choose = (row: number, col: number) => {
    const next = cells[row]?.[col];
    if (!next) return;
    onChange(next);
    groupRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const last = cells.length - 1;
    let next: [number, number] | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        next = [row, Math.max(0, col - 1)];
        break;
      case 'ArrowRight':
        next = [row, Math.min(COLUMNS - 1, col + 1)];
        break;
      case 'ArrowUp':
        next = [Math.max(0, row - 1), col];
        break;
      case 'ArrowDown':
        next = [Math.min(last, row + 1), col];
        break;
      case 'Home':
        next = [row, 0];
        break;
      case 'End':
        next = [row, COLUMNS - 1];
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next[0] !== row || next[1] !== col) choose(next[0], next[1]);
  };

  return (
    <div ref={groupRef} role="radiogroup" aria-label={m.colour_grid()} className={styles.grid}>
      {cells.map((row, r) => (
        <div key={r === 0 ? 'greys' : `row-${r}`} className={styles.row} role="presentation">
          {row.map((cell, c) => {
            const on = checked?.[0] === r && checked[1] === c;
            const stop = r === stopRow && c === stopCol;
            return (
              <button
                key={cell + String(c)}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={colourName(cell)}
                aria-describedby={stop ? hexId : undefined}
                tabIndex={stop ? 0 : -1}
                className={styles.cell}
                style={{ background: cell }}
                data-row={r}
                data-col={c}
                onClick={() => choose(r, c)}
                onKeyDown={(event) => onKeyDown(event, r, c)}
              />
            );
          })}
        </div>
      ))}
      <span id={hexId} hidden>
        {cells[stopRow]?.[stopCol]}
      </span>
    </div>
  );
}
