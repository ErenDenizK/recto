# Motion: one grammar, each product's tempo

The family's motion is felt, not seen (family.md F1). What is shared is the *grammar*: one spring
formula, four roles, three rules. What is not shared is the *tempo*: Recto never bounces a
surface, English Prep presses and releases slowly, Eat Map uses the platform's springs, the
portfolio saves its one overshoot for objects. A product never changes tempo to match a sibling.

## 1. The formula

A damped spring of mass 1, `x″ + c·x′ + k·x = 0`, solved in closed form. It has two names that
map onto each other exactly:

```
k = (2π / d)²        c = 4π(1 − b) / d   (bounce b ≥ 0)        c = 4π / (d(1 + b))   (b < 0)
ζ = c / (2√k)        overshoot = e^(−πζ / √(1 − ζ²))   for ζ < 1
```

- **stiffness k, damping c** (the portfolio's habit), or
- **perceptual duration d, bounce b** (Recto's and SwiftUI's habit; `Spring(duration:bounce:)`
  is this same spring).

**CSS** gets it as a `linear()` curve and a duration: sampled from the closed form up to the time
it stays within **0.1 %** of the target, reduced (Ramer–Douglas–Peucker) to within 0.25 %, the
duration that 0.1 % time rounded up to 10 ms. Every zero-bounce spring has the same curve; only the
duration differs. This is Recto's solver (`apps/web/src/motion/springs.ts`), ported unchanged:
for Recto's tokens `springs.js` prints Recto's own strings, character for character.

Springs carry position, size and scale. Opacity and colour stay on short eases (≤ 280 ms).

```js
import { spring, toLinear, tempoCSS, TEMPOS } from './springs.js';
toLinear({ stiffness: 300, damping: 30 });   // { easing: 'linear(0, 0.006 1.3%, …, 1)', duration: 510 }
toLinear({ duration: 0.36, bounce: 0 });     // Recto's smooth: 530 ms
tempoCSS('recto');                           // --kl-press: 300ms; --kl-press-ease: linear(…); … + reduced twin
```

```sh
node springs.js              # every tempo: k, c, ζ, d, b, 99 % settle, CSS duration, overshoot
node springs.js recto        # CSS custom properties for one tempo
node springs.js k=180 c=16   # one spring
```

SwiftUI: `springs.swift` gives the same roles on `Spring`, a `KeptTempo` per product and a
`.keptAnimation(_:tempo:value:)` modifier that honours Reduce Motion.

## 2. The four roles

| Role | Answers | Rule |
|---|---|---|
| **press** | the finger: pointer down and the release | the release is the spring; the press-in itself may be a 60–120 ms ease |
| **settle** | the end of every move: panels, reflow, a selection, an indicator | no visible overshoot on a surface (ζ ≥ 0.85) |
| **glide** | a change of place: sheets, rooms, large moves | zero bounce; long enough to follow, short enough not to wait for |
| **pop** | one small thing that deserves it: a success glyph, an object's poke | rare; never a surface; a product may not use it at all |

**The three rules.** (1) One formula: no hand-drawn béziers for movement. (2) Rest is still:
nothing loops to look alive; only ambient light may drift, ≥ 9 s cycles, paused when hidden
(light.md). (3) Every token has a reduced-motion twin (§4).

## 3. Each product's tempo

`node springs.js`, 2026-10-09. *CSS* is the duration the token is written for (0.1 % settle);
*99 %* is when the move looks finished.

### 3.1 Recto (shipped: `motion/springs.ts`, language.md §7.1)

| Role | Recto token | d / b | k / c | ζ | 99 % | CSS | Overshoot |
|---|---|---|---|---|---|---|---|
| press | press | 0.20 / 0 | 987 / 62.8 | 1.00 | 211 ms | 300 ms | 0 |
| settle | smooth | 0.36 / 0 | 305 / 34.9 | 1.00 | 380 ms | 530 ms | 0 |
| glide | glide | 0.46 / 0 | 187 / 27.3 | 1.00 | 486 ms | 680 ms | 0 |
| pop | pop | 0.32 / 0.25 | 386 / 29.5 | 0.75 | 336 ms | 410 ms | 2.8 % |

Recto also has quick (0.28), fling (0.40 / 0.15) and track (0.10); they stay Recto's. Press
scale .97 mouse / .94 touch; View Transitions 240 ms; idle frames = 0.

### 3.2 English Prep (equivalent: its CSS runs one ease today)

Today every movement is `cubic-bezier(0.22, 1, 0.36, 1)`: press 100 ms (`--d-press`), release
380 ms (`--d-release`), route 360 ms over 12 px (`--d-route`), answer confirm / retry 220 ms
(`--d-reveal`); its `--spring-*` names alias that ease. **That stays.** If English Prep ever
wants springs, these zero-bounce springs are the closest to today's curve (fitted per duration;
max difference 7.6 % of the distance). They settle sooner than the ease's nominal duration
because that ease is already 98 % there at 60 % of its time; a spring with the *same* duration
would feel slower at the start (16 % behind at 10 % of the time) and must not be used.

