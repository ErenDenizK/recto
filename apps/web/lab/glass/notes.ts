/**
 * The lab's notes: what each reference library does, from reading its source (never running
 * it), and what the tiers are. The full write-up is docs/research/23-liquid-glass-lab.md.
 * No third-party image is shown here: the CSP allows this origin only, and the libraries'
 * screenshots stay on their own pages (linked).
 */
export const TIERS_HTML = `
<table class="tiers">
  <thead><tr><th>Tier</th><th>What draws it</th><th>Who gets it</th><th>Cost while content moves under it</th></tr></thead>
  <tbody>
    <tr><th>Current</th><td><code>materials.css</code> as it ships: one blur · saturate · brightness and tint per tier, a 1 px lit border, the 6 px gradient lens on M1 chips.</td><td>Everyone; the lens Chromium on a GPU, fine pointer.</td><td>One backdrop pass per surface.</td></tr>
    <tr><th>T0</th><td>CSS only: the same tier filter and tint, plus a soft bezel band (half the blur, brighter, an SVG mask), a two-lobe specular rim (conic gradient at the light angle), a dark outer edge, inner light, press glow, squish. Morphs fuse through a mask of the smooth union’s outline.</td><td>Every engine (Safari, iOS, Firefox, Chromium).</td><td>Two backdrop passes per surface (body + bezel).</td></tr>
    <tr><th>T1</th><td>T0 with a true refraction: an SVG displacement map per size, drawn from the rounded-rect SDF and Snell's law (corners and capsule ends exact), optional dispersion.</td><td>Chromium only (Safari and Firefox drop a backdrop-filter holding <code>url()</code>).</td><td>One backdrop pass plus the SVG filter; main-thread paint work per scrolled frame (research 16 §5.3).</td></tr>
    <tr><th>T2</th><td>WebGL2: one canvas per stage refracts the page raster we already own (uploaded once, blurred once per σ); SDF union, Snell per channel, frost, tint, rim, shadow and the scroll edge in one pass over the glass pixels only.</td><td>Any engine with WebGL2 (all current ones); not when WebGL reports a software renderer.</td><td>One fragment pass over the glass area; no per-frame blur.</td></tr>
  </tbody>
</table>`;

export const REFERENCES_HTML = `
<div class="cards">
  <div class="card">
    <h3>Liquid DOM (AndrewPrifer) · MIT · the one the owner meant</h3>
    <p>React 19 bindings over a WebGPU renderer; DOM content enters the GPU through Chrome's experimental HTML-in-Canvas (<code>canvas layoutsubtree</code>, a flag). Heavy: every frame renders the scene, blurs it adaptively and shades the glass.</p>
    <ul>
      <li>Shape: smooth rounded rect, p-norm corner (exponent 2 → 4 at smoothing 0.6, iOS squircle).</li>
      <li>Fusion: finite smooth union gated by the angle between normals.</li>
      <li>Bezel: h(x) = √(1 − (1 − x)⁴); normal (∇d · h′, 1); <code>refract()</code> per channel with ior ± dispersion; offset = R.xy / −R.z × (thickness + h).</li>
      <li>Defaults: blur 8, bezel 14, thickness 90, ior 1.5, specular 0.45, tint white 0.15, shadow 0 10 24 / 0.12.</li>
      <li>Menu morph: blob → menu with springs 144/14, size 300 ms, radius 700 ms, content blur 8 → 0 and scale 2 → 1.</li>
    </ul>
    <p><a href="https://github.com/AndrewPrifer/liquid-dom" rel="noopener" target="_blank">github.com/AndrewPrifer/liquid-dom</a></p>
  </div>
  <div class="card">
    <h3>Liquid Glass Studio (iyinchao) · MIT</h3>
    <p>A React 19 + Vite playground, WebGL2 or WebGPU, multipass (background, two blur passes, main). It owns its background (image or video).</p>
    <ul>
      <li>Edge factor: θi = asin((1 − d/T)²), θt = asin(sin θi / n), offset = −tan(θt − θi) along −∇d.</li>
      <li>Dispersion: channels at n × (1 ∓ 0.02 × gain). Fresnel: clamp((1 + d·k + hardness)⁵). Glare: angle lobes, lifted in LCH.</li>
      <li>Merge: polynomial smooth min of a circle and a superellipse rect.</li>
    </ul>
    <p><a href="https://github.com/iyinchao/liquid-glass-studio" rel="noopener" target="_blank">github.com/iyinchao/liquid-glass-studio</a></p>
  </div>
  <div class="card">
    <h3>liquidGL (naughtyduk) · MIT</h3>
    <p>Vanilla JS; WebGPU → WebGL2 → WebGL1 → CSS. Rasterises the page itself into a snapshot texture (its own DOM rasteriser), so CSS animations behind the lens do not refract and Safari is unstable above half the viewport (its README).</p>
    <ul>
      <li>Offset = edge × refraction + edge¹⁰ × bevelDepth, edge = 1 − smoothstep(0, bevel, −d): a heuristic, not Snell.</li>
      <li>Frost: 16 random taps; aberration: red and blue either side of the offset.</li>
    </ul>
    <p><a href="https://github.com/naughtyduk/liquidGL" rel="noopener" target="_blank">github.com/naughtyduk/liquidGL</a></p>
  </div>
  <div class="card">
    <h3>liquid-glass-react (rdev) · MIT</h3>
    <p>SVG <code>feDisplacementMap</code> as a <code>filter</code> on a backdrop-blurred layer: Chromium bends, Safari and Firefox show blur only (its README). Maps from a canvas "shader" (after Shu Ding's liquid-glass, MIT).</p>
    <ul>
      <li>Three displacement passes at scale × (1, 1 − 0.05a, 1 − 0.1a), channels screened: dispersion.</li>
      <li>Rims: two 1.5 px masked borders (screen and overlay) with a 135° gradient that follows the pointer; "elasticity" stretches the pane towards the pointer.</li>
    </ul>
    <p><a href="https://github.com/rdev/liquid-glass-react" rel="noopener" target="_blank">github.com/rdev/liquid-glass-react</a></p>
  </div>
  <div class="card">
    <h3>iOS 26 Preview (the owner's recording)</h3>
    <ul>
      <li>Controls are nearly clear: little blur, strong rim refraction, a thin bright specular at top left and bottom right.</li>
      <li>Over white paper the small controls are light glass with dark glyphs; over the dark page they turn dark. The ink palette is a dark smoke even over white.</li>
      <li>The top of the page fades into the chrome under a progressive blur and a dark tint (the scroll edge).</li>
      <li>⋯ lights up white when pressed, sinks into a grey blob, the blob grows down and left as an egg, then squares into the menu while its blurred, enlarged content sharpens (≈ 450 ms). Closing reverses into the button.</li>
    </ul>
  </div>
</div>`;
