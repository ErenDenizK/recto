/**
 * GPU glass shaders (WebGL2, GLSL ES 3.00; decisions GLS-3, GLS-5, GLS-13, GLS-14). One
 * full-canvas triangle per piece, scissored to the piece's box, so only glass pixels are shaded.
 *
 * The backdrop is the page raster the app already owns: up to four page canvases as textures,
 * each mapped by its on-screen box (scroll, zoom and a pinch's transform are in the box), mip
 * mapped once per upload; the canvas colour shows between pages and the paper colour on a page
 * whose bitmap has not arrived. Blur is a mip level (σ → level, `geometry.blurLevel`) read with
 * four bilinear taps, faded across a page's edge by the same σ, as CSS blurs a page's border.
 *
 * Per pixel of a piece (the optics after Liquid DOM's `GLASS_SHADER`, Andras Prifer, MIT, and
 * the lab's T2, `lab/glass/t2-gl.ts`; restated, nothing copied):
 * - the rounded-rect SDF (CSS's own radius, so the DOM rim and shadow sit exactly on it) and its
 *   gradient, the convex-squircle bezel h(x) = √(1 − (1 − x)⁴) and its slope;
 * - Snell's law (ior 1.5) through the bezel's normal, per colour channel at ior ± spread (the
 *   slight chromatic split at the rim), the pull capped;
 * - the tier's own filter from the piece's CSS (saturate, contrast, brightness) and its tint;
 * - the legibility floor (GLS-14): where the glass would be too light under light glyphs (or too
 *   dark under dark ones) for the piece's ratio, it mixes towards the tier's solid colour, so
 *   text holds over any page in the theme's own tone (GLS-20);
 * - the rim light as two lobes, pow(max(n·L, 0), 2) towards a top-left light and 0.6 of it on
 *   the far side, brightest at the edge and falling off smoothly to nothing across its band
 *   (GLS-22: Liquid DOM's rim strength falls off from the edge and is feathered, so no band
 *   edge shows), plus a faint fresnel glow across the bezel.
 *
 * The scroll edge (DSN-35) is its own cheap program; a piece under it sees the pages through it
 * (`under`), as its CSS backdrop would have.
 */

export const MAX_PAGES = 4;
/** Samples of the scroll edge's tint and mask ramps. */
export const EDGE_RAMP = 32;

export const VERTEX = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

/** The backdrop: pages over the canvas colour, blurred by σ, and the edge (both programs). */
const BACKDROP = `
uniform vec2 u_canvas;
uniform float u_dpr;
uniform float u_sigma;
uniform vec3 u_bg;
uniform vec3 u_paper;
uniform int u_pageCount;
uniform vec4 u_page[${MAX_PAGES}];
uniform vec4 u_pageInfo[${MAX_PAGES}];
uniform sampler2D u_p0;
uniform sampler2D u_p1;
uniform sampler2D u_p2;
uniform sampler2D u_p3;
uniform float u_edgeOn;
uniform vec4 u_edgeBox;
uniform vec4 u_ramp[${EDGE_RAMP}];
uniform float u_mask[${EDGE_RAMP}];
uniform float u_edgeSigma;

vec3 tap(sampler2D t, vec2 uv, float lod, vec2 size) {
  if (lod < 0.01) return textureLod(t, uv, 0.0).rgb;
  vec2 o = 0.5 * exp2(lod) / size;
  return 0.25 * (textureLod(t, uv + vec2(-o.x, -o.y), lod).rgb
    + textureLod(t, uv + vec2(o.x, -o.y), lod).rgb
    + textureLod(t, uv + vec2(-o.x, o.y), lod).rgb
    + textureLod(t, uv + vec2(o.x, o.y), lod).rgb);
}

// One page over what lies under it: r is its box (CSS px), info (has bitmap, texels per px,
// texture size).
vec3 overPage(vec3 c, vec2 p, float sigma, vec4 r, vec4 info, sampler2D t) {
  vec2 d = min(p - r.xy, r.xy + r.zw - p);
  float f = smoothstep(-sigma - 0.5, sigma + 0.5, min(d.x, d.y));
  if (f <= 0.0) return c;
  vec3 pc = u_paper;
  if (info.x > 0.5) {
    vec2 uv = clamp((p - r.xy) / r.zw, vec2(0.0), vec2(1.0));
    float texels = sigma * info.y;
    float lod = texels > 0.65 ? log2(texels / 0.65) : 0.0;
    pc = tap(t, uv, lod, info.zw);
  }
  return mix(c, pc, f);
}

vec3 backdrop(vec2 p, float sigma) {
  vec3 c = u_bg;
  if (u_pageCount > 0) c = overPage(c, p, sigma, u_page[0], u_pageInfo[0], u_p0);
  if (u_pageCount > 1) c = overPage(c, p, sigma, u_page[1], u_pageInfo[1], u_p1);
  if (u_pageCount > 2) c = overPage(c, p, sigma, u_page[2], u_pageInfo[2], u_p2);
  if (u_pageCount > 3) c = overPage(c, p, sigma, u_page[3], u_pageInfo[3], u_p3);
  return c;
}

// The edge's tint (rgb, alpha) at p, and its mask.
vec4 edgeTint(vec2 p, out float mask) {
  float y = clamp((p.y - u_edgeBox.y) / max(u_edgeBox.w, 1.0), 0.0, 1.0) * ${EDGE_RAMP - 1}.0;
  int i = int(floor(y));
  int j = min(i + 1, ${EDGE_RAMP - 1});
  float f = fract(y);
  mask = p.y > u_edgeBox.y + u_edgeBox.w ? 0.0 : mix(u_mask[i], u_mask[j], f);
  return mix(u_ramp[i], u_ramp[j], f);
}

// What lies under a piece: the pages, and over them the scroll edge where it reaches.
vec3 under(vec2 p, float sigma) {
  vec3 c = backdrop(p, sigma);
  if (u_edgeOn < 0.5) return c;
  float mask;
  vec4 tint = edgeTint(p, mask);
  if (mask <= 0.0) return c;
  vec3 edge = mix(backdrop(p, sqrt(sigma * sigma + u_edgeSigma * u_edgeSigma)), tint.rgb, tint.a);
  return mix(c, edge, mask);
}

vec2 cssPoint() {
  return vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) / u_dpr;
}
`;

