/**
 * T2, GPU glass (WebGL2): one canvas over a stage refracts a texture of the backdrop we drew
 * ourselves (`backdrop.ts`: the sample's page raster, as the app's PDFium bitmaps), so nothing
 * snapshots the DOM and nothing re-blurs per frame:
 *
 * - the column is uploaded once, and blurred once per σ (a half- or quarter-resolution separable
 *   Gaussian into a second texture); each frame then only shades the pixels inside the glass;
 * - the shapes are the stage's glass elements, read with getBoundingClientRect each frame, so CSS
 *   and script animate DOM boxes and the shader follows; shapes of one group fuse by a smooth
 *   minimum (the gooey merge), groups stay apart;
 * - per pixel: the SDF and its gradient, the bezel slope (convex squircle), Snell's law per
 *   colour channel (dispersion), a mix of the sharp and blurred textures (frost), the tier's
 *   saturate · brightness · contrast and tint (the same recipe as materials.css, so the contrast
 *   proofs of tokens.test.ts carry over), a two-lobe rim specular, a soft drop shadow and the
 *   scroll-edge blur under the top of the stage;
 * - it draws only when something changed (MOT-4: rest is still).
 *
 * The optics follow Liquid DOM's `GLASS_SHADER` (Andras Prifer, MIT): the surface normal from
 * the bezel slope, `refract()` per channel with ior ± dispersion, displacement = R.xy / −R.z ×
 * depth, and the rim specular as pow(max(dot(n, light), 0), sharpness) on both lobes.
 */
import type { Theme } from './backdrop';

export interface GlassParams {
  /** Bezel width, CSS px. */
  bezel: number;
  ior: number;
  /** Depth the refracted ray travels, CSS px. */
  depth: number;
  /** Dispersion, 0–1. */
  chroma: number;
  maxPull: number;
  /** Blur σ of the frosted texture, CSS px. */
  blur: number;
  /** 0 clear … 1 fully frosted. */
  frost: number;
  sat: number;
  bright: number;
  contrast: number;
  /** Tint colour (0–1) and its alpha. */
  tint: [number, number, number, number];
  /** Rim specular strength, 0–1, and its band, CSS px. */
  spec: number;
  specWidth: number;
  /** Light direction, radians; 0 points up, negative turns left (Liquid DOM's convention). */
  light: number;
  /** Drop shadow alpha. */
  shadow: number;
  /** Scroll-edge height at the top of the stage, CSS px (0: none), and its tint. */
  edge: number;
  edgeTint: [number, number, number, number];
  /** Smooth-union distance, CSS px. */
  k: number;
  /** The other look's recipe (the adaptive look mixes towards it per shape). */
  alt: { sat: number; bright: number; contrast: number; tint: [number, number, number, number] };
}

export interface ShapeSource {
  readonly el: HTMLElement;
  readonly group: number;
  /** Multiplies the frost and the tint alpha for this shape (a menu is denser than a chip). */
  readonly frost?: number;
  readonly tint?: number;
}

const MAX_SHAPES = 16;

const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform float u_sigma;
uniform vec2 u_out;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / u_out;
  float total = 1.0;
  vec3 sum = texture(u_src, uv).rgb;
  int radius = int(min(ceil(u_sigma * 3.0), 48.0));
  for (int i = 1; i <= 48; i++) {
    if (i > radius) break;
    float w = exp(-0.5 * float(i * i) / (u_sigma * u_sigma));
    sum += (texture(u_src, uv + u_dir * float(i)).rgb + texture(u_src, uv - u_dir * float(i)).rgb) * w;
    total += 2.0 * w;
  }
  o = vec4(sum / total, 1.0);
}`;

/** The scroll edge alone (no shapes): the band's pixels outside every glass quad. */
const EDGE = `#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform float u_dpr;
uniform vec2 u_col;
uniform vec2 u_offset;
uniform sampler2D u_sharp;
uniform sampler2D u_blurred;
uniform float u_edge;
uniform vec4 u_edgeTint;
out vec4 o;
vec3 tex(sampler2D t, vec2 css) {
  return texture(t, clamp((css - u_offset) / u_col, vec2(0.0), vec2(1.0))).rgb;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) / u_dpr;
  float t = 1.0 - smoothstep(0.0, u_edge, p.y);
  vec3 c = mix(tex(u_sharp, p), tex(u_blurred, p), clamp(t * 1.5, 0.0, 1.0));
  c = mix(c, u_edgeTint.rgb, u_edgeTint.a * t);
  o = vec4(c * t, t);
}`;

const COPY = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_out;
out vec4 o;
void main() { o = vec4(texture(u_src, gl_FragCoord.xy / u_out).rgb, 1.0); }`;

