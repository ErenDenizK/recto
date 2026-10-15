/**
 * Backdrops for the glass lab: one tall canvas per stage that the stage scrolls (the DOM sees
 * it) and that T2 uploads as its texture (the GPU sees the same pixels). This mirrors the app,
 * where every page is an ImageBitmap we rendered ourselves (engine/bitmap-cache.ts) and drew into
 * a canvas: the GPU tier can refract that raster instead of snapshotting the DOM.
 *
 * The page images are the English sample (`public/sample/recto-sample-en.pdf`, pages 1–4)
 * rendered at 130 dpi with `pdftoppm` and stored as WebP under `media/` (lab only, never
 * precached): the cover is the dark photograph, pages 2–3 white paper with text, page 4 photos.
 */
import page1 from './media/page-1.webp';
import page2 from './media/page-2.webp';
import page3 from './media/page-3.webp';
import page4 from './media/page-4.webp';

export type BackdropKind = 'cover' | 'paper' | 'photos' | 'gradient';
export type Theme = 'dark' | 'light';

const PAGE_URLS = [page1, page2, page3, page4];
/** Which page leads each backdrop; the rest follow, so scrolling shows every kind. */
const FIRST: Record<Exclude<BackdropKind, 'gradient'>, number> = { cover: 0, paper: 1, photos: 3 };
/** The reader canvas behind pages (tokens.css `--surface-0`, dark and light). */
export const CANVAS: Record<Theme, string> = { dark: '#08090c', light: '#e6e8eb' };
/** Letter at 130 dpi: 1075 × 1521, so a page is 1.415 times as tall as it is wide. */
export const PAGE_RATIO = 1521 / 1075;

let pages: Promise<HTMLImageElement[]> | undefined;

export function loadPages(): Promise<HTMLImageElement[]> {
  pages ??= Promise.all(
    PAGE_URLS.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.decoding = 'async';
          image.onload = () => {
            resolve(image);
          };
          image.onerror = () => {
            reject(new Error(`Could not load ${url}`));
          };
          image.src = url;
        }),
    ),
  );
  return pages;
}

export interface ColumnOptions {
  readonly kind: BackdropKind;
  readonly theme: Theme;
  /** The stage's width, CSS px. */
  readonly width: number;
  /** The stage's height, CSS px (the gradient column is three of them). */
  readonly height: number;
  /** Page width as a share of the stage (1 on a phone, where pages fill the width). */
  readonly pageShare: number;
  readonly gap: number;
  readonly images: readonly HTMLImageElement[];
}

