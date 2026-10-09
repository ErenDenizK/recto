# Onboarding, learning and delight: what Recto can borrow

Track: onboarding-delight · R12 cross-domain study · 2026-10-09

## What Recto already has (so we do not re-propose it)

From `docs/design/redesign-2026-10/flows.md` §9 and the source tree:

- **Library as the welcome** (§9.1): one lime "Open PDFs…", "Try the sample", "Combine files…", a privacy line, an aurora that brightens under a dragged file.
- **Teaching sample** (§9.2, `src/sample/`): four pages whose *text* teaches ("Select this sentence and choose Highlight…"), no overlay tour, EN/TR, `?sample` link.
- **Facts chip** (§9.3): one fact per file with an action ("No text on N pages · Recognize"), folds into ⓘ.
- **Privacy shield** (`src/privacy/PrivacyShield.tsx`): live count of external requests from Resource Timing, the enforced `connect-src`, offline status, "Kept on this device" with Clear.
- **Undo confidence**: two/three-finger tap Undo/Redo with a naming toast (`motion/gesture/multi-finger-tap.ts`), "Undo with ⌘Z" hint in toasts, *undo reveal* ring that flies to the change (`history/reveal.ts`), History scrubber, OPFS snapshots with a 20-step tail.
- **⌘K** with recents and an empty state listing capabilities; `?` shortcut overlay; keycaps on coarse pointers once a keyboard is seen.

The ideas below build on these rather than replace them.

---

## Per-app notes

