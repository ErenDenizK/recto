# The family kit: Kept light

The shared origin of Eren Deniz Kuyucaklıoğlu's products (Recto, English Prep, Eat Map and the
portfolio), as files any of them can adopt without losing its own character. It is the accepted
part of the family vision (`docs/design/family.md`, accepted in part 2026-10-09) made portable:
rules you can link, code you can copy, a mark you can place, and a prompt that starts the work in
each app's own session.

**Nothing here is imposed.** An app adopts a piece only by choosing to, one small move at a time,
with the owner's yes for anything a user would see. Where this kit and an app's own rules
disagree, the app's rules win and the kit is wrong.

## What is shared

Few constants, so the variety stays readable (family.md §2.1). Test for any proposed constant: a
stranger shown a 64 px greyscale thumbnail of any screen still names the product; shown four
screens side by side, they guess "same maker".

| | Constant | The rule | Kit file |
|---|---|---|---|
| **Seen** | **Light on a near-black ground of the product's own temperature** | Ground OKLCH L 0.12–0.20, tinted toward the product's own hue (chroma ≤ 0.03), never `#000`, never a mid-tone. Colour arrives as light, at most one light field per view, behind content, never on it; still twin; paused when hidden. Large surfaces are never painted in the accent. | [light.md](light.md), `light.js`, `light.css` |
| **Seen** | **One accent, one job** | One accent per product with one job, stated in one sentence. Other colours may exist under named roles. | [light.md](light.md) §4 |
| **Felt** | **One spring grammar, own tempo** | Four roles (press, settle, glide, pop) from one spring formula; each product sets its own tempo and may skip a role. Rest is still; only ambient light may drift (≥ 9 s cycles). Every token has a reduced-motion twin. | [motion.md](motion.md), `springs.js`, `springs.swift` |
| **Felt** | **One voice rule** | Plain, specific, sentence case, no hype; first person or direct address. Each product carries one promise line about what stays with the user, written in its own language and register, never translated from another. | below |
| **Felt** | **One quality charter** | Eight rules, already practised in every repo. | [charter.md](charter.md) |
| **Signature** | **`edk.` at exits only** | The maker's mark appears in an app only at its exits: About or credits, press kit, social cards. Never in working UI. The dot takes the host product's colour. Its wider role is open. | [mark/](mark/README.md) |

**The voice rule, with the lines as they stand:** Recto "Nothing leaves this device." · English
Prep "Ücretsiz. Hesapsız. İlerlemen kendi tarayıcında." · Eat Map "Only the people here see your
log, and only you see theirs. Nothing is public." Each promise links to its evidence (charter
rule 8).

## What stays each product's own

Everything else: hue and pigments, material (Recto's glass, English Prep's opaque cards, Eat
Map's Liquid Glass), typefaces (owner, 2026-10-09: each app keeps its own faces), structure and
navigation, icon style, signature interaction, tempo, language and register, texture (grain stays
in the portfolio and is not a family rule either way).

### Never change (from family.md §2.3; this list outranks the kit)

| Product | Untouchable |
|---|---|
| **Recto** | One lime `#c8fb3d`, touching ink, one fill per view, never on the page · the white page as the brightest thing · the morphing glass capsule · glass M1–M5 and its rules · the lime aurora, still at rest · zero-bounce springs, idle frames = 0 · the "Dengeli" R, its gradient and the brand doc's usage rules · Inter Recto, sentence case, Phosphor outline → fill · clean glass renders without banding · A-1…A-24 |
| **English Prep** | Plum ground and Sakura / periwinkle answer semantics with words and marks · the living three-cluster aurora under one parent cap · Inter reading 18/30 in a ~600 px column · `ep.` with the Sakura dot · the 120 ms press and 380 ms release · v0.72 route choreography (ADR 013) · the rail · Turkish *sen* voice · settled navigation · no build step, no `innerHTML`, no runtime dependency · version `x` stays 0 | *(glass allowed again, measured; About may be redesigned, 2026-10-10)*
| **Eat Map** | Native SwiftUI and iOS conventions · the Liquid Glass capsule tab bar with the avatar pill and the round compose button · rose `#eb4f6b` on wine · the "Circle" privacy voice |
| **Portfolio** | Black ground and its grain · Newsreader for the name and titles · the per-world colours · pre-rendered objects (ADR-0006), one rig, one droplet · every tab a page (ADR-0007) |

## Adopting it

Opt in, smallest moves first. Each move is reversible, lives at an entry or exit point where it
can, and is done in the app's own repo under that repo's rules (its CLAUDE.md, branches,
checks). [PROMPT-TEMPLATE.md](PROMPT-TEMPLATE.md) starts such a session.

| Order | Move | Touches the UI? | Typical cost |
|---|---|---|---|
| 1 | Link the charter from the app's CLAUDE.md; note which rules the app already enforces and how | no | minutes |
| 2 | Measure the app's ground, inks and light with `light.js describe()` and record them | no | minutes |
| 3 | Produce `world.json` and the captures for the portfolio's embassy ([presentation.md](presentation.md)) | no | an hour |
| 4 | Add the credits line to the app's About ([mark/README.md](mark/README.md)) | yes: ask first | small |
| 5 | Express existing motion through `springs.js` (same values, one formula); only where the app has no spring source of its own | maybe: ask first | small |
| 6 | Use `light.js` / `light.css` for a light field the app does not have yet | yes: ask first | medium |

An app that already has its own solver (Recto's `motion/springs.ts`, English Prep's
`tools/palette.mjs`) keeps it. The kit then serves as the shared definition its numbers are
compared with, not as a replacement.

## Files

| File | What it is |
|---|---|
| [light.md](light.md) · `light.js` · `light.css` | The ground ladder, ink solving, the light field and its rules; each product's current values |
| [motion.md](motion.md) · `springs.js` · `springs.swift` | The spring formula, the four roles, each product's tempo, reduced motion |
| [mark/](mark/README.md) | `edk.` as outlined SVGs (two optical cuts, light and dark, dot separate), usage, credits line |
| [charter.md](charter.md) | The quality charter, linkable from each app's CLAUDE.md |
| [presentation.md](presentation.md) | What an app hands the portfolio: `world.json`, captures, the signature clip |
| [PROMPT-TEMPLATE.md](PROMPT-TEMPLATE.md) | The prompt to paste into a new session in any app repo |

Code here has no dependencies and no build step: ES modules for browsers and Node 18+, one Swift
file for iOS 17+. Copy a file into an app rather than linking across repos; note the kit commit it
came from in the copy's header.