const GLASS = `#version 300 es
precision highp float;
uniform vec2 u_canvas;
uniform float u_dpr;
uniform vec2 u_col;
uniform vec2 u_offset;
uniform sampler2D u_sharp;
uniform sampler2D u_blurred;
uniform vec4 u_rect[${MAX_SHAPES}];
uniform vec4 u_meta[${MAX_SHAPES}];
uniform int u_count;
uniform int u_from;
uniform float u_k;
uniform float u_bezel, u_depth, u_ior, u_chroma, u_maxPull, u_frost;
uniform float u_sat, u_bright, u_contrast;
uniform vec4 u_tint;
uniform float u_spec, u_specWidth;
uniform vec2 u_light;
uniform float u_shadow;
uniform float u_edge;
uniform vec4 u_edgeTint;
uniform vec4 u_glow;
uniform float u_look[${MAX_SHAPES}];
uniform float u_satB, u_brightB, u_contrastB;
uniform vec4 u_tintB;
out vec4 o;

vec3 recipe(vec3 c, float sat, float contrast, float bright, vec4 tint, float tintScale) {
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, sat);
  c = (c - 0.5) * contrast + 0.5;
  c *= bright;
  return mix(c, tint.rgb, clamp(tint.a * tintScale, 0.0, 1.0));
}

float sdRR(vec2 p, vec4 rc, float r) {
  r = min(r, min(rc.z, rc.w));
  vec2 q = abs(p - rc.xy) - rc.zw + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float smin(float a, float b, float k) {
  if (k <= 0.0) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
// The union, and which shape is nearest (for its frost and tint).
float scene(vec2 p, out int nearest) {
  float total = 1e5;
  float group = -1.0;
  float inGroup = 1e5;
  float best = 1e5;
  nearest = 0;
  // Only the quad's own group: groups never fuse, so a quad needs no other group's field.
  for (int i = 0; i < ${MAX_SHAPES}; i++) {
    if (i < u_from) continue;
    if (i >= u_count) break;
    float d = sdRR(p, u_rect[i], u_meta[i].x);
    if (d < best) { best = d; nearest = i; }
    if (u_meta[i].y == group) {
      inGroup = smin(inGroup, d, u_k);
    } else {
      total = min(total, inGroup);
      group = u_meta[i].y;
      inGroup = d;
    }
  }
  return min(total, inGroup);
}
float scene(vec2 p) { int n; return scene(p, n); }

vec3 tex(sampler2D t, vec2 css) {
  return texture(t, clamp((css - u_offset) / u_col, vec2(0.0), vec2(1.0))).rgb;
}
vec3 frosted(vec2 css, float frost) {
  return mix(tex(u_sharp, css), tex(u_blurred, css), frost);
}
float slopeAt(float inward, float bezel) {
  if (inward <= 0.0 || inward >= bezel) return 0.0;
  float u = 1.0 - inward / bezel;
  float inside = max(1.0 - pow(u, 4.0), 1e-4);
  return min(2.0 * pow(u, 3.0) / sqrt(inside), 11.43);
}
vec2 pull(vec3 n, float ior) {
  vec3 r = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / ior);
  vec2 d = r.xy / max(-r.z, 1e-4) * u_depth;
  float len = length(d);
  return len > u_maxPull ? d * (u_maxPull / len) : d;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) / u_dpr;
  // Underneath: nothing, or the scroll edge (sharp to blurred and tinted towards the top).
  vec4 under = vec4(0.0);
  if (u_edge > 0.0 && p.y < u_edge) {
    float t = 1.0 - smoothstep(0.0, u_edge, p.y);
    vec3 c = mix(tex(u_sharp, p), tex(u_blurred, p), clamp(t * 1.5, 0.0, 1.0));
    c = mix(c, u_edgeTint.rgb, u_edgeTint.a * t);
    under = vec4(c * t, t);
  }
  int nearest;
  float d = scene(p, nearest);
  float aa = 0.75 / u_dpr;
  float fill = 1.0 - smoothstep(-aa, aa, d);
  // Far from every shape: the edge or nothing (most pixels of a quad stop here).
  if (d > 30.0) {
    o = under;
    return;
  }
  // The drop shadow from the same distance (no second pass over the shapes): a soft halo.
  float shade = u_shadow * (1.0 - smoothstep(-6.0, 20.0, d - 2.0)) * (1.0 - fill);
  if (fill <= 0.0) {
    o = vec4(under.rgb * (1.0 - shade), under.a + shade * (1.0 - under.a));
    return;
  }
  vec4 meta = u_meta[nearest];
  float inward = max(-d, 0.0);
  float bezel = u_bezel;
  // The normal only where the rim bends or shines; the flat middle needs none (4 field passes).
  vec2 g = vec2(0.0, -1.0);
  if (inward < max(bezel, u_specWidth + 2.0)) {
    g = vec2(scene(p + vec2(0.5, 0.0)) - scene(p - vec2(0.5, 0.0)),
             scene(p + vec2(0.0, 0.5)) - scene(p - vec2(0.0, 0.5)));
    g = length(g) > 1e-5 ? normalize(g) : vec2(0.0, -1.0);
  }
  vec3 n = normalize(vec3(g * slopeAt(inward, bezel), 1.0));
  float spread = 0.08 * u_chroma;
  float frost = clamp(u_frost * meta.z, 0.0, 1.0);
  vec3 col;
  if (u_chroma > 0.0) {
    col = vec3(frosted(p + pull(n, u_ior - spread), frost).r,
               frosted(p + pull(n, u_ior), frost).g,
               frosted(p + pull(n, u_ior + spread), frost).b);
  } else {
    col = frosted(p + pull(n, u_ior), frost);
  }
  // The tier's filter, as CSS does it: saturate, (contrast,) brightness, then the tint over it;
  // the adaptive look mixes towards the other theme's recipe.
  float look = u_look[nearest];
  vec3 a = recipe(col, u_sat, u_contrast, u_bright, u_tint, meta.w);
  col = look > 0.0 ? mix(a, recipe(col, u_satB, u_contrastB, u_brightB, u_tintB, meta.w), look) : a;
  // Rim light: a band inside the edge, bright where the normal faces the light and, weaker,
  // where it faces away (the far rim catches the light through the glass), plus a soft
  // fresnel glow across the bezel.
  float band = 1.0 - smoothstep(u_specWidth, u_specWidth + 1.0 / u_dpr, inward);
  float lobe = pow(max(dot(g, u_light), 0.0), 2.0) + 0.6 * pow(max(dot(g, -u_light), 0.0), 2.0);
  float fresnel = pow(1.0 - clamp(inward / max(bezel, 1.0), 0.0, 1.0), 3.0);
  col += vec3(1.0) * (u_spec * band * lobe * 0.9 + u_spec * fresnel * 0.12);
  if (u_glow.w > 0.0) {
    float r = length(p - u_glow.xy);
    col += vec3(1.0) * u_glow.w * (1.0 - smoothstep(0.0, u_glow.z, r));
  }
  col = clamp(col, 0.0, 1.0);
  vec4 outside = vec4(under.rgb * (1.0 - shade), under.a + shade * (1.0 - under.a));
  o = vec4(col * fill + outside.rgb * (1.0 - fill), fill + outside.a * (1.0 - fill));
}`;

