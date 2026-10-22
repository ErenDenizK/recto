/**
 * Images as pages (ROADMAP M1): PNG, JPEG and WebP files become image pages.
 *
 * - Decoding uses `createImageBitmap` for the pixel size (and to prove the file decodes).
 * - The assembler embeds PNG and JPEG only, so JPEG and PNG bytes pass through untouched
 *   and anything else (WebP) is re-encoded to PNG once, here, before it is stored.
 * - Page size: 1 image pixel = 1 point (72 dpi). "Fit to A4" caps the page width at A4
 *   width, aspect ratio kept; "Original size" keeps 72 dpi as is.
 * - A camera JPEG keeps its bytes and its EXIF orientation (M1-b): its size is the upright one
 *   (`jpegInfo`), and the engine draws it upright (pages and overlays in the assembler, stamps
 *   in the PDFium worker).
 */
import { DEFAULT_PAGE_SIZE, type Size } from '@pdf-editor/document-model';
import { jpegInfo, uprightSize } from '@pdf-editor/engine/images';

import type { StoredBlob } from '../state/workspace-store';
import { isHiddenName, type NamedFile } from './file-filters';

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
]);
// HEIC/HEIF are accepted by name; only a browser that decodes them (WebKit) gets a page, the
// rest reports the file as unreadable like any other undecodable image (PRD-24).
const IMAGE_EXTENSION = /\.(png|jpe?g|webp|heic|heif)$/i;

/** Accept string for pickers and inputs. */
export const IMAGE_ACCEPT =
  'image/png,image/jpeg,image/webp,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.heic,.heif';

export function isImageFile(file: NamedFile): boolean {
  if (isHiddenName(file.name)) return false;
  if (IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  return IMAGE_EXTENSION.test(file.name);
}

/** `fit-paper`: the page is the image fitted inside A4 or Letter (PRD-24). */
export type ImageSizing = 'fit-a4' | 'original' | 'fit-paper';

/** US Letter in points. */
export const LETTER: Size = { width: 612, height: 792 };

/** Regions that use Letter; everywhere else uses A4. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'CL', 'CO', 'VE', 'PH', 'CR', 'GT', 'PA', 'DO']);

/** A4 or Letter for the browser's preferred language tags (`en-US` → Letter, `tr`, `en` → A4). */
export function paperForLocales(tags: readonly string[]): Size {
  const region = (tags[0] ?? '').split('-')[1]?.toUpperCase();
  return region !== undefined && LETTER_REGIONS.has(region) ? LETTER : A4;
}

/** The page size a new document of images uses in this browser. */
export function localPaper(): Size {
  return paperForLocales(typeof navigator === 'undefined' ? [] : navigator.languages);
}

/** The longest side an embedded image keeps (pixels); larger ones are scaled down. */
export const IMAGE_MAX_SIDE = 4000;

/** A4 in points (the model's default page size). */
export const A4: Size = DEFAULT_PAGE_SIZE;

/** Page size in points for an image of `width` × `height` pixels. */
export function imagePageSize(
  width: number,
  height: number,
  sizing: ImageSizing,
  paper: Size = A4,
): Size {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  if (sizing === 'fit-paper') {
    // The paper's box in the image's orientation; the image is scaled to fit inside it.
    const box = w > h ? { width: paper.height, height: paper.width } : paper;
    const scale = Math.min(box.width / w, box.height / h);
    return {
      width: Math.max(1, Math.round(w * scale * 100) / 100),
      height: Math.max(1, Math.round(h * scale * 100) / 100),
    };
  }
  if (sizing === 'original' || w <= A4.width) return { width: w, height: h };
  const scale = A4.width / w;
  return { width: A4.width, height: Math.max(1, Math.round(h * scale * 100) / 100) };
}

/** Whether an image at 72 dpi is larger than an A4 page in either direction. */
export function exceedsA4(width: number, height: number): boolean {
  return width > A4.width || height > A4.height;
}

/** Whether the size question is worth asking (several images, or one larger than A4). */
export function shouldAskImageSizing(images: readonly { width: number; height: number }[]) {
  return images.length > 1 || images.some((image) => exceedsA4(image.width, image.height));
}

/** Sniffs the container from the first bytes; the MIME type of a File can lie. */
export function sniffImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  return undefined;
}

async function encodeBitmap(
  bitmap: ImageBitmap,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  width: number = bitmap.width,
  height: number = bitmap.height,
): Promise<ArrayBuffer> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D context for image conversion');
    context.drawImage(bitmap, 0, 0, width, height);
    return (await canvas.convertToBlob({ type: mime, quality: 0.92 })).arrayBuffer();
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No 2D context for image conversion');
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
  if (!blob) throw new Error('Image conversion failed');
  return blob.arrayBuffer();
}

/**
 * Decodes an image file into what the store keeps: PNG or JPEG bytes and the pixel size.
 * Rejects when the browser cannot decode the file.
 */
export async function decodeImageFile(
  file: File,
  options: { readonly maxSide?: number } = {},
): Promise<StoredBlob> {
  const original = await file.arrayBuffer();
  const bitmap = await createImageBitmap(new Blob([original], { type: file.type }), {
    imageOrientation: 'from-image',
  });
  try {
    const type = sniffImageType(new Uint8Array(original, 0, Math.min(16, original.byteLength)));
    const longest = Math.max(bitmap.width, bitmap.height);
    if (options.maxSide !== undefined && longest > options.maxSide) {
      // Over the cap: scaled down once (the bitmap is already upright), JPEG stays JPEG.
      const scale = options.maxSide / longest;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const mime = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      return {
        bytes: await encodeBitmap(bitmap, mime, width, height),
        type: mime,
        width,
        height,
        name: file.name,
      };
    }
    const bytes = type === undefined ? await encodeBitmap(bitmap) : original;
    // The upright size from the JPEG's own headers: the same in every browser.
    const jpeg = type === 'image/jpeg' ? jpegInfo(new Uint8Array(original)) : undefined;
    const size = jpeg ? uprightSize(jpeg) : { width: bitmap.width, height: bitmap.height };
    return {
      bytes,
      type: type ?? 'image/png',
      width: size.width,
      height: size.height,
      name: file.name,
    };
  } finally {
    bitmap.close();
  }
}
