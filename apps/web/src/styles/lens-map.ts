/**
 * The lens's map and filter (language.md §2.7; decisions GLS-3, GLS-11; `material-lens.ts` says
 * when a lens is drawn): per size and radius, the rounded rectangle's signed distance, the
 * convex-squircle bezel h(x) = √(1 − (1 − x)⁴) and Snell's law (ior 1.5) give the pull at each
 * pixel, red and green around 128 (the formulas after Liquid DOM, MIT, and Inigo Quilez's SDF,
 * restated). Loaded with the first lens, so its code is in no first closure.
 */
/** A lens's bezel and largest pull, CSS px. */
export interface LensShape {
  readonly bezel: number;
  readonly pull: number;
}
export const CHIP_LENS: LensShape = { bezel: 10, pull: 6 };
export const BAR_LENS: LensShape = { bezel: 14, pull: 10 };
const SVG_NS = 'http://www.w3.org/2000/svg';
const IOR = 1.5;

/** Signed distance from (x, y) to a w × h rounded rectangle of radius r at the origin. */
export function roundRectDistance(x: number, y: number, w: number, h: number, r: number): number {
  const radius = Math.min(r, w / 2, h / 2);
  const qx = Math.abs(x - w / 2) - w / 2 + radius;
  const qy = Math.abs(y - h / 2) - h / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * The pull at `inward` px inside the rim: the slope of h(x) = √(1 − (1 − x)⁴) over the bezel,
 * a ray straight down refracted through it (Snell, ior 1.5) and travelling the bezel's depth,
 * capped at `pull`.
 */
export function snellPull(inward: number, shape: LensShape): number {
  if (inward <= 0 || inward >= shape.bezel) return 0;
  const u = 1 - inward / shape.bezel;
  const slope = Math.min((2 * u ** 3) / Math.sqrt(Math.max(1 - u ** 4, 1e-4)), 11.43);
  const len = Math.hypot(slope, 1);
  const cos = 1 / len;
  const eta = 1 / IOR;
  const k = 1 - eta * eta * (1 - cos * cos);
  if (k < 0) return 0;
  const a = eta * cos - Math.sqrt(k);
  const rx = (a * slope) / len;
  const rz = -eta + a * cos;
  return Math.min(Math.abs((rx / rz) * shape.bezel * 4), shape.pull);
}

/** The displacement map of a w × h box of radius r as a PNG data URL, and its scale (px). */
export function lensMap(
  w: number,
  h: number,
  r: number,
  shape: LensShape,
): { readonly url: string; readonly scale: number } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || w === 0 || h === 0) return { url: '', scale: 0 };
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const largest = Math.max(0.5, shape.pull);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o + 2] = 128;
      data[o + 3] = 255;
      const px = x + 0.5;
      const py = y + 0.5;
      const inward = -roundRectDistance(px, py, w, h, r);
      const amount = snellPull(inward, shape);
      let dx = 0;
      let dy = 0;
      if (amount > 0) {
        const gx =
          roundRectDistance(px + 0.5, py, w, h, r) - roundRectDistance(px - 0.5, py, w, h, r);
        const gy =
          roundRectDistance(px, py + 0.5, w, h, r) - roundRectDistance(px, py - 0.5, w, h, r);
        const len = Math.hypot(gx, gy) || 1;
        // Inward: against the outward gradient, so the rim shows what lies further in.
        dx = (-gx / len) * amount;
        dy = (-gy / len) * amount;
      }
      data[o] = Math.round(128 + (127 * dx) / largest);
      data[o + 1] = Math.round(128 + (127 * dy) / largest);
    }
  }
  ctx.putImageData(image, 0, 0);
  // feDisplacementMap moves by scale × (c / 255 − 0.5): ±largest at c = 128 ± 127.
  return { url: canvas.toDataURL(), scale: (2 * largest * 255) / 254 };
}

/** The hidden `<svg>` that holds every lens filter, made on first use. */
function lensDefs(): SVGDefsElement {
  const existing = document.getElementById('recto-lenses');
  if (existing?.firstElementChild instanceof SVGDefsElement) return existing.firstElementChild;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'recto-lenses';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

const attrs = (node: Element, values: Record<string, string | number>) => {
  for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));
  return node;
};

/** The filter id for a size, radius and shape, drawn once per key. */
export function lensFilter(w: number, h: number, r: number, shape: LensShape = CHIP_LENS): string {
  const id = `lens-${w}x${h}r${Math.round(r)}b${shape.bezel}`;
  if (document.getElementById(id)) return id;
  const { url, scale } = lensMap(w, h, r, shape);
  // The element's border box, origin at its top left, CSS px (research 23 §5.3).
  const filter = attrs(document.createElementNS(SVG_NS, 'filter'), {
    id,
    x: 0,
    y: 0,
    width: w,
    height: h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(
    attrs(document.createElementNS(SVG_NS, 'feImage'), {
      href: url,
      x: 0,
      y: 0,
      width: w,
      height: h,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
    attrs(document.createElementNS(SVG_NS, 'feDisplacementMap'), {
      in: 'SourceGraphic',
      in2: 'map',
      scale: scale.toFixed(2),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );
  lensDefs().append(filter);
  return id;
}

/** The lens's shape for a surface: bars bend wider than chips. */
const shapeOf = (el: HTMLElement): LensShape => (el.matches('.mat-bar') ? BAR_LENS : CHIP_LENS);

/** Draws the lens onto `el` at its size and radius; false where it has no size yet. */
export function lensOn(el: HTMLElement): boolean {
  const width = Math.round(el.offsetWidth);
  const height = Math.round(el.offsetHeight);
  if (width === 0 || height === 0) return false;
  const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  el.style.setProperty('--lens', `url(#${lensFilter(width, height, radius, shapeOf(el))})`);
  el.classList.add('lens');
  return true;
}
