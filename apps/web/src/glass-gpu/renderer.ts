/**
 * GPU glass, the renderer (decisions GLS-7, GLS-12…GLS-15; research 23 §5.4; the lab's T2,
 * `lab/glass/t2-gl.ts`, is its starting point). Its own chunk: `index.ts` fetches it once the
 * reader is idle, only on a device that passes.
 *
 * - **One canvas** (GLS-12), `position: fixed` over the viewport at a DPR of at most 2, inside
 *   the reader above the pages and under the chrome (z-index 1 against the chrome's 2),
 *   `pointer-events: none`, `aria-hidden`. Each draw clears it and shades only the pieces:
 *   one scissored triangle per piece (its box + 1 px), the scroll edge first.
 * - **The backdrop** is the page raster: each page canvas (`PageCanvas`) under a piece is a
 *   texture, uploaded when its bitmap changes (its size, `data-state`, `data-bucket`,
 *   `data-revision`), never per frame, with mips for the blur. Its on-screen box maps it, so
 *   scroll, zoom and a pinch's transform need no mapping of their own.
 * - **Draw on change** (GLS-5): a draw happens in an animation frame after something that can
 *   move glass or what is under it (scroll, touch, a transition or animation starting, a DOM or
 *   attribute change in the reader, a resize, a theme change), and only when the scene's
 *   signature (boxes, opacities, bitmaps) differs from the last drawn; a few still frames end
 *   the loop. Nothing runs at rest.
 * - **The material** is read from each piece's own CSS (its tint, the tier's backdrop filter,
 *   the solid twin and text colour; the edge's gradient and mask) with `gpu-glass` off, once
 *   and again on a theme change, so the GPU draws the same recipe CSS+ does and the contrast
 *   proofs carry over; the legibility floor (GLS-14) holds text over any page. A piece gets
 *   `gpu-glass` (its own fill and backdrop off) in the frame its glass is first drawn, so no
 *   frame shows neither.
 * - **Fallback** (GLS-13): a lost context, a shader or program that does not compile, a page
 *   bitmap larger than the GPU's texture size, a throw while drawing, or slow frames (over half
 *   the frames of a 2 s drawing window above 33 ms; not under the test override) end GPU glass
 *   for the session: the pieces get their CSS back and the canvas goes, silently; with the
 *   stats flag (`?glassstats=1`, or `localStorage['pdf-editor:dev:glass-stats'] = '1'`, or a
 *   development build) the reason is logged once and `window.__gpuGlass` shows the counters.
 */
import { useRenderQualityStore } from '../state/render-quality';
import {
  type Box,
  glassDpr,
  gradientAt,
  legibilityBound,
  luminance,
  NEUTRAL_FILTER,
  overlaps,
  type FilterRecipe,
  pagesUnder,
  parseCssColor,
  parseFilter,
  parseVerticalGradient,
  pieceShape,
  type Rgba,
  scissorFor,
} from './geometry';
import {
  GPU_GLASS_ATTRIBUTE,
  type GpuGlassHandle,
  type GpuGlassOptions,
  type GpuGlassShape,
  markGpuGlassFailed,
  onRegistered,
  registeredPieces,
} from './index';
import { EDGE, EDGE_RAMP, GLASS, MAX_PAGES, VERTEX } from './shaders';

/** The class that hands a piece's material to the GPU (its own fill and backdrop off). */
export const GPU_GLASS_CLASS = 'gpu-glass';
const STYLE_ID = 'gpu-glass-style';
/** A piece whose glass steps aside while it moves with another as one body (GLS-19, MOT-14). */
const LIQUID_ATTRIBUTE = 'data-liquid';
/** The GPU draws the fill and the rim light (`--mat-rim`, GLS-22); the edge, inner light and shadow stay CSS. */
const STYLE = `.${GPU_GLASS_CLASS}.${GPU_GLASS_CLASS}{background:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;border-color:transparent!important;--mat-rim:0 0 #0000!important}`;

