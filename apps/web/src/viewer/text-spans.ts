/**
 * The text layer's span geometry and copy handler, shared by the full edition's
 * `TextLayer.tsx` and the compact edition's reader (`shell/compact/CompactTextLayer.tsx`,
 * ADR-0033 §3 "two shells to keep in step"). Pure DOM helpers with no editing code, so the
 * compact edition's chunk does not carry the page-text editor.
 *
 * - `lineStyle`: one transparent span per laid-out line (`text-model.ts`), in the layer's
 *   font, stretched to the run's width and rotated with it, so native selection covers the
 *   printed glyphs.
 * - `installCopyHandler`: replaces the browser's copy text (absolutely positioned spans
 *   serialize one per line) with the assembled page text whenever the selection lies in a
 *   text layer, and pulses the copied lines once (`copy-pulse.ts`).
 */
import type { CSSProperties } from 'react';

import { pulseSelection } from './copy-pulse';
import { selectionCopyText, type TextLine } from './text-model';

/** The text layer's font (TextLayer.module.css sets the same family). */
export const TEXT_LAYER_FONT_FAMILY = 'sans-serif';
const MEASURE_SIZE = 100;

let measureContext: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** Width of `text` at 100 px in the layer's font (memoized). */
function measure(text: string): number {
  const cached = widths.get(text);
  if (cached !== undefined) return cached;
  measureContext ??= document.createElement('canvas').getContext('2d');
  let width = text.length * MEASURE_SIZE * 0.5;
  if (measureContext) {
    measureContext.font = `${MEASURE_SIZE}px ${TEXT_LAYER_FONT_FAMILY}`;
    width = measureContext.measureText(text).width;
  }
  if (widths.size > 5000) widths.clear();
  widths.set(text, width);
  return width;
}

/** Position, size, stretch and rotation of one line's span (CSS px of the page). */
export function lineStyle(line: TextLine): CSSProperties {
  const natural = (measure(line.text) * line.thickness) / MEASURE_SIZE;
  const scaleX = natural > 0 ? line.length / natural : 1;
  const transforms: string[] = [];
  if (line.angle !== 0) transforms.push(`rotate(${line.angle}deg)`);
  if (Math.abs(scaleX - 1) > 0.001) transforms.push(`scaleX(${scaleX})`);
  return {
    left: line.left,
    top: line.top,
    fontSize: line.thickness,
    ...(transforms.length === 0 ? {} : { transform: transforms.join(' ') }),
  };
}

/**
 * Replaces the browser's copy text with the assembled page text whenever the selection
 * lies in a text layer. Returns a disposer.
 */
export function installCopyHandler(target: Document = document): () => void {
  const onCopy = (event: ClipboardEvent) => {
    const text = selectionCopyText(target.getSelection());
    if (text === undefined || !event.clipboardData) return;
    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    // The copied lines pulse once (motion-2026-10 viewer.md §5).
    pulseSelection(target.getSelection());
  };
  target.addEventListener('copy', onCopy);
  return () => target.removeEventListener('copy', onCopy);
}
