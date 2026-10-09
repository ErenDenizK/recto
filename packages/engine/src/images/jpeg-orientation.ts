/**
 * EXIF orientation of camera JPEGs (M1-b, docs/plan/v1/PLAN.md §3.2: "rotate camera JPEGs per
 * EXIF when inserted"). A phone stores a portrait photo as landscape pixels plus an EXIF
 * Orientation tag (TIFF tag 0x0112, values 1–8) that viewers apply. Browsers apply it when they
 * decode (`createImageBitmap`, `<img>`), but a PDF's DCTDecode stream carries no EXIF: the
 * same bytes embedded as they are show sideways (or mirrored).
 *
 * The bytes stay as they are (no re-encode, no quality loss): the assembler draws them through
 * `orientedImageMatrix`, which turns the stored pixels upright on the page, and the app sizes
 * pages by `jpegInfo`'s upright size. Pure, no DOM.
 */

/** EXIF orientation: 1 as stored, 2–8 the mirror and rotation viewers apply. */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface JpegInfo {
  /** Stored pixel size (the SOF header). */
  readonly width: number;
  readonly height: number;
  /** 1 when the file has no EXIF orientation or an invalid one. */
  readonly orientation: ExifOrientation;
}

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/** The orientation in an APP1 Exif segment's TIFF block, or 1. */
function exifOrientation(bytes: Uint8Array, tiff: number, end: number): ExifOrientation {
  if (tiff + 8 > end) return 1;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return 1;
  const u16 = (at: number) =>
    little
      ? (bytes[at] as number) | ((bytes[at + 1] as number) << 8)
      : ((bytes[at] as number) << 8) | (bytes[at + 1] as number);
  const u32 = (at: number) =>
    little ? (u16(at) | (u16(at + 2) << 16)) >>> 0 : ((u16(at) << 16) | u16(at + 2)) >>> 0;
  if (u16(tiff + 2) !== 42) return 1;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    // Orientation: tag 0x0112, type SHORT (3), one value, left-aligned in the value field.
    if (u16(entry) === 0x0112 && u16(entry + 2) === 3) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? (value as ExifOrientation) : 1;
    }
  }
  return 1;
}

/**
 * The stored size and EXIF orientation of a JPEG, read from its headers (up to the first
 * scan); `undefined` when `bytes` is not a JPEG or has no frame header before the scan.
 */
export function jpegInfo(bytes: Uint8Array): JpegInfo | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let orientation: ExifOrientation = 1;
  let at = 2;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return undefined;
    const marker = bytes[at + 1] as number;
    if (marker === 0xff) {
      at++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // no length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return undefined; // end, or the scan: no frame
    const length = ((bytes[at + 2] as number) << 8) | (bytes[at + 3] as number);
    const start = at + 4;
    const end = Math.min(at + 2 + length, bytes.length);
    if (
      marker === 0xe1 &&
      orientation === 1 &&
      bytes[start] === 0x45 && // "Exif\0\0"
      bytes[start + 1] === 0x78 &&
      bytes[start + 2] === 0x69 &&
      bytes[start + 3] === 0x66 &&
      bytes[start + 4] === 0 &&
      bytes[start + 5] === 0
    ) {
      orientation = exifOrientation(bytes, start + 6, end);
    }
    if (SOF_MARKERS.has(marker) && start + 5 <= end) {
      const height = ((bytes[start + 1] as number) << 8) | (bytes[start + 2] as number);
      const width = ((bytes[start + 3] as number) << 8) | (bytes[start + 4] as number);
      return { width, height, orientation };
    }
    at += 2 + length;
  }
  return undefined;
}

/** Whether `orientation` turns the image a quarter (width and height swap). */
export function swapsAxes(orientation: ExifOrientation): boolean {
  return orientation >= 5;
}

/** The size a viewer shows: the stored size, swapped for a quarter turn. */
export function uprightSize(info: JpegInfo): { readonly width: number; readonly height: number } {
  return swapsAxes(info.orientation)
    ? { width: info.height, height: info.width }
    : { width: info.width, height: info.height };
}

/**
 * The PDF `cm` matrix `[a b c d e f]` that draws an image XObject (its unit square, row 0 at the
 * top) upright into the box at (`x`, `y`) of `width` × `height` points (the upright size), for
 * the EXIF `orientation`. Orientation 1 is the usual `[width 0 0 height x y]`.
 */
export function orientedImageMatrix(
  orientation: ExifOrientation,
  x: number,
  y: number,
  width: number,
  height: number,
): readonly [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: // mirrored left to right
      return [-width, 0, 0, height, x + width, y];
    case 3: // turned 180°
      return [-width, 0, 0, -height, x + width, y + height];
    case 4: // mirrored top to bottom
      return [width, 0, 0, -height, x, y + height];
    case 5: // mirrored along the top-left diagonal
      return [0, -height, -width, 0, x + width, y + height];
    case 6: // stored turned a quarter anticlockwise: shown a quarter clockwise
      return [0, -height, width, 0, x, y + height];
    case 7: // mirrored along the top-right diagonal
      return [0, height, width, 0, x, y];
    case 8: // stored turned a quarter clockwise: shown a quarter anticlockwise
      return [0, height, -width, 0, x + width, y];
    default:
      return [width, 0, 0, height, x, y];
  }
}
