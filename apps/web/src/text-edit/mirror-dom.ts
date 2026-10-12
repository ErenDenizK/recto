/**
 * The paragraph editor's hidden mirror as DOM (craft spec §4.7 "a hidden `contenteditable`
 * mirror"; EDN-17): its text laid out in the canvas's lines, and the two maps between the
 * model's UTF-16 offsets and DOM positions inside it.
 *
 * - **Lines.** One block per laid-out line (`[data-mirror-line]`), each holding one text node
 *   in a span scaled onto the drawn line, so the lines tile the mirror's box in the canvas's
 *   breaks. The mirror's own font stays at its least size (16 px on phones, which iOS needs
 *   to not zoom); the span's transform shrinks it onto the line. A point inside the box (the
 *   iOS keyboard's trackpad, a tap, `caretPositionFromPoint`) then lands on the text drawn
 *   under it, and a move down lands on the next drawn line.
 * - **Offsets.** A DOM position is read as the number of characters before it in the mirror
 *   (a `Range` from the mirror's start), so a position on the mirror element itself (child
 *   index offsets, an empty mirror) or in any of its nodes maps right; never inside a
 *   surrogate pair. A position outside the mirror maps to nothing.
 */
import { type Affine, apply } from './glyph-canvas';
import { type CaretLine, clampOffset } from './paragraph-model';

/** One line of the mirror: its text and where it is drawn, CSS px in the mirror's box. */
export interface MirrorLine {
  readonly text: string;
  /** The band the line owns, top and height (the bands tile the box). */
  readonly top: number;
  readonly height: number;
  /** Where the drawn line starts and how wide it is. */
  readonly left: number;
  readonly width: number;
  /** The drawn glyphs' size (the span is scaled from the mirror's font size to it). */
  readonly size: number;
}

/** The characters before (`node`, `offset`) inside `mirror`; null outside it. */
export function mirrorOffset(mirror: Node, node: Node | null, offset: number): number | null {
  if (!node || !mirror.contains(node)) return null;
  const doc = mirror.ownerDocument ?? document;
  const range = doc.createRange();
  range.setStart(mirror, 0);
  try {
    range.setEnd(node, offset);
  } catch {
    // An offset past the node's end (a stale selection): the node's end.
    range.setEnd(node, nodeLength(node));
  }
  const text = mirror.textContent ?? '';
  return clampOffset(text, range.toString().length);
}

/** The DOM position of text offset `offset` in `mirror`. */
export function mirrorPosition(mirror: Node, offset: number): { node: Node; offset: number } {
  const texts = textNodes(mirror);
  let count = 0;
  for (let i = 0; i < texts.length; i++) {
    const node = texts[i] as Text;
    const end = count + node.data.length;
    // A line break between lines shows the caret at the next line's start (the canvas's rule:
    // a line owns [start, next)); the text's end stays on the last line.
    if (offset < end || (offset === end && i === texts.length - 1)) {
      return { node, offset: Math.max(0, offset - count) };
    }
    if (offset === end) {
      const next = texts[i + 1];
      if (next) return { node: next, offset: 0 };
    }
    count = end;
  }
  return { node: mirror, offset: 0 };
}

/** The text of each laid-out line: `[start, next)` of each, the last to the text's end. */
export function lineTexts(
  text: string,
  lines: readonly { readonly next: number }[],
): readonly string[] {
  if (lines.length === 0) return [text];
  const out: string[] = [];
  let at = 0;
  lines.forEach((line, i) => {
    const end =
      i === lines.length - 1 ? text.length : Math.max(at, Math.min(line.next, text.length));
    out.push(text.slice(at, end));
    at = end;
  });
  return out;
}

/**
 * The mirror's lines for the laid-out `lines` of `text`: each line's band (the bands tile the
 * box, split halfway between the lines' middles), where its drawn glyphs start and end, and
 * their size; `toBox` maps text space to the mirror's box (CSS px). Lines not drawn upright
 * on screen (a rotated page or paragraph) share the box in equal bands across its width.
 */
