/** A minimal PNG decoder (8-bit RGB/RGBA/grey, non-interlaced: what Chromium writes). */
import { inflateSync } from 'node:zlib';

export interface Img {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

export function decodePng(buf: Buffer): Img {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let depth = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error('interlaced PNG');
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`PNG depth ${depth}`);
  const ch =
    colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!ch) throw new Error(`PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const i = x * ch;
      if (ch >= 3) {
        out[o] = cur[i];
        out[o + 1] = cur[i + 1];
        out[o + 2] = cur[i + 2];
        out[o + 3] = ch === 4 ? cur[i + 3] : 255;
      } else {
        out[o] = out[o + 1] = out[o + 2] = cur[i];
        out[o + 3] = ch === 2 ? cur[i + 1] : 255;
      }
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data: out };
}

/** Pixels of a CSS-px box at `dpr`, clipped to the image. */
export function boxPixels(
  img: Img,
  box: { x: number; y: number; w: number; h: number },
  dpr: number,
): [number, number, number][] {
  const x0 = Math.max(0, Math.floor(box.x * dpr));
  const y0 = Math.max(0, Math.floor(box.y * dpr));
  const x1 = Math.min(img.width, Math.ceil((box.x + box.w) * dpr));
  const y1 = Math.min(img.height, Math.ceil((box.y + box.h) * dpr));
  const px: [number, number, number][] = [];
  // Subsample large boxes to about 4,000 pixels.
  const area = Math.max(1, (x1 - x0) * (y1 - y0));
  const step = Math.max(1, Math.floor(Math.sqrt(area / 4000)));
  for (let y = y0; y < y1; y += step)
    for (let x = x0; x < x1; x += step) {
      const o = (y * img.width + x) * 4;
      px.push([img.data[o], img.data[o + 1], img.data[o + 2]]);
    }
  return px;
}