| Role | Today | d / b | k / c | 99 % | CSS |
|---|---|---|---|---|---|
| press | 100 ms compression | 0.048 / 0 | 17 135 / 262 | 51 ms | 80 ms |
| settle | 380 ms release | 0.182 / 0 | 1 192 / 69 | 192 ms | 270 ms |
| glide | 360 ms route | 0.172 / 0 | 1 335 / 73 | 182 ms | 260 ms |
| pop | 220 ms answer | 0.105 / 0 | 3 581 / 120 | 111 ms | 160 ms |

### 3.3 Eat Map (estimated: iOS system springs; confirm in the Xcode project)

| Role | Today *(est.)* | `Spring` | 99 % | Overshoot |
|---|---|---|---|---|
| press | system button highlight | — (system) | — | — |
| settle | `.smooth` | duration 0.5, bounce 0 | 528 ms | 0 |
| glide | NavigationStack push | — (system) | — | — |
| pop | `.bouncy` on compose | duration 0.5, bounce 0.3 | 523 ms | 4.6 % |

### 3.4 The portfolio (settle and pop shipped; press and glide proposed in family.md §2.2)

| Role | Token | k / c | ζ | d / b | 99 % | CSS | Overshoot |
|---|---|---|---|---|---|---|---|
| press | proposed (today `--d-1` 120 ms ease) | 600 / 49 | 1.00 | 0.257 / 0 | 271 ms | 380 ms | 0 |
| settle | `--spring-ui` | 300 / 30 | 0.87 | 0.363 / 0.13 | 269 ms | 510 ms | 0.4 % |
| glide | proposed (today `--d-4` 480 ms ease) | 170 / 26 | 1.00 | 0.482 / 0 | 506 ms | 710 ms | 0 |
| pop | `--spring-object`, objects only | 180 / 16 | 0.60 | 0.468 / 0.40 | 465 ms | 760 ms | 9.7 % |

Recorded, not changed: the shipped `--spring-ui` is written for 450 ms, cut where the spring is
still 0.3 % past its target; the kit's 0.1 % rule would write 510 ms. Its curve matches the closed form
within 0.11 % at every stop. Whether to adopt the 510 ms reading is a portfolio decision.

## 4. Reduced motion

One rule for the family, per token, not one global switch (Recto ADR-0026):

- **Spatial springs become instant**: whatever moves on press, settle, glide or pop jumps to its
  end (`tempoCSS()` writes `0ms` under `prefers-reduced-motion: reduce` and under
  `[data-motion='reduced']`; SwiftUI animates nothing).
- **Fades stay perceptible**: opacity and colour changes keep 100–150 ms, never longer.
- **Light is still** (light.md rule 7); clips show their poster; nothing pulses.
- Press keeps its colour or opacity change and loses its scale.
- An app's own motion setting (English Prep's Profile toggle, Recto's Reduce motion) and the OS
  setting give the same result.
