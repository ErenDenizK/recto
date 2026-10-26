/**
 * Scan warp, the WebGL2 path (big move 1, plan §2 "Perspective warp"). Pass one samples the
 * source through the homography into a texture; pass two applies the page filter and draws the
 * top row first. Colour and Greyscale take their statistics from a 64 px readback of the
 * warped page; B/W reads the local mean from the texture's mip chain. Context-loss and compile
 * handling follow `glass-gpu/renderer.ts`; no state is shared with it. Any failure throws
 * `GlWarpError` and `../encode.ts` falls back to `cpu.ts`.
 */
import { type ColourParams, colourParams, homographyFor, type Quad, type ScanFilter } from './cpu';
import { BW_WINDOW_DIVISOR, FILTER, THUMB_WIDTH, VERTEX, WARP } from './shaders';

export class GlWarpError extends Error {}

const MODES: Record<ScanFilter, number> = { photo: 0, colour: 1, greyscale: 2, bw: 3 };

function compile(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) throw new GlWarpError('shader: none created');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new GlWarpError(`shader: ${gl.getShaderInfoLog(shader) ?? 'compile failed'}`);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new GlWarpError(`program: ${gl.getProgramInfoLog(program) ?? 'link failed'}`);
  }
  return program;
}

function texture(gl: WebGL2RenderingContext, min: number): WebGLTexture {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export class GlWarp {
  private readonly gl: WebGL2RenderingContext;
  private readonly warp: WebGLProgram;
  private readonly filter: WebGLProgram;
  readonly canvas = new OffscreenCanvas(1, 1);

  private constructor() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new GlWarpError('no webgl2');
    this.gl = gl;
    this.warp = compile(gl, WARP);
    this.filter = compile(gl, FILTER);
  }

  /** A warp, or `null` when WebGL2 is missing or its shaders do not compile. */
  static create(): GlWarp | null {
    try {
      return typeof OffscreenCanvas === 'undefined' ? null : new GlWarp();
    } catch {
      return null;
    }
  }

  get lost(): boolean {
    return this.gl.isContextLost();
  }

  /** For tests and the dev tools: drops the context the way a GPU reset does. */
  loseContext(): void {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /**
   * Warps `source` through `quad` into `canvas` (`w` x `h`, top row first) and filters it.
   * Throws `GlWarpError` on a lost context, a size over the GPU's limit or a GL error.
   */
  render(
    source: ImageBitmap | OffscreenCanvas | ImageData,
    quad: Quad,
    w: number,
    h: number,
    filter: ScanFilter,
  ): OffscreenCanvas {
    const { gl } = this;
    if (gl.isContextLost()) throw new GlWarpError('context lost');
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (Math.max(source.width, source.height, w, h) > limit) {
      throw new GlWarpError('larger than the GPU texture size');
    }
    this.canvas.width = w;
    this.canvas.height = h;
    gl.disable(gl.BLEND);

    const src = texture(gl, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    const page = texture(gl, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, page, 0);

    // Pass one: the warp. `uniformMatrix3fv` wants column-major, `homographyFor` is row-major.
    const H = homographyFor(quad, w, h);
    gl.useProgram(this.warp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(gl.getUniformLocation(this.warp, 'uSrc'), 0);
    gl.uniform2f(gl.getUniformLocation(this.warp, 'uSrcSize'), source.width, source.height);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.warp, 'uH'), false, [
      H[0],
      H[3],
      H[6],
      H[1],
      H[4],
      H[7],
      H[2],
      H[5],
      H[8],
    ] as number[]);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    let params: ColourParams = { gain: [1, 1, 1], lo: 0 };
    if (filter !== 'photo') {
      gl.bindTexture(gl.TEXTURE_2D, page);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    if (filter === 'colour' || filter === 'greyscale') {
      params = this.statistics(page, w, h);
    }

    // Pass two: the filter, onto the canvas.
    const radius = Math.max(2, Math.round(Math.max(w, h) / BW_WINDOW_DIVISOR));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    this.drawFilter(page, [w, h], filter, params, 0, radius);
    if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) {
      throw new GlWarpError('draw failed');
    }

    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(page);
    gl.deleteTexture(src);
    return this.canvas;
  }

  /**
   * Draws the filter pass into the bound framebuffer, `w` x `h`; `base` is the mip level the
   * pixel is read from, `radius` the B/W window (px of the page, for the mean's mip level).
   */
  private drawFilter(
    page: WebGLTexture,
    size: readonly [number, number],
    filter: ScanFilter,
    params: ColourParams,
    base: number,
    radius: number,
  ): void {
    const { gl } = this;
    const loc = (name: string) => gl.getUniformLocation(this.filter, name);
    gl.useProgram(this.filter);
    gl.bindTexture(gl.TEXTURE_2D, page);
    gl.uniform1i(loc('uTex'), 0);
    gl.uniform2f(loc('uSize'), size[0], size[1]);
    gl.uniform1i(loc('uMode'), MODES[filter]);
    gl.uniform3f(loc('uGain'), ...params.gain);
    gl.uniform1f(loc('uLo'), params.lo);
    gl.uniform1f(loc('uBase'), base);
    gl.uniform1f(loc('uMeanLod'), Math.log2(2 * radius + 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The colour statistics, from a thumbnail drawn at a mip level of the warped page. */
  private statistics(page: WebGLTexture, w: number, h: number): ColourParams {
    const { gl } = this;
    const tw = Math.min(THUMB_WIDTH, w);
    const th = Math.max(1, Math.round((tw * h) / w));
    const thumb = texture(gl, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, thumb, 0);
    gl.viewport(0, 0, tw, th);
    this.drawFilter(page, [tw, th], 'photo', { gain: [1, 1, 1], lo: 0 }, Math.log2(w / tw), 0);
    const pixels = new Uint8Array(tw * th * 4);
    gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(thumb);
    return colourParams(pixels);
  }
}
