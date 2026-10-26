/**
 * Scan warp shaders (big move 1, plan §2 "Perspective warp" and "Filters and encoding"). Two
 * passes: `WARP` samples the source through the homography into a texture, `FILTER` reads that
 * texture and applies the page filter. The constants below are shared with `cpu.ts` so both
 * paths use one recipe. No state is shared with `glass-gpu/`.
 */

/** Rec. 601 luma weights. */
export const LUMA = [0.299, 0.587, 0.114] as const;
/** Colour: the paper is the 90th percentile of each channel of a thumbnail. */
export const PAPER_PERCENTILE = 0.9;
/** Colour: the black point is the 2nd percentile of the white-balanced luma. */
export const BLACK_PERCENTILE = 0.02;
/** Colour: the paper never reads darker than this (of 255), so a dark frame is not blown up. */
export const PAPER_FLOOR = 32;
/** Colour: the black point never rises above this share of the range. */
export const BLACK_CEILING = 0.5;
/** B/W: a pixel is ink when its luma is under the local mean times (1 - this) (Bradley). */
export const BW_THRESHOLD = 0.15;
/** B/W: the local window radius is the long side over this. */
export const BW_WINDOW_DIVISOR = 16;
/** The thumbnail the colour statistics are taken from, px wide. */
export const THUMB_WIDTH = 64;

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Output pixel centre to source pixel through `uH`; row r of the target is output row r. */
export const WARP = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform mat3 uH;
uniform vec2 uSrcSize;
out vec4 o;
void main() {
  vec3 p = uH * vec3(gl_FragCoord.xy, 1.0);
  o = texture(uSrc, (p.xy / p.z) / uSrcSize);
}`;

/** Modes: 0 photo, 1 colour, 2 greyscale, 3 black and white. Writes the top row first (y flipped). */
export const FILTER = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform int uMode;
uniform vec3 uGain;
uniform float uLo;
uniform float uBase;
uniform float uMeanLod;
const vec3 LUMA = vec3(${LUMA.join(', ')});
const float BW_T = ${BW_THRESHOLD};
out vec4 o;
void main() {
  vec2 uv = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) / uSize;
  vec3 c = textureLod(uTex, uv, uBase).rgb;
  if (uMode == 1 || uMode == 2) {
    c = min(c * uGain, 1.0);
    c = clamp((c - uLo) / (1.0 - uLo), 0.0, 1.0);
    if (uMode == 2) c = vec3(dot(c, LUMA));
  } else if (uMode == 3) {
    float mean = dot(textureLod(uTex, uv, uMeanLod).rgb, LUMA);
    c = vec3(dot(c, LUMA) < mean * (1.0 - BW_T) ? 0.0 : 1.0);
  }
  o = vec4(c, 1.0);
}`;
