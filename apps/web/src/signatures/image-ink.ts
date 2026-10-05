/**
 * A picked image as a signature's ink (components/03-markup.md MK-13 §4): decoded as the Image
 * tool decodes images (PNG and JPEG kept as they are, anything else the browser can read
 * re-encoded to PNG; `files/images.ts`), then made small enough to keep: an image wider than
 * 1600 or taller than 800 px, or one whose data URL would pass the store's limit, is scaled
 * down and re-encoded as PNG, which keeps a transparent background.
 */
import { decodeImageFile } from '../files/images';
import { DATA_URL_MAX, type SignatureInk } from './saved-signatures';

const MAX_WIDTH = 1600;
const MAX_HEIGHT = 800;
/** Base64 grows bytes by 4/3; leave room for the header. */
const BYTES_MAX = Math.floor((DATA_URL_MAX - 64) * 0.75);

function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function scaled(
  bytes: ArrayBuffer,
  type: string,
  width: number,
  height: number,
): Promise<{ bytes: ArrayBuffer; type: string; width: number; height: number }> {
  const fit = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
  if (fit === 1 && bytes.byteLength <= BYTES_MAX) return { bytes, type, width, height };
  const w = Math.max(1, Math.round(width * fit));
  const h = Math.max(1, Math.round(height * fit));
  const bitmap = await createImageBitmap(new Blob([bytes], { type }));
  try {
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext('2d');
    if (!g) throw new Error('No 2D context for the signature image');
    g.drawImage(bitmap, 0, 0, w, h);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { bytes: await blob.arrayBuffer(), type: 'image/png', width: w, height: h };
  } finally {
    bitmap.close();
  }
}

/** The file as image ink; rejects when the browser cannot read it as an image. */
export async function imageInk(file: File): Promise<SignatureInk> {
  const decoded = await decodeImageFile(file);
  const kept = await scaled(decoded.bytes, decoded.type, decoded.width, decoded.height);
  const dataUrl = `data:${kept.type};base64,${base64(new Uint8Array(kept.bytes))}`;
  if (dataUrl.length > DATA_URL_MAX) throw new Error('The signature image is too large');
  return { kind: 'image', dataUrl, width: kept.width, height: kept.height };
}