/** Optics (GLS-3, research 23 §8 row 5): bezel ≤ 16 px, pull ≤ 12 px, slight dispersion. */
export const OPTICS = {
  bezel: 16,
  ior: 1.5,
  depth: 60,
  maxPull: 12,
  chroma: 0.2,
  spec: 0.7,
  /** The rim light's band, CSS px: full at the edge, gone by its end (GLS-22; was 1.25, hard). */
  specWidth: 2.5,
  /** The light, radians from up, negative to the left (−45°: the top left). */
  light: (-45 * Math.PI) / 180,
} as const;

/**
 * GPU glass blurs at this share of the piece's CSS σ (GLS-18): the refraction and the rim
 * already part the glass from the page, so it can show the page a little clearer than CSS+
 * does, closer to iOS; the legibility floor (GLS-14) mixes towards the solid twin per pixel, so
 * text holds over any page whatever the blur.
 */
export const GPU_SIGMA_SCALE = 0.8;

/** Still frames after which the draw loop ends. */
const QUIET_FRAMES = 4;
/** The slow-frame rule (GLS-13): a 2 s window of drawing, more than half above 33 ms. */
const SLOW_WINDOW_MS = 2000;
const SLOW_FRAME_MS = 33;
const SLOW_SHARE = 0.5;
/** Textures kept for canvases not drawn under glass lately, at most. */
const SPARE_TEXTURES = 4;

const STATS_STORAGE_KEY = 'pdf-editor:dev:glass-stats';
const STATS_QUERY = 'glassstats';
const TEST_BUILD: boolean =
  import.meta.env.DEV || import.meta.env.MODE === 'test' || __RENDER_OVERRIDE__;