export function mirrorLines(
  text: string,
  lines: readonly CaretLine[],
  toBox: Affine,
  box: { readonly width: number; readonly height: number },
): MirrorLine[] {
  const texts = lineTexts(text, lines);
  const unit = Math.hypot(toBox[0], toBox[1]);
  const upright =
    Math.abs(toBox[1]) < 1e-6 && Math.abs(toBox[2]) < 1e-6 && toBox[0] > 0 && toBox[3] < 0;
  const middles = lines.map((line) => apply(toBox, { x: 0, y: line.baseline + line.size * 0.3 }).y);
  const ordered = upright && middles.every((y, i) => i === 0 || y >= (middles[i - 1] ?? y));
  const count = texts.length;
  return texts.map((lineText, i) => {
    const line = lines[i];
    const size = (line?.size ?? 0) * unit;
    if (!ordered || !line) {
      const height = box.height / count;
      return { text: lineText, top: height * i, height, left: 0, width: box.width, size };
    }
    const top = i === 0 ? 0 : ((middles[i - 1] ?? 0) + (middles[i] ?? 0)) / 2;
    const bottom = i === count - 1 ? box.height : ((middles[i] ?? 0) + (middles[i + 1] ?? 0)) / 2;
    const x0 = apply(toBox, { x: line.xs[0] ?? 0, y: line.baseline }).x;
    const x1 = apply(toBox, { x: line.xs[line.xs.length - 1] ?? 0, y: line.baseline }).x;
    return {
      text: lineText,
      top,
      height: Math.max(0, bottom - top),
      left: Math.max(0, x0),
      width: Math.max(0, x1 - x0),
      size,
    };
  });
}

/**
 * Keeps the mirror's DOM on `lines`: a `[data-mirror-line]` block per line holding a span with
 * one text node, its text set in place (the nodes stay while the line count does, so the
 * browser's selection and the keyboard's context follow), and anything else (what a
 * composition or the browser left) replaced. Returns whether the text changed.
 */
export function syncMirrorLines(
  mirror: HTMLElement,
  lines: readonly MirrorLine[],
  fontPx: number,
): boolean {
  const doc = mirror.ownerDocument;
  let changed = false;
  const spans: HTMLElement[] = [];
  lines.forEach((line, i) => {
    const present = mirror.childNodes[i];
    let block: HTMLElement;
    if (present instanceof HTMLDivElement && 'mirrorLine' in present.dataset) {
      block = present;
    } else {
      block = doc.createElement('div');
      block.dataset.mirrorLine = '';
      if (present) mirror.replaceChild(block, present);
      else mirror.append(block);
      changed = true;
    }
    const first = block.firstChild;
    let span: HTMLSpanElement;
    if (block.childNodes.length === 1 && first instanceof HTMLSpanElement) {
      span = first;
    } else {
      span = doc.createElement('span');
      block.replaceChildren(span);
      changed = true;
    }
    const node = span.firstChild;
    if (span.childNodes.length === 1 && node instanceof Text) {
      if (node.data !== line.text) {
        node.data = line.text;
        changed = true;
      }
    } else {
      span.replaceChildren(doc.createTextNode(line.text));
      changed = true;
    }
    block.style.height = `${line.height}px`;
    spans.push(span);
  });
  while (mirror.childNodes.length > lines.length) {
    mirror.lastChild?.remove();
    changed = true;
  }
  // Read every natural width first, then write the transforms (one layout).
  const natural = spans.map((span) => span.offsetWidth);
  spans.forEach((span, i) => {
    const line = lines[i];
    if (!line) return;
    const sy = Math.min(1, line.size / fontPx);
    const width = natural[i] ?? 0;
    const sx = width > 0 && line.width > 0 ? line.width / width : sy;
    const lineHeight = fontPx * 1.2;
    const dy = (line.height - lineHeight * sy) / 2;
    span.style.height = `${lineHeight}px`;
    span.style.lineHeight = `${lineHeight}px`;
    span.style.transform = `translate(${line.left}px, ${dy}px) scale(${sx}, ${sy})`;
  });
  return changed;
}

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) out.push(node as Text);
  return out;
}

function nodeLength(node: Node): number {
  return node.nodeType === Node.TEXT_NODE ? (node as Text).data.length : node.childNodes.length;
}
