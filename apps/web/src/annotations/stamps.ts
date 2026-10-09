/**
 * Stamp and signature appearances (spec §3). Built-in stamps (Draft, Approved,
 * Confidential) are named stamps; when the engine cannot generate a named stamp's
 * appearance they are drawn here as images. Images are PNG or JPEG (what the engine
 * embeds); anything else is re-encoded to PNG. Signatures are images too: an "image
 * signature", never a digital signature.
 */
import '../styles/fonts.css';

import { decodeImageFile } from '../files/images';
import { m } from '../i18n';
import { traceSmooth } from '../signatures/smooth-ink';
import type { PendingStamp } from './annotation-store';
import { INK } from './palette';

export interface BuiltinStamp {
  /** /Name written to the annotation. */
  readonly name: 'Draft' | 'Approved' | 'Confidential';
  readonly label: () => string;
  readonly color: string;
}

/** Colours from the one palette (craft spec §6): blue, green and red writing inks. */
export const BUILTIN_STAMPS: readonly BuiltinStamp[] = [
  { name: 'Draft', label: m.stamp_draft, color: INK.blue },
  { name: 'Approved', label: m.stamp_approved, color: INK.green },
  { name: 'Confidential', label: m.stamp_confidential, color: INK.red },
];

/** Natural size of a built-in stamp, in points. */
export const BUILTIN_STAMP_SIZE = { width: 150, height: 40 } as const;
/** Pixels per point of drawn stamp and signature images. */
const IMAGE_SCALE = 4;

function canvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
}

/** A built-in stamp drawn as a PNG (fallback when the engine cannot draw named stamps). */
export async function builtinStampImage(name: string): Promise<Blob> {
  const stamp = BUILTIN_STAMPS.find((s) => s.name === name);
  const text = name.toUpperCase();
  const color = stamp?.color ?? INK.red;
  const w = BUILTIN_STAMP_SIZE.width * IMAGE_SCALE;
  const h = BUILTIN_STAMP_SIZE.height * IMAGE_SCALE;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  if (!g) throw new Error('No 2D context for the stamp');
  const line = 3 * IMAGE_SCALE;
  g.strokeStyle = color;
  g.lineWidth = line;
  g.beginPath();
  g.roundRect(line / 2, line / 2, w - line, h - line, 6 * IMAGE_SCALE);
  g.stroke();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 22 * IMAGE_SCALE;
  g.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`;
  while (g.measureText(text).width > w - 16 * IMAGE_SCALE && size > 8) {
    size -= 2;
    g.font = `700 ${size}px Inter, Helvetica, Arial, sans-serif`;
  }
  g.fillText(text, w / 2, h / 2 + IMAGE_SCALE);
  return c.convertToBlob({ type: 'image/png' });
}

/** An image file as a pending stamp (PNG or JPEG, pixel size for the aspect ratio). */
export async function imageStamp(file: File, kind: 'image' | 'signature'): Promise<PendingStamp> {
  const decoded = await decodeImageFile(file);
  return {
    kind,
    blob: new Blob([decoded.bytes], { type: decoded.type }),
    width: decoded.width,
    height: decoded.height,
  };
}

export function builtinPendingStamp(name: BuiltinStamp['name']): PendingStamp {
  return { kind: 'builtin', name, ...BUILTIN_STAMP_SIZE };
}

/**
 * The family a typed signature is drawn in: Inter's true italic at 300 under its own name
 * (`styles/fonts.css`, cut by `tools/fonts/subset.sh`; MK-13 §6, no script font is bundled),
 * then the UI face, so the placed image matches New signature's preview and the plates (`signatures/SignaturePlate.tsx`).
 */
export const TYPED_SIGNATURE_FONT =
  "'Recto Signature', 'Inter Recto', 'Inter Recto Fallback', Helvetica, Arial, sans-serif";
/** A typed signature's size in points. */
export const TYPED_SIGNATURE_SIZE = 36;
/**
 * Its weight: light, so the italic reads as a pen's line rather than as bold type (a signature
 * is ink on the page, not interface text, so the UI's 400 · 500 · 600 does not bind it).
 */
export const TYPED_SIGNATURE_WEIGHT = 300;

/** The CSS / canvas font of a typed signature at `size` pixels. */
export function typedSignatureFont(size: number): string {
  return `italic ${TYPED_SIGNATURE_WEIGHT} ${size}px ${TYPED_SIGNATURE_FONT}`;
}

let signatureFont: Promise<unknown> | null = null;

/**
 * Loads the typed signature's face once (a face with a `unicode-range` loads on first use), so
 * a measure or a drawing does not fall back to another face. Resolves whether or not it loaded:
 * the fallback still draws a signature.
 */
export function loadSignatureFont(): Promise<unknown> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  signatureFont ??= document.fonts
    .load(typedSignatureFont(TYPED_SIGNATURE_SIZE), 'AaÇçĞğİıŞş')
    .catch(() => undefined);
  return signatureFont;
}

/** A typed signature drawn in the signature face (Inter's italic, no script font; spec §3). */
export async function typedSignature(text: string, color = '#1A237E'): Promise<PendingStamp> {
  await loadSignatureFont();
  const size = TYPED_SIGNATURE_SIZE * IMAGE_SCALE;
  const font = typedSignatureFont(size);
  const probe = canvas(1, 1).getContext('2d');
  if (!probe) throw new Error('No 2D context for the signature');
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + 16 * IMAGE_SCALE;
  const height = Math.round(size * 1.5);
  const c = canvas(width, height);
  const g = c.getContext('2d');
  if (!g) throw new Error('No 2D context for the signature');
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 8 * IMAGE_SCALE, height / 2);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return { kind: 'signature', blob, width, height };
}

/** Strokes drawn on the signature pad (pad pixels), cropped to their bounds. */
export async function drawnSignature(
  strokes: readonly (readonly { x: number; y: number }[])[],
  color = '#1A237E',
  lineWidth = 2.5,
): Promise<PendingStamp | undefined> {
  const points = strokes.flat();
  if (points.length === 0) return undefined;
  const pad = lineWidth * 2;
  const minX = Math.min(...points.map((p) => p.x)) - pad;
  const minY = Math.min(...points.map((p) => p.y)) - pad;
  const maxX = Math.max(...points.map((p) => p.x)) + pad;
  const maxY = Math.max(...points.map((p) => p.y)) + pad;
  const scale = IMAGE_SCALE / 2;
  const c = canvas((maxX - minX) * scale, (maxY - minY) * scale);
  const g = c.getContext('2d');
  if (!g) throw new Error('No 2D context for the signature');
  g.scale(scale, scale);
  g.translate(-minX, -minY);
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // Traced as the pad and the plate draw it (`signatures/smooth-ink.ts`).
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    g.beginPath();
    traceSmooth(g, stroke);
    g.stroke();
  }
  const blob = await c.convertToBlob({ type: 'image/png' });
  return { kind: 'signature', blob, width: c.width, height: c.height };
}

/**
 * Size in points for a stamp placed by a click: images at 72 dpi capped to 200 pt wide
 * (signatures to 180 pt), keeping the aspect ratio.
 */
export function naturalStampSize(stamp: PendingStamp): { width: number; height: number } {
  if (stamp.kind === 'builtin') return { width: stamp.width, height: stamp.height };
  const max = stamp.kind === 'signature' ? 180 : 200;
  const ratio = stamp.height / Math.max(1, stamp.width);
  const width = Math.min(max, Math.max(24, stamp.width / (stamp.kind === 'signature' ? 2 : 1)));
  return { width, height: Math.max(8, width * ratio) };
}
