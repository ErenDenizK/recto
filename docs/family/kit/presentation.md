# Presentation assets

What an app hands the portfolio so its **embassy** (the project view that enters the product's
own world inside the portfolio's frame, family.md §3.1) shows the real product: one `world.json`
with the product's values, a set of real screen captures, and one signature clip. The app
session makes them from the app's own repo; the portfolio only consumes them (content is data,
ADR-0002).

## 1. Where they go

In the portfolio repo, beside the project's existing entry:

```
content/projects/<slug>.md            the project text (exists)
content/projects/<slug>/world.json    the product's world (this spec)
content/projects/<slug>/captures/     screens and the signature clip
```

`<slug>` is the project's file name: `recto`, `english-prep`, `eat-map`. The app session never
pushes to the portfolio: it writes the folder in its own scratch space (or a `wip/` branch of a
portfolio worktree) and the portfolio's lead reviews and merges, as for any agent work there.

## 2. `world.json`

Schema: [`world.schema.json`](world.schema.json) (JSON Schema 2020-12). Rules:

- **Copied, never redrawn.** Every value is read from the product's own source (token files, the
  Xcode asset catalogue), and `source` names the repo, commit and files. Estimates are listed in
  `source.estimated` as JSON pointers, so the portfolio can mark them.
- **`light` is a light field spec**, the shape `light.js checkField()` takes, so the embassy can
  draw it with `light.css` and the rules (cap, layers, cycles) are checked once. A product whose
  renderer does more (Recto's WebGL aurora, P3 stops) says so in `light.note`.
- **`motion`** gives the four roles as springs (`{ duration, bounce }` or `{ stiffness, damping }`,
  motion.md), `null` where the product leaves a role to the system. A product that moves on an
  ease today names it in `motion.ease`.
- **`promise.text`** is the product's own line in its own language; `gloss` carries an English
  gloss for meta; `evidence` says where it is proven.
- **`fonts`** name the product's faces and the CSS stack the embassy sets. The embassy loads no
  new font bytes: Inter products use the house Inter with the product's sizes, weights and
  tracking; SF products use `system-ui` with Inter as fallback.

Example (Recto, values as of 2026-10-09; capture files illustrative):

```json
{
  "version": 1,
  "slug": "recto",
  "name": "Recto",
  "source": {
    "repo": "ErenDenizK/recto",
    "commit": "<sha>",
    "version": "1.0.0-beta",
    "files": ["apps/web/src/styles/tokens.css", "apps/web/src/motion/springs.ts"],
    "date": "2026-10-09"
  },
  "ground": { "base": "#08090c", "frame": "#17191e", "raised": "#1f2227" },
  "ink": { "primary": "#e8e9ec", "secondary": "#a1a5ab", "tertiary": "#91949a" },
  "accent": {
    "color": "#c8fb3d",
    "ink": "#08090c",
    "radius": 999,
    "job": "The armed tool and the one primary action; it always touches ink and never touches the page.",
    "light": "#bbed26"
  },
  "light": {
    "behaviour": "event",
    "theme": "dark",
    "cap": 0.42,
    "sources": [
      { "pigments": ["#1f9996"], "at": [28, 92], "size": [70, 55] },
      { "pigments": ["#58da98"], "at": [55, 88], "size": [55, 45] },
      { "pigments": ["#bbed26"], "at": [78, 96], "size": [40, 32] }
    ],
    "event": { "boost": 1.25, "settle": 5 },
    "note": "WebGL aurora with a lemon core #faee40 and P3 stops; still at rest, never within 64 px of a page."
  },
  "fonts": {
    "ui": { "family": "Inter Recto", "stack": "Inter, system-ui, sans-serif", "weights": [400, 500, 600], "features": ["tnum"] }
  },
  "motion": {
    "press": { "duration": 0.2, "bounce": 0 },
    "settle": { "duration": 0.36, "bounce": 0 },
    "glide": { "duration": 0.46, "bounce": 0 },
    "pop": { "duration": 0.32, "bounce": 0.25 },
    "pressScale": { "mouse": 0.97, "touch": 0.94 }
  },
  "promise": { "text": "Nothing leaves this device.", "lang": "en", "evidence": "https://erendenizk.github.io/recto/about/" },
  "links": { "open": "https://erendenizk.github.io/recto/", "code": "https://github.com/ErenDenizK/recto" },
  "captures": [
    { "id": "library", "kind": "screen", "files": ["captures/recto-library-1440x900@2x.png"],
      "viewport": [1440, 900], "dpr": 2, "theme": "dark", "caption": "The Library, where every document starts.",
      "alt": "Recto's Library: document cards on a graphite ground with a teal and lime light below.", "shot": "2026-10-09" },
    { "id": "signature", "kind": "signature",
      "files": ["captures/recto-signature-1440x900@2x-poster.png", "captures/recto-signature-1440x900@2x.av1.mp4",
                "captures/recto-signature-1440x900@2x.hevc.mp4", "captures/recto-signature-1440x900@2x.h264.mp4"],
      "viewport": [1440, 900], "dpr": 2, "theme": "dark", "durationSeconds": 8,
      "caption": "The capsule changes shape: dock, Markup palette, Pages bar.", "shot": "2026-10-09" }
  ]
}
```

## 3. Captures

**Screens.** PNG masters, lossless, from the shipping build, at:

| Size | Viewport × DPR | Pixels | Required |
|---|---|---|---|
| Wide | 1440 × 900 × 2 | 2880 × 1800 | 3–5: the hero first |
| Phone | 390 × 844 × 2 | 780 × 1688 | 1–3 (Recto: its read-only compact edition) |
| Tablet | 1180 × 820 × 2, touch | 2360 × 1640 | optional; Recto's second home |

A native app shoots the simulator at its own scale (Eat Map: the current large iPhone at 3×) and
names the device in the caption's `alt`. No bezels, no tilt, no composites: the portfolio adds
the product's corner radius and a 1 px `rgba(255,255,255,.06)` hairline. The portfolio's build
derives AVIF and WebP sizes from the masters; the app never ships compressed derivatives.

**What to show** (family.md §3.1): the product doing its job, in its default dark theme, with
real content (the product's own sample document, real lessons), no personal data, no debug UI.

| Product | Screens | Signature clip |
|---|---|---|
| Recto | Library · Markup with the capsule palette · Pages grid; phone: a document in the compact edition | the capsule morphing dock → Markup palette → Pages bar |
| English Prep | Eğitim · an answered question (Sakura *Doğru*) · the About folio; phone: a lesson, a question | an answer: press, release, the Sakura *Doğru* |
| Eat Map | Feed · Map · You (simulator) | the Liquid Glass tab moving to the avatar pill, then compose |

**The signature clip.** One 6–10 s clip of the product's signature interaction, starting and
ending on a rest pose so the poster is its first frame and a loop never jumps. Encoded three
times, as the portfolio's media rules (ADR-0006, `tools/objects/encode.py`): AV1 10-bit, then
HEVC Main 10 tagged `hvc1`, then H.264; BT.709 limited range tagged; no audio; `+faststart`;
60 fps from the UI (30 is acceptable for a native recording).

```sh
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -an -movflags +faststart"
ffmpeg -framerate 60 -i frames/%04d.png -c:v libsvtav1 -preset 4 -crf 30 -pix_fmt yuv420p10le -svtav1-params tune=0 $COLOR  <name>.av1.mp4
ffmpeg -framerate 60 -i frames/%04d.png -c:v libx265 -preset slow -crf 22 -pix_fmt yuv420p10le -tag:v hvc1 $COLOR <name>.hevc.mp4
ffmpeg -framerate 60 -i frames/%04d.png -c:v libx264 -preset slow -crf 20 -profile:v high -pix_fmt yuv420p $COLOR  <name>.h264.mp4
cp frames/0001.png <name>-poster.png
```

UI text is sharper than a rendered object: check the clip's text at 1× against the poster and
lower the CRF if it smears. The portfolio plays the clip once when in view and rests on the
poster; reduced motion, Save-Data and a rejected `play()` show the poster only.

## 4. File names

```
<slug>-<view>-<w>x<h>@<dpr>x[-light].png            screens (dark is the default, unmarked)
<slug>-signature-<w>x<h>@<dpr>x-poster.png           the clip's first frame
<slug>-signature-<w>x<h>@<dpr>x.{av1,hevc,h264}.mp4  the clip
```

Lower case, hyphens, the CSS viewport (not the pixel size), e.g. `english-prep-question-390x844@2x.png`.

## 5. How an app session produces them

1. **Read** this kit (README, light.md, motion.md, this page) and the app's own `CLAUDE.md`.
2. **Values.** Read the token files; write `world.json` with `source.commit` set; run
   `node light.js` style checks (`checkField` on `light`, `contrast` on ink/ground) and fix
   transcription, never the product.
3. **Script, kept in the app's repo** (e.g. `tools/presentation/`), so the captures can be made
   again at the next release:
   - *Web:* Playwright against the production build, a fresh context per size
     (`viewport`, `deviceScaleFactor: 2`, `hasTouch` for tablet, `colorScheme: 'dark'`), wait for
     fonts and the entrance motion to settle (`settled(el)` in Recto, `whenVisible` in English
     Prep), then `page.screenshot({ animations: 'disabled' })`. Drifting light is then shown at
     its start pose, which is deterministic.
   - *Clip on the web:* frames, not a screen recorder: slow the page's animations through CDP
     (`Animation.setPlaybackRate`, e.g. 0.25), drive the interaction with the script, capture PNG
     frames at a fixed interval, and assemble them at the real rate. Chromium's own video
     recording is too lossy for UI text.
   - *iOS:* `xcrun simctl io booted screenshot <file>.png`; the clip with
     `xcrun simctl io booted recordVideo --codec=hevc <file>.mov`, trimmed to the rest poses and
     re-encoded to the three files above.
4. **Look** at every capture at 100 % and at the size the portfolio shows it (charter rule 6).
5. **Hand over** the folder for the portfolio's lead to review; list anything estimated.
