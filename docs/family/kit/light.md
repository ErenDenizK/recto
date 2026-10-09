# Light

The one visible constant (owner, 2026-10-09: "light, certainly"): every product sits on a
near-black ground of its own temperature and lets its colour arrive **as light**, never as paint.
This page states the rules; `light.js` and `light.css` are the same rules as code.

## 1. Rules

1. **Ground.** OKLCH L 0.12–0.20, chroma ≤ 0.03, hue toward the product's own colour. Never
   `#000`, never a mid-tone. A light theme is allowed and is the product's own business.
2. **One light field per view**, behind content (`z-index: -1`, no pointer events), never painted
   on text, controls or a document. Large surfaces are never filled with the accent.
3. **One opacity for the whole field** (English Prep's rule): ≤ 0.42 on dark grounds, ≤ 0.12 on
   light ones. Overlapping pigments are flattened under that one cap before they meet the ground,
   so contrast can be measured against the field's whole colour envelope.
4. **Few layers.** At most 3 sources, at most 3 pigments per source, at most 9 painted layers.
5. **Rest is still** unless the product chooses drift. Three behaviours:

   | Behaviour | What moves | Limits | Who |
   |---|---|---|---|
   | `still` | nothing | — | Eat Map *(est.)*, the portfolio |
   | `event` | the field brightens on an event (arrival, drop, success) and settles back | settle ≤ 5 s | Recto |
   | `drift` | sources travel and cross-fade their pigments | every drift and colour cycle ≥ 9 s, periods differ so nothing moves in lockstep | English Prep |

6. **Paused when hidden**: page not visible, or the field off screen. Paused where it is, so it
   resumes without a jump.
7. **Still twin**: under reduced motion each source rests in its first pigment, in place (English
   Prep's "three stationary colour pools"); events do not pulse. Forced colours: no field.
8. **Contrast is measured through the light**, not against the bare ground: the brightest point of
   the field's envelope under the cap is the ground a text pair is checked on (charter rule 2).

## 2. The ground ladder

`groundLadder()` builds a ground and its steps at one temperature and solves the inks against it
(the quietest ink that reaches its target, WCAG 2). Defaults: steps +0.04 / +0.08 / +0.14 in L
(between Recto's and English Prep's spacing); inks 14:1, 7:1, 4.5:1.

```js
import { groundLadder, ladderCSS, describe, contrast } from './light.js';

const g = groundLadder({ hue: 308, chroma: 0.009, L: 0.186 }); // English Prep's temperature
// { ground: '#141216', frame: '#1d1b20', raised: '#27242b', hairline: '#37323b',
//   ink: '#e2dee5', ink2: '#a09ea3', ink3: '#7e7c81', contrast: { ink: 14.02, ink2: 7.02, ink3: 4.51 } }
ladderCSS(g);           // "--kl-ground: #141216;\n--kl-frame: …"
describe({ ground: '#141216', inks: { ink: '#eee9ed' } }); // measure what a product already has
```

The generator is for a **new** surface or product. An existing product's ladder is recorded
(§4), not regenerated: English Prep's real `#1d1a20` / `#28242c` / `#39313d` sit within two levels
of the generated steps above, Recto's spacing is wider on purpose, and both stay as they
are. CLI: `node light.js` measures every product; `node light.js ladder <hue> <chroma> <L>` prints
a ladder as CSS.

## 3. The field

```html
<link rel="stylesheet" href="light.css">
<script type="module">
  import { mountField, checkField } from './light.js';
  const field = mountField(document.body, {
    behaviour: 'drift', theme: 'dark', cap: 0.42,
    sources: [
      { pigments: ['#a04278', '#6350a5', '#28798a'], at: [6, 5], size: [72, 78],
        drift: { period: 9.75, phase: -2.5, travel: [12, 12], turn: 15, breathe: 0.07 },
        cycle: { period: 13.5, phase: -2.25 } },
    ],
  });
  // behaviour 'event': field.pulse() on arrival or success; field.stop() removes it
</script>
```

- `at` and `size` are % of the field; `travel` is % of the source's own size; `turn` degrees;
  `breathe` a scale amplitude. `position: 'contain'` keeps a field inside one section (an
  embassy band) instead of the viewport.
- `checkField(spec)` returns the broken rules as sentences (`[]` passes); `mountField` refuses a
  spec that fails. Put `checkField` in CI next to the product's own colour checks.
- Pigment cross-fades overlap (each pigment holds 1/n of the cycle and fades over 2 × 6.67 %
  shared with the next), so the summed opacity never drops below 1: the light never passes
  through an empty, black midpoint.
- The field paints at `z-index: -1`, so the element it lights must be its own stacking context
  (`isolation: isolate`) or the ground must live on `html` / the canvas; a background on an
  ordinary `body` would cover it.
- The DOM is built node by node (no `innerHTML`). Transform and opacity only. The field is
  `contain: strict` and its own stacking context.
- **A product with its own renderer keeps it.** Recto's aurora is WebGL (ADR-0025) and English
  Prep's is its own CSS (`.ambient`); the kit is the shared definition they are checked against,
  and the drop-in for a product that has no light yet.
- **Lime on black turns olive at low alpha** (craft audit §5.3). A CSS field in lime needs a
  cooler, softer stop (the portfolio's `--recto-glow` `#a6d873`) or additive blending, as Recto's
  WebGL does.

## 4. Each product today (measured 2026-10-09; recorded, not changed)

Contrast is WCAG 2 on the bare ground (`node light.js`).

| | Recto | English Prep | Eat Map *(est.)* | Portfolio |
|---|---|---|---|---|
| Source | `apps/web/src/styles/tokens.css` | `css/editorial.css` | one simulator photo (family audit §1.3) | `src/styles/global.css` |
| Ground | `#08090c` L 0.140 C 0.007 h 270 | `#141216` L 0.186 C 0.009 h 308 | wine `#4a1626` L 0.289 C 0.080 h 5: **outside rule 1** as estimated; read the real ground from Xcode | `#0a0a0b` L 0.145 C 0.002 h 286 |
| Steps | frame `#17191e`, raised `#1f2227` | card `#1d1a20`, raised `#28242c`, hairline `#39313d` | — | rules as `rgba(233,229,222,.1/.18)` |
| Ink | `#e8e9ec` 16.4:1 · `#a1a5ab` 8.05:1 | `#eee9ed` 15.53:1 · `#d2c9d3` 11.56:1 | white 14.65:1 | `#e9e5de` 15.76:1 · `#b6b1a8` 9.28:1 · `#8c877f` 5.55:1 |
| Accent → job | lime `#c8fb3d` → the armed tool and the one primary action; always touches ink `#08090c`; never on the page | Sakura pair `#ed96b4` → `#dca2d8` → the one primary action, and *correct* (with mark and *Doğru*) | rose `#eb4f6b` → where you are and what you add | off-white pill `#e9e5de` → the next step; world colours are light |
| Light | WebGL aurora teal `#1f9996` → mint `#58da98` → lime `#bbed26` → lemon `#faee40`; `event`, settles ≤ 5 s, never within 64 px of a page | three clusters cycling cherry `#a04278`, iris `#6350a5`, lagoon `#28798a`; `drift` 9.75 / 11.75 / 13.75 s, colour 13.5 / 15.75 / 18 s; cap .42 dark / .09 light | rose glow `#ec5794` lower right; `still` | one pool per room or object (edk `#c9d4ff`, Record `#8fb8ff`, About `#f3b886`, project colours), 11 % → 4 % → 0; `still`; the page's dot and tab light glide between room colours |
| Still twin | Ambient Off, Reduce motion | three still pools | — (static) | already still |
| `light.js` record | `PRODUCTS.recto` (positions illustrative) | `PRODUCTS['english-prep']` | `PRODUCTS['eat-map']` | `PRODUCTS.portfolio` |

All four pass `checkField` as recorded. Eat Map is the one value to replace with real numbers.
