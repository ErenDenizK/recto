# Prompt: adopt the family kit in an app

Paste the block below into a new session opened in the app's own repo. Replace the two
placeholders, `{APP}` and `{SLUG}`, and keep the per-app note for that app (delete the others).

---

```text
You are working in {APP}'s own repository. {APP} is one of Eren Deniz Kuyucaklıoğlu's products
(Recto, English Prep, Eat Map, the portfolio). They share an origin, the family kit "Kept light",
and each keeps its own character. Your job is to let {APP} meet that origin with the smallest
moves, and to produce its presentation assets for the portfolio. You must never flatten {APP}'s
signature to make it match a sibling.

Read first, in this order:
1. This repo's CLAUDE.md and the documents it says to read. Its rules win over the kit wherever
   they disagree, including branches, checks, dependencies, language and commit style.
2. The family kit, in the portfolio repo (ErenDenizK/ErenDenizK.github.io, branch dev,
   docs/family-kit/): README.md, charter.md, light.md, motion.md, presentation.md,
   mark/README.md. Read docs/design/family.md §0 and §2.3 there too: §2.3 lists what {APP} must
   never change, and it outranks everything else.
   (Raw files: https://raw.githubusercontent.com/ErenDenizK/ErenDenizK.github.io/dev/docs/family-kit/<file>)

Then work in four steps, and stop where it says stop.

Step 1, audit (no changes). Measure {APP} against the kit: its ground, inks and contrast
(light.js describe() and contrast() on the real token values), its light field (checkField() on
a spec transcribed from the real code), its motion (springs.js spring(), durationBounce() and toLinear() on its real values), and
the eight charter rules (which check, test or document already enforces each one here). Record
facts with file and line; mark anything you could not verify.

Step 2, propose. A short table of the smallest moves, most valuable first. For each: what
changes, whether a user would see it, the files touched, how to undo it, and which kit rule it
serves. Good first moves: link the charter from CLAUDE.md; record the measured values; produce
world.json and captures; add the credits line to About. Moves that would change {APP}'s look,
motion, type, structure or voice are listed separately as "not recommended" with the reason.
STOP and ask the owner before any change a user would see. The owner answers in Turkish, often
by dictation: read through transcription errors and confirm names.

Step 3, apply only what the owner approved, in this repo's normal way (its branch rules, its
checks, its screenshot sizes: at least 1440x900, 1180x820 touch and 390x844, or the simulator's
equivalents), and look at every screenshot before reporting. Copy kit code into this repo rather
than linking across repos, with the kit commit in the copy's header. Never add a dependency.

Step 4, presentation assets (presentation.md): write world.json from the real token files with
source.commit set and estimates listed, and a capture script kept in this repo; shoot the
screens and the 6-10 s signature clip from the shipping build; encode as specified; put them in
a folder named {SLUG}/ (world.json and captures/) for the portfolio's lead to review. Do not
push to the portfolio repo.

Throughout:
- {APP}'s character is the point: its colour, material, faces, tempo, structure, signature
  interaction and language stay its own. The family is shared light on a near-black ground of
  its own temperature, one accent with one job, one spring grammar at {APP}'s own tempo, one voice
  rule, the quality charter, and the maker's mark only at exits.
- `edk.` appears only at exits (About or credits, press kit, social cards), never in working UI.
- Grain is not a family rule either way.
- No symbol characters as icons; no mock or invented content; every effect keeps a still twin.
- Never write an AI model name into code, comments or docs.

Report at the end: what you measured, what you changed (with commits), what you did not change
and why, the assets and where they are, and the questions left for the owner. Write it in
English and end with a short Turkish summary for the owner.
```

---

## Per-app notes (keep the one for this app inside the prompt)

**Recto** (`ErenDenizK/recto`). Its own solvers stay authoritative: `motion/springs.ts` (the kit's
springs.js is a port of it and must print the same strings), `styles/apca.ts`, the glass model.
Untouchable: the lime and "lime touches ink", the capsule morph, glass M1–M5, the aurora still at
rest, zero-bounce surfaces, the "Dengeli" R and its brand rules. About v2 waits on drop D4 from
the owner; the credits line belongs there. Also: the owner says the quality bar's "no grain"
wording (Q-1) is a misrecording: they had asked to fix the glass object's wrong render and its
banding, not to ban grain. Propose the correction to Q-1 and its references, and apply it only
when the owner confirms the wording.

**English Prep** (`ErenDenizK/english-prep`). `test` is the live branch and a push is a deploy:
`npm run check` and `npm run verify` before anything lands. No build step, no runtime
dependency, no `innerHTML`; version `x` stays 0. Its motion runs one ease today
(`cubic-bezier(0.22, 1, 0.36, 1)`): record it, do not replace it (motion.md §3.2). Its aurora is
the reference for the kit's light rules; keep its own CSS. The credits line goes in the folio
About, in Turkish *sen* (mark/README.md lists the wordings for the owner to choose).

**Eat Map** (`ErenDenizK/eatmap`, private, SwiftUI). Every Eat Map value in the kit is an estimate
from one simulator photo: the first job is to read the real ground, light, accent, mark and
whether there is a light theme from the Xcode project, and replace the estimates. Native
conventions win: system type and SF Symbols, the Liquid Glass tab bar, system springs
(springs.swift's `.eatMap` tempo). The credits row goes in Settings or About.