/** Draws the column; the canvas carries its CSS size in `style` and `dataset.scale`. */
export function buildColumn(options: ColumnOptions): HTMLCanvasElement {
  const { kind, theme, width, height, pageShare, gap, images } = options;
  const pageW = Math.round(width * pageShare);
  const pageH = Math.round(pageW * PAGE_RATIO);
  const columnH =
    kind === 'gradient' ? height * 3 : gap + images.length * (pageH + gap) + Math.round(height / 2);
  const scale = Math.min(globalThis.devicePixelRatio || 1, 2, 8000 / columnH);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(columnH * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${columnH}px`;
  canvas.dataset.scale = String(scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.fillStyle = CANVAS[theme];
  ctx.fillRect(0, 0, width, columnH);
  if (kind === 'gradient') {
    drawPhotoGradient(ctx, width, columnH);
    return canvas;
  }
  const first = FIRST[kind];
  const x = Math.round((width - pageW) / 2);
  let y = gap;
  for (let i = 0; i < images.length; i++) {
    const image = images[(first + i) % images.length];
    if (!image) continue;
    ctx.save();
    ctx.shadowColor = theme === 'dark' ? 'rgb(0 0 0 / 0.6)' : 'rgb(20 24 32 / 0.18)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, pageW, pageH);
    ctx.restore();
    ctx.drawImage(image, x, y, pageW, pageH);
    y += pageH + gap;
  }
  return canvas;
}

/** Relative luminance of the column on an 8 px grid, for the adaptive look. */
export interface LumaMap {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly data: Float32Array;
}

export const LUMA_CELL = 8;

/**
 * The column's luminance per 8 × 8 CSS px cell: one small drawImage and one getImageData per
 * column, then every lookup is arithmetic. In the app the same comes from the page bitmaps the
 * viewer already holds (or from the page layout alone: is a white page under the control?).
 */
export function lumaMap(column: HTMLCanvasElement): LumaMap {
  const cssW = Number.parseFloat(column.style.width);
  const cssH = Number.parseFloat(column.style.height);
  const cols = Math.max(1, Math.ceil(cssW / LUMA_CELL));
  const rows = Math.max(1, Math.ceil(cssH / LUMA_CELL));
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const ctx = small.getContext('2d', { willReadFrequently: true });
  const data = new Float32Array(cols * rows);
  if (!ctx) return { cols, rows, cell: LUMA_CELL, data };
  ctx.drawImage(column, 0, 0, cols, rows);
  const pixels = ctx.getImageData(0, 0, cols, rows).data;
  const linear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  for (let i = 0; i < cols * rows; i++) {
    const o = i * 4;
    data[i] =
      0.2126 * linear(pixels[o] ?? 0) +
      0.7152 * linear(pixels[o + 1] ?? 0) +
      0.0722 * linear(pixels[o + 2] ?? 0);
  }
  return { cols, rows, cell: LUMA_CELL, data };
}

/** The median luminance under a box of the column (CSS px), Liquid DOM's adaptive-tint input. */
export function medianLuma(map: LumaMap, x: number, y: number, w: number, h: number): number {
  const c0 = Math.max(0, Math.floor(x / map.cell));
  const r0 = Math.max(0, Math.floor(y / map.cell));
  const c1 = Math.min(map.cols - 1, Math.floor((x + w) / map.cell));
  const r1 = Math.min(map.rows - 1, Math.floor((y + h) / map.cell));
  const values: number[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) values.push(map.data[r * map.cols + c] ?? 0);
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 0;
}

/**
 * A photograph-like field (no asset): a dusk sky, a warm sun, a cool sea and a few bright
 * specks, so refraction and dispersion have strong colour edges to bend.
 */
function drawPhotoGradient(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1b1f4a');
  sky.addColorStop(0.28, '#6b3f8f');
  sky.addColorStop(0.45, '#f08a5d');
  sky.addColorStop(0.52, '#ffd27a');
  sky.addColorStop(0.56, '#2d6f8f');
  sky.addColorStop(0.8, '#0f3a4f');
  sky.addColorStop(1, '#061820');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const blobs: [number, number, number, string][] = [
    [0.7, 0.5, 0.22, 'rgb(255 236 170 / 0.95)'],
    [0.2, 0.18, 0.3, 'rgb(90 200 255 / 0.45)'],
    [0.85, 0.12, 0.25, 'rgb(255 90 160 / 0.4)'],
    [0.3, 0.72, 0.3, 'rgb(40 220 170 / 0.35)'],
    [0.75, 0.88, 0.28, 'rgb(200 251 61 / 0.3)'],
  ];
  for (const [bx, by, br, colour] of blobs) {
    const g = ctx.createRadialGradient(bx * w, by * h, 0, bx * w, by * h, br * Math.max(w, h));
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgb(0 0 0 / 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Horizon glints and a few hard edges (masts, a jetty) for the bezel to bend.
  ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
  for (let i = 0; i < 40; i++) {
    const gx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * w;
    const gy = h * (0.53 + 0.04 * Math.cos(i * 4.1));
    ctx.fillRect(gx, gy, 8 + (i % 5) * 6, 1.5);
  }
  ctx.fillStyle = 'rgb(10 12 20 / 0.9)';
  for (let i = 0; i < 6; i++) {
    const mx = w * (0.12 + i * 0.15);
    ctx.fillRect(mx, h * 0.36, 3, h * 0.17);
  }
  ctx.fillRect(0, h * 0.62, w * 0.55, 10);
}
