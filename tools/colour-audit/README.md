# Colour audit harness

Measures contrast on the built app with Playwright and Chromium: every text node, icon glyph and
focus ring, per state, viewport (desk 1440x900, tablet 1180x820, phone 390x844), theme and contrast
preference, against the background sampled from a screenshot with text and icons hidden. No new
dependencies: Node 22 with `--experimental-strip-types`, and the repo's Playwright.

## Environment

| Variable | Default |
|---|---|
| `COLOUR_AUDIT_OUT` | `tools/colour-audit/out` (git-ignored) |
| `COLOUR_AUDIT_BASE` | `http://localhost:4296/` |
| `PLAYWRIGHT_CHROMIUM` | `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` if present, else Playwright's own |

## Rerun (from the repo root)

```sh
cd apps/web && RECTO_RENDER_OVERRIDE=1 ../../tools/dev/heavy.sh pnpm build
pnpm exec vite preview --port 4296 --strictPort &
cd ../../tools/colour-audit
node --experimental-strip-types selftest.ts              # colour maths anchors
../dev/heavy.sh node --experimental-strip-types measure.ts desk
../dev/heavy.sh node --experimental-strip-types measure.ts tablet
../dev/heavy.sh node --experimental-strip-types measure.ts phone
FOCUS_ONLY=1 node --experimental-strip-types measure.ts desk   # rings only (also tablet, phone)
node --experimental-strip-types glass.ts                 # glass variability
node --experimental-strip-types palette.ts               # static token inventory
node --experimental-strip-types cvd-lime.ts              # colour-vision pairs, lime data
node --experimental-strip-types aggregate.ts > out/data/agg.txt
node --experimental-strip-types top40.ts
node --experimental-strip-types annotate.ts              # optional: annotated non-text shots
```

`measure.ts <vp> [stateRegex]` re-runs a subset (writes `raw/<vp>-partial.json`). Diff
`out/data/agg.txt` and `out/data/top40.md` against `baseline/`.

## What each script writes (under `out/`)

| Script | Writes |
|---|---|
| `measure.ts` | `data/raw/<vp>.json` (`-focus`, `-partial` variants), `shots/<state>__<vp>__<theme>-<contrast>.jpg` |
| `aggregate.ts` | `data/measurements.json`; pass rates on stdout |
| `top40.ts` | `data/top40.md` |
| `glass.ts` | `data/glass-variability.json`, `shots/glass-*.jpg` |
| `palette.ts` | `data/palette.json` |
| `cvd-lime.ts` | `data/cvd.json`, `data/lime.json` |
| `annotate.ts` | `shots/nontext-*.jpg` |
| `project.ts` | `data/projection.json`: re-scores measured samples with proposed token colours (edit `MAP`), needs the outputs above |

`color.ts`, `png.ts`, `collect.ts`, `analyse.ts` and `pw.ts` are shared helpers. Limits: Chromium on
Linux (software rasteriser, 8-bit sRGB, no Safari or P3), Glass Clear only, median ground per box,
Turkish UI not measured.