function statsFlag(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (new URLSearchParams(window.location.search).get(STATS_QUERY) === '1') return true;
    return window.localStorage.getItem(STATS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Under the test override GPU glass runs on a software renderer: no slow-frame fallback. */
const forced = (): boolean =>
  TEST_BUILD && (window as { __rectoGpuGlass?: string }).__rectoGpuGlass === 'force';

/** What `window.__gpuGlass` shows (stats flag or test builds). */
export interface GpuGlassStats {
  state: 'on' | 'paused' | 'off' | 'failed';
  reason: string;
  draws: number;
  uploads: number;
  /** Main-thread time of the last draw, ms. */
  lastDrawMs: number;
  /** Pieces drawn by the last draw. */
  pieces: number;
  renderer: string;
  loseContext(): void;
}

class GlassFailure extends Error {}

interface Material {
  readonly tint: Rgba;
  readonly solid: Rgba;
  readonly filter: FilterRecipe;
  /** The legibility floor: luminance bound, text is light. */
  readonly floor: readonly [number, boolean];
  readonly radius: number;
  /** The edge's tint ramp (rgba per sample) and mask ramp. */
  readonly ramp?: Float32Array;
  readonly mask?: Float32Array;
}

interface Piece {
  readonly el: HTMLElement;
  readonly options: GpuGlassOptions;
  material: Material | null;
}

interface PlacedPiece {
  readonly piece: Piece;
  readonly box: Box;
  readonly opacity: number;
  /** Box width over layout width (a press scale). */
  readonly scale: number;
}

interface PlacedPage {
  readonly box: Box;
  readonly canvas: HTMLCanvasElement | null;
  readonly key: string;
}

interface PageTexture {
  readonly tex: WebGLTexture;
  readonly width: number;
  readonly height: number;
  key: string;
  lastUsed: number;
}

const shapeOf = (value: string | null): GpuGlassShape | null =>
  value === 'capsule' || value === 'circle' || value === 'rect' || value === 'edge' ? value : null;

/** A CSS colour value resolved by the engine inside `host` (custom properties included). */
function resolveColor(host: Element, value: string): Rgba | null {
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;width:0;height:0;visibility:hidden;background-color:${value}`;
  host.append(probe);
  const color = parseCssColor(getComputedStyle(probe).backgroundColor);
  probe.remove();
  return color;
}

function ramp(stops: ReturnType<typeof parseVerticalGradient>, height: number, alphaOnly: boolean) {
  const out = new Float32Array(alphaOnly ? EDGE_RAMP : EDGE_RAMP * 4);
  for (let i = 0; i < EDGE_RAMP; i++) {
    const y = (i / (EDGE_RAMP - 1)) * height;
    const color = stops ? gradientAt(stops, y) : ([0, 0, 0, 1] as Rgba);
    if (alphaOnly) out[i] = color[3];
    else out.set(color, i * 4);
  }
  return out;
}

/** Reads a piece's material from its own CSS (`gpu-glass` must be off). */
function readMaterial(el: HTMLElement, options: GpuGlassOptions): Material | null {
  const style = getComputedStyle(el);
  const filter = parseFilter(
    style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
  );
  if (options.shape === 'edge') {
    const height = el.getBoundingClientRect().height;
    const tint = parseVerticalGradient(style.backgroundImage, height);
    const maskImage = style.maskImage || style.getPropertyValue('-webkit-mask-image');
    const mask =
      maskImage === '' || maskImage === 'none' ? null : parseVerticalGradient(maskImage, height);
    // A gradient this cannot read stays on CSS rather than drawn wrong.
    if (!tint || (maskImage !== '' && maskImage !== 'none' && !mask)) return null;
    return {
      tint: [0, 0, 0, 0],
      solid: [0, 0, 0, 1],
      filter,
      floor: [1, true],
      radius: 0,
      ramp: ramp(tint, height, false),
      mask: ramp(mask, height, true),
    };
  }
  const tint = parseCssColor(style.backgroundColor);
  if (!tint) return null;
  const solid = resolveColor(el, 'var(--mat-solid)') ?? ([tint[0], tint[1], tint[2], 1] as Rgba);
  const text = parseCssColor(style.color) ?? [1, 1, 1, 1];
  const [bound, light] = legibilityBound(luminance(text), options.tone === 'icon' ? 3 : 4.5);
  const radius = options.radius ?? (Number.parseFloat(style.borderTopLeftRadius) || 0);
  return {
    tint,
    solid,
    filter: filter.blur > 0 ? filter : { ...NEUTRAL_FILTER, blur: 0 },
    floor: [bound, light],
    radius,
  };
}

function compile(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new GlassFailure('shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      throw new GlassFailure(`shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
    }
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new GlassFailure(`program: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
  }
  return program;
}

/** The page canvas of a page box (`PageCanvas`), never a tile's or a cross-fade's ghost. */
function pageCanvas(page: Element): HTMLCanvasElement | null {
  for (const canvas of page.querySelectorAll<HTMLCanvasElement>('canvas[data-state]')) {
    if (!canvas.closest('[data-testid="page-tiles"]')) return canvas;
  }
  return null;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Starts GPU glass over `root`; returns its handle, or a stopped one when WebGL2 fails at once
 * (the session then stays on CSS+).
 */
export function startGpuGlass(root: HTMLElement, startPaused: boolean): GpuGlassHandle {
  const stats: GpuGlassStats = {
    state: 'off',
    reason: '',
    draws: 0,
    uploads: 0,
    lastDrawMs: 0,
    pieces: 0,
    renderer: '',
    loseContext: () => gl?.getExtension('WEBGL_lose_context')?.loseContext(),
  };
  const showStats = statsFlag();
  if (TEST_BUILD || showStats) (window as { __gpuGlass?: GpuGlassStats }).__gpuGlass = stats;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.testid = 'gpu-glass-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;';
  let gl: WebGL2RenderingContext | null = null;
  let glass: WebGLProgram | null = null;
  let edge: WebGLProgram | null = null;
  let blank: WebGLTexture | null = null;
  let maxTexture = 0;
  const uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  const textures = new Map<HTMLCanvasElement, PageTexture>();
  const pieces = new Map<HTMLElement, Piece>();
  let paused = startPaused;
  let stopped = false;
  let raf = 0;
  let quiet = 0;
  let signature = '';
  let lastFrame = 0;
  let window2s: number[] = [];
  let colors: { bg: Rgba; paper: Rgba } | null = null;
  const cleanups: (() => void)[] = [];

  const fail = (reason: string) => {
    if (stopped) return;
    markGpuGlassFailed();
    stats.state = 'failed';
    stats.reason = reason;
    if (showStats) console.warn(`[gpu-glass] CSS+ for this session: ${reason}`);
    teardown();
  };

  const teardown = () => {
    stopped = true;
    if (raf !== 0) cancelAnimationFrame(raf);
    raf = 0;
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
    for (const el of pieces.keys()) el.classList.remove(GPU_GLASS_CLASS);
    pieces.clear();
    canvas.removeEventListener('webglcontextlost', onLost);
    if (gl && !gl.isContextLost()) {
      for (const texture of textures.values()) gl.deleteTexture(texture.tex);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    textures.clear();
    canvas.remove();
  };

  const onLost = (event: Event) => {
    event.preventDefault();
    fail('context lost');
  };

  const handle: GpuGlassHandle = {
    setPaused(next) {
      if (stopped || next === paused) return;
      paused = next;
      if (paused) {
        if (raf !== 0) cancelAnimationFrame(raf);
        raf = 0;
        for (const el of pieces.keys()) el.classList.remove(GPU_GLASS_CLASS);
        canvas.style.visibility = 'hidden';
        signature = '';
        stats.state = 'paused';
      } else {
        stats.state = 'on';
        kick();
      }
    },
    stop() {
      if (stopped) return;
      stats.state = 'off';
      teardown();
    },
  };

  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) throw new GlassFailure('no WebGL2 context');
    canvas.addEventListener('webglcontextlost', onLost);
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    stats.renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
    );
    glass = compile(gl, GLASS);
    edge = compile(gl, EDGE);
    maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 4096;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blank);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  } catch (error) {
    fail(error instanceof GlassFailure ? error.message : String(error));
    return handle;
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.append(style);
  }
  root.append(canvas);
  stats.state = paused ? 'paused' : 'on';
  if (paused) canvas.style.visibility = 'hidden';

  const uniform = (program: WebGLProgram, name: string): WebGLUniformLocation | null => {
    let table = uniforms.get(program);
    if (!table) {
      table = new Map();
      uniforms.set(program, table);
    }
    if (!table.has(name)) table.set(name, gl.getUniformLocation(program, name));
    return table.get(name) ?? null;
  };

  /** Reads every piece's material with `gpu-glass` off (no frame is painted in between). */
  const readMaterials = (only?: Piece) => {
    const list = only ? [only] : [...pieces.values()];
    const had = list.filter((piece) => piece.el.classList.contains(GPU_GLASS_CLASS));
    for (const piece of had) piece.el.classList.remove(GPU_GLASS_CLASS);
    for (const piece of list) piece.material = readMaterial(piece.el, piece.options);
    for (const piece of had) piece.el.classList.add(GPU_GLASS_CLASS);
    colors = null;
    blockUnderCssEdges();
  };

  /**
   * A piece under a scroll edge whose gradient could not be read (an engine serialising it
   * otherwise) stays CSS+: that edge stays CSS, above the canvas, and would blur and tint it.
   */
  const blockUnderCssEdges = () => {
    for (const band of pieces.values()) {
      if (band.options.shape !== 'edge' || band.material) continue;
      const box = band.el.getBoundingClientRect();
      for (const piece of pieces.values()) {
        if (piece.options.shape === 'edge' || !overlaps(box, piece.el.getBoundingClientRect())) {
          continue;
        }
        piece.material = null;
        piece.el.classList.remove(GPU_GLASS_CLASS);
      }
    }
  };

  /** The pieces: the attribute's in the root and those registered from script. */
  const collect = () => {
    const found = new Map<HTMLElement, GpuGlassOptions>();
    for (const el of root.querySelectorAll<HTMLElement>(`[${GPU_GLASS_ATTRIBUTE}]`)) {
      const shape = shapeOf(el.getAttribute(GPU_GLASS_ATTRIBUTE));
      if (shape) found.set(el, { shape, tone: shape === 'circle' ? 'icon' : 'text' });
    }
    for (const [el, options] of registeredPieces()) if (el.isConnected) found.set(el, options);
    for (const [el] of pieces) {
      if (!found.has(el)) {
        el.classList.remove(GPU_GLASS_CLASS);
        pieces.delete(el);
      }
    }
    for (const [el, options] of found) {
      const known = pieces.get(el);
      if (known?.options.shape === options.shape) continue;
      const piece: Piece = { el, options, material: null };
      pieces.set(el, piece);
      readMaterials(piece);
    }
  };

  const backdropColors = () => {
    if (colors) return colors;
    const page = root.querySelector('[data-page-index]');
    colors = {
      bg: resolveColor(root, 'var(--canvas)') ?? [0, 0, 0, 1],
      paper: (page && parseCssColor(getComputedStyle(page).backgroundColor)) ?? [1, 1, 1, 1],
    };
    return colors;
  };

  /** Where everything is this frame, and the scene's signature. */
  const measure = () => {
    const placed: PlacedPiece[] = [];
    const parts: (string | number)[] = [];
    for (const piece of pieces.values()) {
      const { el } = piece;
      if (!el.isConnected || !piece.material) continue;
      // A piece fused with another while it moves (`data-liquid`, the capsule and ✎ as one
      // body, GLS-19) is CSS+ for that run: the solid body under the pair draws it.
      if (el.hasAttribute(LIQUID_ATTRIBUTE)) {
        el.classList.remove(GPU_GLASS_CLASS);
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = getComputedStyle(el);
      const opacity = style.visibility === 'hidden' ? 0 : Number.parseFloat(style.opacity);
      if (!(opacity > 0.004)) continue;
      const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
      placed.push({ piece, box, opacity, scale });
      parts.push(
        round(box.left),
        round(box.top),
        round(box.width),
        round(box.height),
        round(opacity),
      );
    }
    const pages: PlacedPage[] = [];
    const reach = OPTICS.maxPull + 32;
    if (placed.length > 0) {
      for (const page of root.querySelectorAll<HTMLElement>('[data-page-index]')) {
        const rect = page.getBoundingClientRect();
        const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        if (!placed.some((p) => overlaps(p.box, box, reach))) continue;
        const pc = pageCanvas(page);
        const shown = pc && pc.width > 0 && pc.height > 0 ? pc : null;
        const key = shown
          ? `${shown.width}x${shown.height}:${shown.dataset.state}:${shown.dataset.bucket}:${shown.dataset.revision}`
          : '';
        // The bitmap's own box (a resized page's content box sits inside the page).
        const canvasRect = shown?.getBoundingClientRect();
        pages.push({
          box: canvasRect
            ? {
                left: canvasRect.left,
                top: canvasRect.top,
                width: canvasRect.width,
                height: canvasRect.height,
              }
            : box,
          canvas: shown,
          key,
        });
        parts.push(round(box.left), round(box.top), round(box.width), round(box.height), key);
      }
    }
    parts.push(window.innerWidth, window.innerHeight);
    return { placed, pages, signature: parts.join(',') };
  };

  const textureFor = (page: PlacedPage, frame: number): PageTexture | null => {
    const source = page.canvas;
    const context = gl;
    if (!source) return null;
    let texture = textures.get(source);
    if (texture?.key === page.key) {
      texture.lastUsed = frame;
      return texture;
    }
    if (source.width > maxTexture || source.height > maxTexture) {
      throw new GlassFailure('texture too large');
    }
    if (texture?.width !== source.width || texture.height !== source.height) {
      if (texture) context.deleteTexture(texture.tex);
      const tex = context.createTexture();
      context.bindTexture(context.TEXTURE_2D, tex);
      const levels = Math.floor(Math.log2(Math.max(source.width, source.height))) + 1;
      context.texStorage2D(context.TEXTURE_2D, levels, context.RGBA8, source.width, source.height);
      context.texParameteri(
        context.TEXTURE_2D,
        context.TEXTURE_MIN_FILTER,
        context.LINEAR_MIPMAP_LINEAR,
      );
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
      texture = { tex, width: source.width, height: source.height, key: '', lastUsed: frame };
      textures.set(source, texture);
    }
    context.bindTexture(context.TEXTURE_2D, texture.tex);
    context.texSubImage2D(context.TEXTURE_2D, 0, 0, 0, context.RGBA, context.UNSIGNED_BYTE, source);
    context.generateMipmap(context.TEXTURE_2D);
    texture.key = page.key;
    texture.lastUsed = frame;
    stats.uploads++;
    return texture;
  };

  /** Binds the pages under `box` to units 0–3 and sets the backdrop's uniforms. */
  const bindPages = (
    program: WebGLProgram,
    box: Box,
    sigma: number,
    pages: PlacedPage[],
    frame: number,
  ) => {
    const context = gl;
    const under = pagesUnder(box, pages, OPTICS.maxPull + 3 * sigma + 2, MAX_PAGES);
    const rects = new Float32Array(MAX_PAGES * 4);
    const infos = new Float32Array(MAX_PAGES * 4);
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = under[i];
      const texture = page ? textureFor(page, frame) : null;
      context.activeTexture(context.TEXTURE0 + i);
      context.bindTexture(context.TEXTURE_2D, texture?.tex ?? blank);
      context.uniform1i(uniform(program, `u_p${i}`), i);
      if (!page) continue;
      rects.set([page.box.left, page.box.top, page.box.width, page.box.height], i * 4);
      infos.set(
        texture
          ? [1, texture.width / Math.max(1, page.box.width), texture.width, texture.height]
          : [0, 1, 1, 1],
        i * 4,
      );
    }
    context.uniform1i(uniform(program, 'u_pageCount'), under.length);
    context.uniform4fv(uniform(program, 'u_page'), rects);
    context.uniform4fv(uniform(program, 'u_pageInfo'), infos);
  };

  const draw = (scene: ReturnType<typeof measure>, frame: number) => {
    const context = gl;
    const started = performance.now();
    const dpr = glassDpr(window.devicePixelRatio);
    const cssWidth = canvas.clientWidth || window.innerWidth;
    const cssHeight = canvas.clientHeight || window.innerHeight;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const { bg, paper } = backdropColors();
    context.bindFramebuffer(context.FRAMEBUFFER, null);
    context.viewport(0, 0, width, height);
    context.disable(context.SCISSOR_TEST);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
    context.enable(context.SCISSOR_TEST);
    // Premultiplied "over": a piece's quad keeps what the edge drew around its shape.
    context.enable(context.BLEND);
    context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
    const common = (program: WebGLProgram) => {
      context.useProgram(program);
      context.uniform2f(uniform(program, 'u_canvas'), width, height);
      context.uniform1f(uniform(program, 'u_dpr'), width / cssWidth);
      context.uniform3f(uniform(program, 'u_bg'), bg[0], bg[1], bg[2]);
      context.uniform3f(uniform(program, 'u_paper'), paper[0], paper[1], paper[2]);
    };
    const edgeUniforms = (program: WebGLProgram, placed: PlacedPiece | undefined) => {
      const material = placed?.piece.material;
      context.uniform1f(uniform(program, 'u_edgeOn'), material?.ramp ? 1 : 0);
      if (!placed || !material?.ramp || !material.mask) return;
      const { box } = placed;
      context.uniform4f(uniform(program, 'u_edgeBox'), box.left, box.top, box.width, box.height);
      context.uniform4fv(uniform(program, 'u_ramp'), material.ramp);
      context.uniform1fv(uniform(program, 'u_mask'), material.mask);
      context.uniform1f(uniform(program, 'u_edgeSigma'), material.filter.blur);
    };
    const edges = scene.placed.filter((p) => p.piece.options.shape === 'edge');
    const bodies = scene.placed.filter((p) => p.piece.options.shape !== 'edge');
    const topEdge = edges[0];
    if (edge) {
      for (const placed of edges) {
        const scissor = scissorFor(placed.box, 0, width / cssWidth, width, height);
        if (!scissor) continue;
        common(edge);
        const { material } = placed.piece;
        if (!material) continue;
        bindPages(edge, placed.box, material.filter.blur, scene.pages, frame);
        edgeUniforms(edge, placed);
        context.uniform1f(uniform(edge, 'u_sigma'), material.filter.blur);
        context.uniform1f(uniform(edge, 'u_opacity'), placed.opacity);
        context.scissor(scissor.x, scissor.y, scissor.width, scissor.height);
        context.drawArrays(context.TRIANGLES, 0, 3);
      }
    }
    if (glass && bodies.length > 0) {
      common(glass);
      const program = glass;
      context.uniform1f(uniform(program, 'u_ior'), OPTICS.ior);
      context.uniform1f(uniform(program, 'u_depth'), OPTICS.depth);
      context.uniform1f(uniform(program, 'u_chroma'), OPTICS.chroma);
      context.uniform1f(uniform(program, 'u_maxPull'), OPTICS.maxPull);
      context.uniform1f(uniform(program, 'u_spec'), OPTICS.spec);
      context.uniform1f(uniform(program, 'u_specWidth'), OPTICS.specWidth);
      context.uniform2f(
        uniform(program, 'u_light'),
        Math.sin(OPTICS.light),
        -Math.cos(OPTICS.light),
      );
      for (const placed of bodies) {
        const material = placed.piece.material;
        if (!material) continue;
        const scissor = scissorFor(placed.box, 1, width / cssWidth, width, height);
        if (!scissor) continue;
        const shape = pieceShape(placed.box, material.radius, placed.scale);
        const sigma = material.filter.blur * GPU_SIGMA_SCALE * placed.scale;
        bindPages(program, placed.box, sigma, scene.pages, frame);
        edgeUniforms(program, topEdge && overlaps(placed.box, topEdge.box) ? topEdge : undefined);
        context.uniform4f(uniform(program, 'u_rect'), shape.cx, shape.cy, shape.hw, shape.hh);
        context.uniform1f(uniform(program, 'u_radius'), shape.radius);
        context.uniform1f(
          uniform(program, 'u_bezel'),
          Math.min(OPTICS.bezel, Math.min(shape.hw, shape.hh) * 0.75),
        );
        context.uniform1f(uniform(program, 'u_sigma'), sigma);
        const { filter, tint, solid, floor } = material;
        context.uniform3f(
          uniform(program, 'u_filter'),
          filter.saturate,
          filter.contrast,
          filter.brightness,
        );
        context.uniform4f(uniform(program, 'u_tint'), tint[0], tint[1], tint[2], tint[3]);
        context.uniform3f(uniform(program, 'u_solid'), solid[0], solid[1], solid[2]);
        context.uniform2f(uniform(program, 'u_floor'), floor[0], floor[1] ? 1 : 0);
        context.uniform1f(uniform(program, 'u_opacity'), placed.opacity);
        context.scissor(scissor.x, scissor.y, scissor.width, scissor.height);
        context.drawArrays(context.TRIANGLES, 0, 3);
      }
    }
    // Spare textures: drop those of canvases gone or long unused.
    if (textures.size > MAX_PAGES + SPARE_TEXTURES) {
      const old = [...textures].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [source, texture] of old.slice(0, textures.size - MAX_PAGES - SPARE_TEXTURES)) {
        context.deleteTexture(texture.tex);
        textures.delete(source);
      }
    }
    for (const [source, texture] of textures) {
      if (!source.isConnected) {
        context.deleteTexture(texture.tex);
        textures.delete(source);
      }
    }
    // The pieces drop their own CSS in the frame their GPU glass first shows.
    if (canvas.style.visibility !== '') canvas.style.visibility = '';
    for (const { piece } of scene.placed) piece.el.classList.add(GPU_GLASS_CLASS);
    for (const piece of pieces.values()) {
      if (piece.material && !piece.el.hasAttribute(LIQUID_ATTRIBUTE)) {
        piece.el.classList.add(GPU_GLASS_CLASS);
      }
    }
    stats.draws++;
    stats.pieces = scene.placed.length;
    stats.lastDrawMs = performance.now() - started;
  };

  let frames = 0;
  const frame = (now: number) => {
    raf = 0;
    if (stopped || paused) return;
    frames++;
    try {
      const scene = measure();
      if (scene.signature !== signature) {
        draw(scene, frames);
        signature = scene.signature;
        quiet = 0;
        // The slow-frame rule, over frames drawn back to back.
        if (lastFrame > 0 && !forced()) {
          window2s.push(now - lastFrame);
          let total = 0;
          for (const interval of window2s) total += interval;
          if (total >= SLOW_WINDOW_MS) {
            const slow = window2s.filter((interval) => interval > SLOW_FRAME_MS).length;
            if (slow / window2s.length > SLOW_SHARE) {
              fail('slow frames');
              return;
            }
            window2s = [];
          }
        }
        lastFrame = now;
      } else {
        quiet++;
        lastFrame = 0;
      }
    } catch (error) {
      fail(error instanceof GlassFailure ? error.message : `draw: ${String(error)}`);
      return;
    }
    if (quiet < QUIET_FRAMES) raf = requestAnimationFrame(frame);
  };

  function kick(): void {
    quiet = 0;
    if (raf === 0 && !paused && !stopped) raf = requestAnimationFrame(frame);
  }

  // What can move glass or what lies under it.
  const listen = (target: EventTarget, type: string) => {
    const options: AddEventListenerOptions = { capture: true, passive: true };
    target.addEventListener(type, kick, options);
    cleanups.push(() => target.removeEventListener(type, kick, options));
  };
  for (const type of [
    'scroll',
    'touchstart',
    'touchmove',
    'touchend',
    'wheel',
    'transitionrun',
    'transitionstart',
    'transitionend',
    'animationstart',
    'animationend',
  ]) {
    listen(root, type);
  }
  listen(window, 'resize');
  if (window.visualViewport) listen(window.visualViewport, 'resize');
  const dom = new MutationObserver((records) => {
    if (
      records.some(
        (record) => record.type === 'childList' || record.attributeName === GPU_GLASS_ATTRIBUTE,
      )
    ) {
      collect();
    }
    kick();
  });
  dom.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      GPU_GLASS_ATTRIBUTE,
      'data-state',
      'data-bucket',
      'width',
      'height',
      'style',
      'data-hidden',
      LIQUID_ATTRIBUTE,
    ],
  });
  cleanups.push(() => dom.disconnect());
  const theme = new MutationObserver(() => {
    readMaterials();
    signature = '';
    kick();
  });
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-short'],
  });
  cleanups.push(() => theme.disconnect());
  cleanups.push(
    onRegistered(() => {
      collect();
      kick();
    }),
  );
  // The cost ladder's first step switches GPU glass off with the lenses (GLS-7); the host's
  // tier follows it too, this only makes it immediate.
  cleanups.push(
    useRenderQualityStore.subscribe((state) => {
      if (state.degrade > 0) fail('cost ladder');
    }),
  );

  collect();
  kick();
  return handle;
}