export const GLASS = `#version 300 es
precision highp float;
${BACKDROP}
uniform vec4 u_rect;
uniform float u_radius;
uniform float u_bezel;
uniform float u_depth;
uniform float u_ior;
uniform float u_chroma;
uniform float u_maxPull;
uniform vec3 u_filter;
uniform vec4 u_tint;
uniform vec3 u_solid;
uniform vec2 u_floor;
uniform float u_spec;
uniform float u_specWidth;
uniform vec2 u_light;
uniform float u_opacity;
out vec4 o;

float sdPiece(vec2 p) {
  vec2 q = abs(p - u_rect.xy) - u_rect.zw + u_radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - u_radius;
}

// The SDF's gradient, analytic: radial in a corner (and along a capsule's ends), else across
// the nearer side.
vec2 sdNormal(vec2 p) {
  vec2 rel = p - u_rect.xy;
  vec2 s = vec2(rel.x < 0.0 ? -1.0 : 1.0, rel.y < 0.0 ? -1.0 : 1.0);
  vec2 q = abs(rel) - u_rect.zw + u_radius;
  if (q.x > 0.0 && q.y > 0.0) return s * normalize(q);
  return q.x > q.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}

float bezelSlope(float inward) {
  if (inward <= 0.0 || inward >= u_bezel) return 0.0;
  float u = 1.0 - inward / u_bezel;
  float inside = max(1.0 - u * u * u * u, 1e-4);
  return min(2.0 * u * u * u / sqrt(inside), 11.43);
}

vec2 pull(vec3 n, float ior) {
  vec3 r = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / ior);
  vec2 d = r.xy / max(-r.z, 1e-4) * u_depth;
  float len = length(d);
  return len > u_maxPull ? d * (u_maxPull / len) : d;
}

float luma(vec3 c) {
  vec3 l = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  return dot(l, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 p = cssPoint();
  float d = sdPiece(p);
  float aa = 0.75 / u_dpr;
  float fill = 1.0 - smoothstep(-aa, aa, d);
  if (fill <= 0.0) {
    o = vec4(0.0);
    return;
  }
  float inward = max(-d, 0.0);
  vec2 g = vec2(0.0, -1.0);
  if (inward < max(u_bezel, u_specWidth + 2.0)) g = sdNormal(p);
  // The bezel tilts the surface; its normal bends the ray inwards (a convex lens's rim).
  vec3 n = normalize(vec3(g * bezelSlope(inward), 1.0));
  vec3 col;
  if (u_chroma > 0.0 && inward < u_bezel) {
    float spread = 0.08 * u_chroma;
    col = vec3(under(p + pull(n, u_ior - spread), u_sigma).r,
               under(p + pull(n, u_ior), u_sigma).g,
               under(p + pull(n, u_ior + spread), u_sigma).b);
  } else {
    col = under(inward < u_bezel ? p + pull(n, u_ior) : p, u_sigma);
  }
  // The tier's filter as CSS applies it: saturate, contrast, brightness; then the tint.
  float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(grey), col, u_filter.x);
  col = (col - 0.5) * u_filter.y + 0.5;
  col = clamp(col * u_filter.z, 0.0, 1.0);
  col = mix(col, u_tint.rgb, u_tint.a);
  // The legibility floor: never lighter (light glyphs) or darker (dark glyphs) than the bound.
  float lum = luma(col);
  float over = u_floor.y > 0.5 ? lum - u_floor.x : u_floor.x - lum;
  if (over > 0.0) {
    float t = clamp(over / max(abs(lum - luma(u_solid)), 1e-3) * 1.1, 0.0, 1.0);
    col = mix(col, u_solid, t);
  }
  // Rim light: bright towards the light, 0.6 of it on the far side, full at the edge and
  // falling off smoothly to nothing at the band's inner end (no line where it stops); and a
  // faint fresnel glow across the bezel.
  float band = 1.0 - smoothstep(0.0, u_specWidth, inward);
  float lobe = pow(max(dot(g, u_light), 0.0), 2.0) + 0.6 * pow(max(dot(g, -u_light), 0.0), 2.0);
  float fresnel = pow(1.0 - clamp(inward / max(u_bezel, 1.0), 0.0, 1.0), 3.0);
  col = clamp(col + u_spec * (band * lobe * 0.9 + fresnel * 0.12), 0.0, 1.0);
  float alpha = fill * u_opacity;
  o = vec4(col * alpha, alpha);
}`;

/**
 * The scroll edge (DSN-35): the band's own tint gradient over its blurred backdrop, both faded
 * out by its mask, as CSS composites the element; the ramps are sampled from its computed style.
 */
export const EDGE = `#version 300 es
precision highp float;
${BACKDROP}
uniform float u_opacity;
out vec4 o;

void main() {
  vec2 p = cssPoint();
  float mask;
  vec4 tint = edgeTint(p, mask);
  mask *= u_opacity;
  if (mask <= 0.0) {
    o = vec4(0.0);
    return;
  }
  vec3 col = mix(backdrop(p, u_edgeSigma), tint.rgb, tint.a);
  o = vec4(col * mask, mask);
}`;