### Duolingo
- **Play before you pay with data.** The first lesson starts before sign-up; moving the sign-up screen back a few steps reportedly lifted DAU about 20% ([Taplytics](https://taplytics.com/blog/duolingo-ab-test-onboarding), [ReallyGoodUX](https://www.reallygoodux.io/blog/duolingo-user-onboarding)). Recto has no account at all, which is its own version of this; the lesson is "value in the first 30 seconds".
- **Progress you can see inside the task**: the lesson progress bar fills per answer; the end card states accuracy and time; a separate "perfect" interstitial exists ([DuoLeaveMeAlone extension notes](https://chrome.google.com/webstore/detail/duoleavemealone-for-duoli/clipadhhddnpnocanhnbonnhppdibnpf?hl=en)).
- **Celebration as a designed system**: Rive state machines with idle / encouraging / celebrating states driven by triggers, not baked sequences ([Duolingo blog: visemes](https://blog.duolingo.com/world-character-visemes), [Rive: Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)); streak milestones were redesigned for more "energy" ([Duolingo: streak milestone design](https://blog.duolingo.com/streak-milestone-design-animation)).
- **Year in Review** as a personal, shareable summary ([Android Authority 2025](https://www.androidauthority.com/duolingo-year-in-review-2025-3621782)).
- **Warning**: the 2026 critique on [vc.ru](https://vc.ru/design/3017207-onboarding-duolingo-analiz-ux-i-temnyh-patternov) separates good gradual engagement from guilt-driven dark patterns. Recto should take the progress and celebration, never the guilt (no streaks, no nags).

### Arc (The Browser Company)
- **Onboarding as an "unboxing"**: a multi-step, lavishly illustrated first run that ended in a personalised membership card; the team had been onboarding people by hand on calls before building it ([Inverse interview](https://www.inverse.com/input/design/the-browser-company-arc-design-interview)).
- **Practice inside the feature**: Arc Max is introduced by a 90-second guided demo where you perform the real gesture ([OnboardMe](https://onboardme.substack.com/p/how-arc-browser-introduces-ai-max-feature)).
- **Tidy with one-click undo**: Tidy Downloads renames files and offers undo in one click ([TidBITS](https://tidbits.com/2023/10/06/arc-web-browser-introduces-focused-ai-features/)).
- **Caveat**: Arc's account requirement was called a deceptive pattern ([deceptive.design](https://www.deceptive.design/articles/arc-browsers-pushy-account-requirements)). Recto's "no account" stance is a selling point to say out loud.

### Notion
- **A page that teaches by being a page**: the "Getting Started" page is a to-do list ("Click anywhere and just start typing", "Hit / to see all the types of content…") that the user ticks off ([public copy](https://topaz-fahrenheit-b27.notion.site/Welcome-to-Notion-265e43c3a0838016a184d62551983352)).
- **Placeholder as a hint**: empty blocks show "Press '/' for commands"; empty pages offer Import / Template / Table at the bottom ([Notion help](https://www.notion.com/it/help/create-your-first-page)).

### Figma
- **Real files as the tutorial**: "Figma Basics" and "FigJam Basics" files sit in drafts on first login, built with real layers and components, not a simplified sandbox ([Supademo teardown](https://supademo.com/user-flow-examples/figma)).
- **Version history that collapses autosaves between named versions**, restorable or duplicable into a new file ([Figma blog](https://www.figma.com/blog/now-you-can-name-and-annotate-your-figma-version-history/), [help](https://help.figma.com/hc/en-us/articles/360038006754)).

### Procreate
- **Undo you can feel**: two-finger tap undoes and a banner names what was undone; *press and hold two fingers* rapidly steps back until you lift (delay adjustable 0–1.5 s) ([Procreate help: Undo and Redo](https://help.procreate.com/articles/tvicQm-undo-and-redo), [Gestures](https://help.procreate.com/procreate/handbook/interface-gestures/gestures)).
- **Accessibility companion**: a floating Undo/Redo window for people who cannot do multi-finger gestures (same help page).
- Procreate Dreams has no tour; learning happens through community tutorials and the in-app Handbook ([Procreate help](https://help.procreate.com/articles/zynkkd-community-tutorials)).

### Things 3 (Cultured Code)
- **Magic Plus**: tap for a menu, or *drag the + to where the item should land* (a project, a day in Upcoming, the Inbox); a "Jump Start" popover introduces it ([MacStories via Tools & Toys](https://toolsandtoys.net/things-3-for-ios-apple-watch-and-mac/), [9to5Mac](https://9to5mac.com/2017/05/19/friday-5-things-3-video-top-features/)).
- **Calm**: overdue tasks are not shouted in red ([MacStories, Things 3.4](https://www.macstories.net/?p=53203)). The checkbox's small spring is the celebration.

### Headspace
- **Feel the benefit before the dashboard**: a guided breathing exercise inside onboarding ([screensdesign](https://screensdesign.com/showcase/headspace-meditation-sleep)).
- **Breathing rhythm as motion**: a reconstructed spec of 4 s in / 2 s hold / 6 s out, scale 0.4→1, ease-in-out ([Blake Crosley guide](https://blakecrosley.com/de/guides/design/headspace)). A reference for *waiting* states that calm rather than nag.

### Linear
- **Undo nearly everything**, ⌘Z or "Undo" in the command menu; *undo takes you back to the page where the operation happened and re-selects the items* ([Linear changelog: Undo](https://linear.app/changelog/undo-actions)).
- **Changelog as craft**: one page per release with a hero image and a benefit-led headline ([ReleasePad](https://www.releasepad.io/blog/release-notes-examples-how-10-top-saas-companies-communicate-product-updates/)); returning users want "what changed since my last visit" ([LaunchNotes 2026](https://www.launchnotes.com/blog/release-notes-design-trends-product-teams-are-adopting-in-2026)).

### Superhuman
- **Coaching after a mouse action**: after you do something with the mouse, it nudges you with the keyboard shortcut for next time; ⌘K rows show the shortcut letter ([Superhuman help](https://help.superhuman.com/article/478-superhuman-command)).

### Apple (HIG, TipKit, system apps)
- **HIG onboarding**: let people dive in; tutorials skippable and never forced again on later launches, but easy to find later ([HIG Onboarding mirror](https://developer-rno.apple.com/design/human-interface-guidelines/patterns/onboarding)).
- **TipKit**: tips are brief and transient; rules on *events* (e.g. "used 3 times"), display frequency (daily, weekly), and invalidation when the user performs the action; tip groups shown in order ([TipKit skill summary](https://tessl.io/registry/dpearson2699/swift-ios-skills/3.9.0/files/skills/tipkit/SKILL.md)).
- **iPadOS undo HUD**: three-finger swipe shows an "Undo"/"Redo" badge, or "Nothing to Undo" ([Macworld](https://www.macworld.com/article/3410596/ios-13-and-ipados-13-how-to-use-the-new-gestures-for-cut-copy-paste-undo-and-redo.html)).
- **Safari Privacy Report**: a shield in the address bar opens a count of trackers prevented and a 30-day report with "most contacted tracker" ([AppleInsider](https://appleinsider.com/articles/21/11/08/how-to-use-safaris-privacy-report-in-macos-monterey), [MacMost](https://macmost.com/understanding-website-trackers-and-the-new-privacy-report-in-safari-14.html)). Privacy made into a number you can watch over time.
- **Accessibility Nutrition Labels** (App Store, 2025, iOS 26): developers declare VoiceOver, Voice Control, Larger Text (≥ 200%), Sufficient Contrast, Reduced Motion, Captions… ([Apple support](https://support.apple.com/123073), [Apple newsroom via BusinessWire](https://www.businesswire.com/news/home/20250513425545/en/Apple-unveils-powerful-accessibility-features-coming-later-this-year)).

### Local-first peers
- **Obsidian File recovery**: automatic snapshots every 5 min kept 7 days, stored outside the vault, device-only ([Obsidian help](https://obsidian.md/help/plugins/file-recovery)).
- **Excalidraw**: "local-first", autosave to the browser, E2E-encrypted share with the key after `#` that never reaches the server ([GitHub](https://github.com/excalidraw/excalidraw/)).

### Photo editors (undo confidence)
- Lightroom's `\` before/after and Snapseed's press-and-hold to see the original: a non-destructive promise you can *check* with one gesture (common knowledge of both apps; cited here as a pattern).

---

## Ideas for Recto (ranked)

Ranking weighs novelty in a PDF app, fit with Recto's principles (local, calm, glass, iPad + desktop) and impact. Effort: S < 1 day, M a few days, L a week or more.

### 1. "Hold to see the original" (Snapseed, Lightroom, Figma history) · novelty 5 · impact 5 · M
Press and hold on a page (two-finger long press on touch, `\` held on keyboard, or a held eye button in the ⓘ) and the page cross-fades to its state when the file was opened; release returns. A small M1 label reads "Original · opened 14:02". Works for annotations, text edits, redactions-before-apply, page rotations. Renders the base page from the bytes Recto already keeps (the virtual document model is non-destructive), so it is a second render of the same page index without the overlay layers and without the edit-run. Respect reduced motion (instant swap). Nothing like it exists in PDF apps; it makes "nothing is final until Save" tangible.

### 2. Airplane-mode proof: "Pull the plug" (Safari Privacy Report, Excalidraw) · novelty 5 · impact 4 · M
Turn the privacy promise into an experiment the user runs. The privacy popover gains "Try it offline": it explains "Turn off Wi-Fi and keep working". Recto listens to `online`/`offline`; when the device goes offline with a document open, the shield does a single lime breath and a toast reads "You're offline. Everything still works: nothing here needs the internet." Add a running device-local ledger: "Since you started using Recto: 37 files opened, 1.2 GB processed, **0 bytes sent**" (counts kept in IndexedDB, bytes from `File.size`; sent bytes from Resource Timing cross-origin entries, which the shield already measures). A 30-day sparkline like Safari's report. All local, nothing to fetch.

### 3. The sample that ticks itself (Notion Getting Started, Duolingo progress) · novelty 4 · impact 5 · M
The teaching sample's instructions become a live checklist. Each instruction line on the sample pages carries an empty ring drawn by the app layer (not burnt into the PDF); when the user performs the act (a Highlight command on page 1, a pen stroke, filling the checkbox, Recognize text, a thumbnail drag), the ring fills with a lime check and a Things-like spring. A small "3 of 6" pill in the page pill area; at 6/6 the sample's last page shows "You know the basics" and the Library card gets a quiet tick. Implement by mapping command ids from `commandRegistry` events to sample anchors stored next to `sample-file.ts`; only active on the sample document (by its hash).

### 4. Errors at the fingertip: failures that teach in place (Apple HIG, Notion) · novelty 4 · impact 5 · M
The three most common PDF failures get an answer where the finger is, not a toast elsewhere:
- *Select or highlight on a scanned page* → a ghost highlighter swipe animates where the user dragged, and an anchored M1 chip: "This page is a picture of text. Recognize it on this device (~5 s)". Option to OCR **only the dragged region first** so the highlight lands immediately, then the rest in the background.
- *Edit on a signed/locked file* → the lock glyph slides to the pointer with "Signed by … — changes would break the signature. Save a copy to edit".
- *Typing into a non-field area of a flat form* → "No field here. Add a text box at this spot" with the box pre-placed.
Each chip uses the facts-chip component and fires at most once per file per act (TipKit-style invalidation).

### 5. Two-finger hold to rewind (Procreate rapid undo) · novelty 4 · impact 4 · S–M
Recto already has two-finger tap Undo with a naming toast. Add Procreate's hold: two fingers down and still for 400 ms starts stepping back at an accelerating rate (250 ms → 80 ms per step), the naming HUD counts ("Undo 4 · Highlight on p. 3"), the *undo reveal* follows each step, lifting stops. Sliding the two fingers sideways while held hands off to the History scrubber for fine control. Setting: rewind delay (0–1.5 s) in Settings → Markup, plus Procreate's accessibility "Undo companion" (a small floating Undo/Redo glass pair) for people who cannot do multi-finger gestures. Built on `motion/gesture/arena.ts` as a new recogniser.

### 6. A tip engine with TipKit's rules (Apple TipKit) · novelty 3 · impact 4 · M
A tiny local engine: tips declare `events` (e.g. `highlight.created` count ≥ 5), `rules` (fine pointer, not in Lock, not the first minute), `displayFrequency` (at most one tip per session, one per day), and are **invalidated** when the user performs the taught action. Stored per device in `localStorage` (convenience state, try/catch). Popover tips anchor to the control (M1 glass, one line, an optional "Show me" that plays a 2 s CSS demo loop). Settings → "Tips: On · Off · Reset". This is the infrastructure for ideas 7, 8 and 12, and it keeps the spec's "no overlay tour" rule intact.

### 7. Faster-way coaching (Superhuman) · novelty 3 · impact 4 · S
After the third pointer use of a command that has a shortcut or gesture, show one quiet line in the toast slot: "Next time: press H" (desktop) or "Next time: two-finger tap undoes" (touch). Never more than once per command; never during ink. Keycaps from `ui/Keycaps`. Pairs with a "Skills" view in the `?` overlay (idea 12).

### 8. Calm completion moments (Things checkbox, Duolingo end card) · novelty 4 · impact 4 · M
Celebrate the end of real jobs, with one spring and no confetti:
- **Form complete**: the Fill & sign progress ring closes; the dock morphs to "All 9 fields filled · Save a copy"; required fields still empty pulse once when you try to leave.
- **Signature placed**: the ink "dries": a single specular sweep along the stroke (the light layer's "only light glows"), 600 ms.
- **Redaction applied**: a receipt card: "3 areas removed · searched the file: 0 matches remain", a verification the engine runs locally.
- **Export**: the saved file's card in the Library gets a one-time lit edge and "Saved on this device · 0 bytes uploaded".
Rive-like state switching implemented with the in-house spring catalogue (`motion/catalogue.ts`); reduced motion gives the text only.

### 9. Form progress path (Duolingo lesson bar) · novelty 3 · impact 5 · M
While filling, the page pill shows "4 / 9 fields · 2 required left"; Tab, Return and a Pencil double-tap jump to the next empty field with the page flying to it; a thin progress line along the capsule. On iPad, a "Next field" key above the software keyboard (via the form's `enterkeyhint="next"`). Reads field metadata already in `src/forms/`.

### 10. In-app help that answers inside ⌘K (Procreate Handbook, Arc Command Bar) · novelty 4 · impact 4 · M
Typing a question into ⌘K ("how do I sign", "imza nasıl") shows a help card above the commands: two sentences, a 3-second looping demo (inline SVG/CSS animation, not video), and a **Do it** button that runs the command on the current document. Help entries are a bundled JSON in EN/TR (Paraglide), searched with the existing palette ranking. Fully offline. Most PDF apps send you to a website for help.

### 11. Empty states built from the document (Notion placeholder) · novelty 4 · impact 3 · S–M
Empty panels suggest from the open file, computed locally: Find's empty state lists "Try: *Invoice*, *Ankara*, *2025*" from the document's most frequent capitalised words; empty Comments shows "Highlights and notes on this document appear here. Select text on page 1 to start" with the first text line as a target that glows on hover; empty Outline offers "Make contents from headings" (font-size heuristics). Each suggestion is one tap.

### 12. Shortcut and gesture "Skills" (Duolingo skill tree, Superhuman) · novelty 4 · impact 3 · S
The `?` overlay marks shortcuts and gestures the person has already used with a filled lime dot, and highlights one "Next to learn" based on their most frequent pointer-driven command. A one-line footer: "You use 12 of 48 shortcuts". Counts per device only. No points, no streaks.

### 13. Local "Year in Recto" (Duolingo Year in Review) · novelty 5 · impact 2 · M
From December, the Library ⋯ offers "Your year in Recto": pages read, ink drawn (in metres, from stroke lengths), forms filled, signatures, pages arranged, the hours saved by Batch. Generated on device; the share image is a canvas render the user saves themselves. The punchline is the privacy story: "We can't see any of this. Only you can." Off when Recents are cleared.

### 14. What's new, shipped inside the build (Linear changelog, Apple What's New) · novelty 3 · impact 3 · S
When the service worker activates a new version, the Library shows one card: "New in 1.4" with at most three items, each with "Show me" that opens the sample at the relevant page and fires the matching tip from idea 6. Notes are bundled JSON (no fetch); About → Release notes lists all. Shown once, dismissible, never modal; returning users see "since your last visit" by comparing the stored last-seen version.

### 15. One-question welcome (Duolingo goal survey, Headspace) · novelty 3 · impact 3 · S
In the empty Library, an optional row of chips under the launcher: "What brings you here? Read & study · Fill & sign · Arrange pages · Mark up". Picking one reorders the launcher's secondary actions, chooses which sample page opens first, and pre-orders ⌘K's empty state. Stored per device; skipped by default; never asked again. No modal, no account.

### 16. Breathing waits for long local jobs (Headspace) · novelty 3 · impact 3 · S
OCR, compress and big merges replace spinners with the aurora's slow 4-2-6 breath behind an honest progress line ("Recognising page 7 of 40 · on this device, using 4 cores"), and the job keeps running if the user goes back to reading (the jobs system already exists in `src/jobs/`). Ends with the completion moment from idea 8.

### 17. Accessibility label and chrome text size (App Store Accessibility Nutrition Labels, Dynamic Type) · novelty 4 · impact 4 · M
Settings → Accessibility shows Recto's own "nutrition label": VoiceOver/screen readers, keyboard only, Larger text up to 200%, Sufficient contrast, Reduced motion, each with a live status ("On in your system" from `prefers-reduced-motion`, `prefers-contrast`) and a link to the relevant setting. Add a chrome **Text size** control (85–200%) that scales the `--type-*` tokens, with layouts tested at 200% (the A-gates already run in CI). No PDF app publishes this, and it signals care to the accessibility community.

---

## Principles to keep

- Teach in the work, not over it (no overlay tour, per §9.2). Tips are anchored, single, and expire.
- Celebrate completion of real jobs, never streaks or guilt.
- Make privacy something you can test (offline), count (0 bytes) and see over time.
- Make undo something you can feel (hold to rewind) and verify (hold to see the original).