function compile(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
    }
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
  }
  return program;
}

interface Target {
  readonly tex: WebGLTexture;
  readonly fbo: WebGLFramebuffer;
  readonly w: number;
  readonly h: number;
}

/** Whether WebGL2 is there at all (the lab says so when it is not). */
export function webgl2Available(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/** The renderer string, to say "software" next to the numbers when it is SwiftShader. */
export function rendererName(): string {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'none';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info
    ? (gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as string)
    : (gl.getParameter(gl.RENDERER) as string);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return name;
}

export class GlassRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly params: GlassParams;
  /** CPU time of the last draw, ms; with `finish` on, the GPU work is in it too. */
  lastMs = 0;
  drawn = 0;
  finish = false;
  private readonly gl: WebGL2RenderingContext;
  private readonly glass: WebGLProgram;
  private readonly blur: WebGLProgram;
  private readonly copy: WebGLProgram;
  private readonly edge: WebGLProgram;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private sharp: WebGLTexture | null = null;
  private blurred: Target | null = null;
  private column: HTMLCanvasElement | null = null;
  private blurredFor = -1;
  private sources: () => readonly ShapeSource[] = () => [];
  private frame = 0;
  private glowAt: [number, number, number, number] = [0, 0, 0, 0];
  private lost = false;

  constructor(
    private readonly stage: HTMLElement,
    private readonly scroller: HTMLElement,
    params: GlassParams,
  ) {
    this.params = { ...params };
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gl-layer';
    this.canvas.setAttribute('aria-hidden', 'true');
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.glass = compile(gl, VERTEX, GLASS);
    this.blur = compile(gl, VERTEX, BLUR);
    this.copy = compile(gl, VERTEX, COPY);
    this.edge = compile(gl, VERTEX, EDGE);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
    });
    stage.prepend(this.canvas);
    scroller.addEventListener('scroll', this.invalidate, { passive: true });
  }

  setShapes(sources: () => readonly ShapeSource[]): void {
    this.sources = sources;
    this.invalidate();
  }

  setParams(next: Partial<GlassParams>): void {
    Object.assign(this.params, next);
    this.invalidate();
  }

  /** A press light at (x, y) in stage px, radius r, strength s (0 turns it off). */
  glow(x: number, y: number, r: number, s: number): void {
    this.glowAt = [x, y, r, s];
    this.invalidate();
  }

  /** Uploads the column (once per backdrop, theme or size). */
  setColumn(column: HTMLCanvasElement): void {
    const gl = this.gl;
    this.column = column;
    if (this.sharp) gl.deleteTexture(this.sharp);
    this.sharp = this.texture(column.width, column.height, column);
    this.blurredFor = -1;
    this.invalidate();
  }

  /** Off while another tier shows: no draws, not even on scroll. */
  enabled = true;

  invalidate = (): void => {
    if (this.frame !== 0 || this.lost || !this.enabled) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  };

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.scroller.removeEventListener('scroll', this.invalidate);
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
  }

  private texture(w: number, h: number, source?: TexImageSource): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    return tex;
  }

  private target(w: number, h: number): Target {
    const gl = this.gl;
    const tex = this.texture(w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  private drop(target: Target | null): void {
    if (!target) return;
    this.gl.deleteTexture(target.tex);
    this.gl.deleteFramebuffer(target.fbo);
  }

  private uniform(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    const index = [this.glass, this.blur, this.copy, this.edge].indexOf(program);
    const key = `${index}:${name}`;
    if (!this.uniforms.has(key)) this.uniforms.set(key, this.gl.getUniformLocation(program, name));
    return this.uniforms.get(key) ?? null;
  }

  /** The frosted texture: the column downsampled, then a separable Gaussian, once per σ. */
  private ensureBlur(): void {
    const column = this.column;
    if (!column || !this.sharp || this.blurredFor === this.params.blur) return;
    const gl = this.gl;
    const scale = Number(column.dataset.scale ?? '1');
    const sigmaDevice = Math.max(this.params.blur, 0.5) * scale;
    const factor = sigmaDevice > 8 ? 4 : 2;
    const w = Math.max(1, Math.round(column.width / factor));
    const h = Math.max(1, Math.round(column.height / factor));
    const a = this.target(w, h);
    const b = this.target(w, h);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(this.copy);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharp);
    gl.uniform1i(this.uniform(this.copy, 'u_src'), 0);
    gl.uniform2f(this.uniform(this.copy, 'u_out'), w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(this.blur);
    gl.uniform1i(this.uniform(this.blur, 'u_src'), 0);
    gl.uniform2f(this.uniform(this.blur, 'u_out'), w, h);
    gl.uniform1f(this.uniform(this.blur, 'u_sigma'), sigmaDevice / factor);
    gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.uniform2f(this.uniform(this.blur, 'u_dir'), 1 / w, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.uniform2f(this.uniform(this.blur, 'u_dir'), 0, 1 / h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.drop(b);
    this.drop(this.blurred);
    this.blurred = a;
    this.blurredFor = this.params.blur;
  }

  render(): void {
    if (this.lost || !this.sharp) return;
    const started = performance.now();
    const gl = this.gl;
    const box = this.stage.getBoundingClientRect();
    // A scaled ancestor (the phone frame on a narrow screen): shade in the stage's own CSS px
    // and size the buffer for the pixels it covers on screen.
    const zoom = this.stage.offsetWidth > 0 ? box.width / this.stage.offsetWidth : 1;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2) * zoom;
    const width = Math.round(box.width * Math.min(globalThis.devicePixelRatio || 1, 2));
    const height = Math.round(box.height * Math.min(globalThis.devicePixelRatio || 1, 2));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.ensureBlur();
    const p = this.params;
    const rects: number[] = [];
    const metas: number[] = [];
    const looks: number[] = [];
    /** Shapes as [cx, cy, hw, hh, group], stage px. */
    const placed: [number, number, number, number, number][] = [];
    for (const source of this.sources().slice(0, MAX_SHAPES)) {
      const r = source.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      looks.push(Number(source.el.dataset.lookMix ?? '0'));
      const radius = Number.parseFloat(getComputedStyle(source.el).borderTopLeftRadius) || 0;
      const cx = (r.left - box.left + r.width / 2) / zoom;
      const cy = (r.top - box.top + r.height / 2) / zoom;
      const hw = r.width / 2 / zoom;
      const hh = r.height / 2 / zoom;
      rects.push(cx, cy, hw, hh);
      metas.push(Math.min(radius, hw, hh), source.group, source.frost ?? 1, source.tint ?? 1);
      placed.push([cx, cy, hw, hh, source.group]);
    }
    // One quad per group (contiguous shapes of one group id): the members' box, padded for the
    // shadow (24 px) and, where shapes fuse, the merge distance; [from, to) indexes the shapes.
    const groups: { box: [number, number, number, number]; from: number; to: number }[] = [];
    for (let i = 0; i < placed.length; i++) {
      const [cx, cy, hw, hh, group] = placed[i] as [number, number, number, number, number];
      const last = groups.at(-1);
      if (last && (placed[last.from] as number[])[4] === group) {
        last.to = i + 1;
        last.box = [
          Math.min(last.box[0], cx - hw),
          Math.min(last.box[1], cy - hh),
          Math.max(last.box[2], cx + hw),
          Math.max(last.box[3], cy + hh),
        ];
      } else {
        groups.push({ box: [cx - hw, cy - hh, cx + hw, cy + hh], from: i, to: i + 1 });
      }
    }
    const boxes = groups.map(({ box: [l, t, r, b], from, to }) => {
      const margin = 24 + (to - from > 1 ? p.k : 0);
      return {
        quad: [l - margin, t - margin, r + margin, b + margin] as [number, number, number, number],
        from,
        to,
      };
    });
    const edgeBox: [number, number, number, number] | null =
      p.edge > 0 ? [0, 0, box.width / zoom, p.edge] : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const count = rects.length / 4;
    const column = this.column;
    const colW = column ? Number.parseFloat(column.style.width) : box.width;
    const colH = column ? Number.parseFloat(column.style.height) : box.height;
    const scrollerBox = this.scroller.getBoundingClientRect();
    const offsetX = (scrollerBox.left - box.left) / zoom - this.scroller.scrollLeft;
    const offsetY = (scrollerBox.top - box.top) / zoom - this.scroller.scrollTop;
    const scissor = ([l, t, r, b]: [number, number, number, number]): boolean => {
      const sx = Math.max(0, Math.floor(l * dpr));
      const sy = Math.max(0, Math.floor(t * dpr));
      const ex = Math.min(width, Math.ceil(r * dpr));
      const ey = Math.min(height, Math.ceil(b * dpr));
      if (ex <= sx || ey <= sy) return false;
      gl.scissor(sx, height - ey, ex - sx, ey - sy);
      return true;
    };
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sharp);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurred?.tex ?? this.sharp);
    gl.enable(gl.SCISSOR_TEST);
    if (edgeBox) {
      const prog = this.edge;
      gl.useProgram(prog);
      const u = (name: string) => this.uniform(prog, name);
      gl.uniform1i(u('u_sharp'), 0);
      gl.uniform1i(u('u_blurred'), 1);
      gl.uniform2f(u('u_canvas'), width, height);
      gl.uniform1f(u('u_dpr'), dpr);
      gl.uniform2f(u('u_col'), colW, colH);
      gl.uniform2f(u('u_offset'), offsetX, offsetY);
      gl.uniform1f(u('u_edge'), p.edge);
      gl.uniform4fv(u('u_edgeTint'), p.edgeTint);
      if (scissor(edgeBox)) gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (boxes.length > 0) {
      const prog = this.glass;
      gl.useProgram(prog);
      const u = (name: string) => this.uniform(prog, name);
      gl.uniform1i(u('u_sharp'), 0);
      gl.uniform1i(u('u_blurred'), 1);
      gl.uniform2f(u('u_canvas'), width, height);
      gl.uniform1f(u('u_dpr'), dpr);
      gl.uniform2f(u('u_col'), colW, colH);
      gl.uniform2f(u('u_offset'), offsetX, offsetY);
      if (count > 0) {
        gl.uniform4fv(u('u_rect'), rects);
        gl.uniform4fv(u('u_meta'), metas);
        gl.uniform1fv(u('u_look'), looks);
      }
      gl.uniform1f(u('u_satB'), p.alt.sat);
      gl.uniform1f(u('u_brightB'), p.alt.bright);
      gl.uniform1f(u('u_contrastB'), p.alt.contrast);
      gl.uniform4fv(u('u_tintB'), p.alt.tint);
      gl.uniform1i(u('u_count'), count);
      gl.uniform1f(u('u_k'), p.k);
      gl.uniform1f(u('u_bezel'), p.bezel);
      gl.uniform1f(u('u_depth'), p.depth);
      gl.uniform1f(u('u_ior'), p.ior);
      gl.uniform1f(u('u_chroma'), p.chroma);
      gl.uniform1f(u('u_maxPull'), p.maxPull);
      gl.uniform1f(u('u_frost'), p.frost);
      gl.uniform1f(u('u_sat'), p.sat);
      gl.uniform1f(u('u_bright'), p.bright);
      gl.uniform1f(u('u_contrast'), p.contrast);
      gl.uniform4fv(u('u_tint'), p.tint);
      gl.uniform1f(u('u_spec'), p.spec);
      gl.uniform1f(u('u_specWidth'), p.specWidth);
      gl.uniform2f(u('u_light'), Math.sin(p.light), -Math.cos(p.light));
      gl.uniform1f(u('u_shadow'), p.shadow);
      gl.uniform1f(u('u_edge'), p.edge);
      gl.uniform4fv(u('u_edgeTint'), p.edgeTint);
      gl.uniform4fv(u('u_glow'), this.glowAt);
      // One scissored draw per group; where two groups' quads overlap, the later one wins
      // (glass never sits on glass, Q-4).
      for (const { quad, from, to } of boxes) {
        gl.uniform1i(u('u_from'), from);
        gl.uniform1i(u('u_count'), to);
        if (scissor(quad)) gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    if (this.finish) gl.finish();
    this.lastMs = performance.now() - started;
    this.drawn++;
  }
}

/** The tier recipe of materials.css per theme, for T2's defaults (M2 bar). */
export function tierRecipe(theme: Theme): Pick<GlassParams, 'sat' | 'bright' | 'contrast'> {
  return theme === 'dark'
    ? { sat: 1.8, bright: 0.44, contrast: 1 }
    : { sat: 1.5, bright: 1.4, contrast: 0.45 };
}
