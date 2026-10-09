# Motion and interaction: research track (R12)

Track: motion-interaction. Date: 2026-10-09.
Scope: Apple Liquid Glass (iOS/iPadOS/macOS 26), Material 3 Expressive, Family, Things 3, Arc, Linear, Rive, Stripe/Vercel-style web interaction, and the web platform features that carry them (View Transitions, scroll-driven animations, WAAPI, anchor positioning, `@starting-style`, `linear()`).

## What Recto already has (so we do not re-propose it)

A quick read of `apps/web/src` shows Recto's motion is already well past most web apps:

- Seven springs written as `linear()` curves, four eases, reduced motion per token (`styles/motion.css`, `motion/tokens.ts`), and a script spring core that hands off velocity when retargeted (`motion/animate.ts`).
- The capsule's *bar morph*: one glass element changes its own width and height on a spring and fades its contents through, with FLIP for shared pieces (`shell/capsule/capsule-morph.ts`).
- A View Transition (240 ms) in and out of the Pages grid, where the page morphs into its cell (`stage/grid/grid-transition.ts`), plus a sheet push, a ring flash and fold catalogue (`motion/catalogue.ts`).
- Hide on scroll for compact sizes, a soft scroll edge under the strip, a touch page scrubber, pinch detents and pinch-to-open in the grid, a history scrubber, a pen hover cursor, and a WebGL aurora that moves on events.

So the gaps are not "add springs". They are: **gesture-driven (scrubbed) transitions**, **peek/preview patterns**, **drag-to-create**, **stateful glyphs**, **light that answers input**, and **using the newest platform features (element-scoped View Transitions, scroll-driven timelines) to make things cheaper and more continuous**.

---

## 1. Apple Liquid Glass (iOS / iPadOS / macOS 26)

What it does, concretely:

- **Tab bar minimise on scroll.** `tabBarMinimizeBehavior(.onScrollDown)` shrinks the floating tab bar as you scroll down and brings it back on scroll up. A **bottom accessory** (the Music mini-player) moves down to sit *inline* beside the minimised bar, and reads `tabViewBottomAccessoryPlacement` to show a smaller layout in that state.
- **Toolbars that morph.** Apple's iPadOS 26 feature sheet: Liquid Glass toolbars in Mail, Notes and Messages "fluidly morph as you need access to more tools or move through different views".
- **Glass that merges.** In SwiftUI, `GlassEffectContainer(spacing:)` groups glass shapes; when two shapes come within `spacing` they visually blend like liquid, and `glassEffectID(_:in:)` makes one glass shape morph into another across a state change. `glassEffectUnion` joins separate controls into one capsule.
- **Concentric shapes.** Sheets at smaller heights pull their bottom corners in to nest inside the display's own curve; controls inside a container use radius = container radius − inset.
- **Content flows under chrome** (Safari: the page runs under the toolbar) with a scroll edge effect.
- **iPadOS 26 menu bar** you reach by swiping down from the top edge or pointing at it, with **search inside the menu**; **Preview comes to iPad** as a Pencil-first PDF app with AutoFill for forms.

Web equivalents: transform-only show/hide and width morphs (Recto already does), scroll-driven timelines (Safari 26 supports `animation-timeline`), `interpolate-size: allow-keywords` (Chromium only, progressive), and a single-element shape for merges (see Idea 6).

## 2. Material 3 Expressive

- Springs replace duration/easing for spatial motion, split into *spatial* and *effects* springs (Recto's spring/ease split already matches this).
- **Button groups with neighbour squish**: pressing one button widens it and the neighbours give up width; a toggled button **morphs shape** (round to squircle) to show it is on.
- **Split button** (primary action + a separate chevron menu) and the **FAB menu** that morphs the FAB into a vertical list of actions.
- **Shape morph** as a state indicator (loading indicator morphing through a set of shapes).

Web: width changes inside a flex row on the existing spring tokens; `border-radius` change on the pressed/selected state; CSS `shape()` / `clip-path` only on solid pieces (Recto's Q-6 forbids clip-path on glass).

## 3. Family (wallet, Los Feliz Engineering / Benji Taylor)

Widely cited as the most fluid consumer app of its era: "trays" (bottom sheets) that **resize to their content on a spring** between steps instead of pushing a new screen, numbers that **roll digit by digit**, and every confirmation as a deliberate, physical moment. Its stated aim was "thoughtful, design-first details" for beginners and experts alike.

Web: the tray is a sheet whose height animates between content sizes (measure, then spring the height; `interpolate-size` where present); the rolling digits are per-digit columns translated on a spring.

## 4. Things 3

- **Magic Plus**: a floating + button you **drag to where the new thing should go**. Dropping between to-dos inserts there; on the Inbox target it files to the Inbox; on the left edge of a project it makes a heading; on a day in Upcoming it sets the date. The drop position *is* the argument.
- Satisfying completion: the checkbox fills, the row lingers, then collapses.

## 5. Arc (The Browser Company)

- **Peek**: links from pinned tabs open in a floating preview over the current page instead of switching tabs; one gesture promotes it to a full tab.
- **Little Arc**: a small throwaway window for a quick visit.
- **Split View** made by **dragging a tab to the middle of the window**; the split becomes its own tab you can come back to.
- **Command bar** that does "anything a mouse can do", including actions and settings.

## 6. Linear

- The command menu **moved next to the element that invoked it** (a contextual menu that is still searchable), and groups are prioritised by the current view.
- **Live key feedback**: shortcut hints in tooltips highlight the modifier keys you are already holding, confirming you are on track.
- Searchable shortcut help on `?`; a 2026 refresh dims the sidebar to put content first.

## 7. Rive-powered UI

State-machine animations bound to data (Rive's **data binding / ViewModels** replaced the old inputs system). Typical use: **icons that animate between states** (play/pause, a bell that rings, a lock whose shackle drops) and respond to hover and press. Rive itself would be a new dependency (forbidden in Recto), but the idea transfers: stateful glyphs made from Phosphor SVG paths animated with WAAPI.

## 8. Stripe / Vercel web interaction

Velocity-aware gestures (a flicked element keeps its speed into the spring), magnetic hover on buttons, pointer-tracked light on cards ("spotlight" borders), numeric tickers, and staged entrances. All are WAAPI + CSS custom properties set from pointer events, which fit Recto's motion core.

## 9. Web platform status (late 2026)

- **Scroll-driven animations** (`animation-timeline: scroll()/view()`): Chrome/Edge 115+, Safari 26; Firefox behind a flag. `animation-trigger` is Chromium only.
- **Element-scoped View Transitions** (`Element.startViewTransition()`): Chrome 147 (March 2026). Concurrent and nested transitions, only the subtree is captured, the rest stays live. Progressive enhancement elsewhere.
- **Anchor positioning**: reported as Baseline in 2026 (Interop 2026); keep the JS fallback where a target engine lags.
- **`interpolate-size`**: Chromium only; treat as progressive.
- **Pencil hover** reaches Safari as `pointermove` with `pointerType: 'pen'` on hover-capable iPads (Recto already uses it for the cursor).

---

## Ideas for Recto (ranked)

Rank = impact × novelty ÷ effort, adjusted for fit with Recto's principles (local, calm glass, Q-1…Q-14).

1. **Link Peek** (Arc). Tapping an internal link (go-to-page, footnote, figure reference, table of contents entry) opens a glass peek card showing the *target region* of the target page at reading size, anchored to the link. Tap the card, or press-and-hold-and-release on the link, to go there with a shared-element morph (the card grows into the page). Esc or tap away keeps your place. Footnotes and citations in academic PDFs become readable without losing your place. Feasible: the `LinkLayer` already resolves `targetPageIndex`; render the target page region from the existing tile cache into a small canvas; anchor the popover with anchor positioning / Base UI Popover; the "go" morph is a View Transition with the card and the page named. Destination point (`/XYZ` top) gives the region.
2. **Pinch-scrubbed Pages grid** (iOS Photos, Liquid Glass gesture-driven transitions). Today the way into the grid is a 240 ms View Transition after a key or button, and pinch-to-open exists inside the grid. Make it continuous both ways: a two-finger pinch-in below fit *scrubs* the page-to-cell morph with the fingers (progress = scale), and on release it commits or springs back by velocity (the spring core already hands off velocity). Feasible: drive WAAPI animations on the page and its target cell with `currentTime` set from the pinch (manual FLIP, not a VT, because VTs cannot be scrubbed by pointer yet); the cell positions come from the grid layout math without rendering the grid.
3. **Drag-to-create from the capsule** (Things 3 Magic Plus). Long-press-drag a Note, Text box, Signature or Stamp out of the markup palette and drop it *where it should go*: on a page it is created at the drop point at the right size; between two cells in the Pages grid a "+ blank page" is inserted there; on the sidebar's page list it adds the note to that page. A drop indicator shows the result before release. Feasible: the app has a drag arena (`motion/gesture/arena.ts`) and grid DnD; creation goes through the existing commands with the drop point as argument.
4. **Ink-in signature and stamp placement** (Things 3 completion, Family's physical confirms). When a saved signature is placed, it *writes itself* once along its stroke order (≈450 ms) before settling; stamps land with a short press scale and a brief lime rim. Feasible: saved signatures are ink paths; animate `stroke-dashoffset` per stroke in an SVG overlay, then swap to the real annotation. Reduced motion: appears at once.
5. **Hold-to-apply for destructive acts** (Family-style deliberate confirmation). "Apply redactions", "Remove pages" and "Flatten" use a press-and-hold button whose lime fill sweeps across in 600 ms; releasing early springs it back. One tap shows "Hold to apply" in the button. Keyboard: Enter held, or Enter then confirm. Replaces a modal confirm with a physical one that is still impossible to trigger by accident.
6. **Glass that merges and splits** (Liquid Glass `GlassEffectContainer`). When the ink strip's colour panel opens from a swatch, or the page pill sits next to the minimised capsule, the two pieces join through a neck rather than appearing as two boxes. On the web, without breaking Q-1 (one backdrop root) or Q-6 (no clip-path on glass): draw the joined shape as **one** glass element whose size spans both pieces with the neck as an SVG mask on a solid-backed layer, or limit the effect to Solid rendering. Effort is real; start with the page pill docking into the capsule (Idea 7) where a single element can morph.
7. **Reading mode: the capsule minimises and the page pill rides inline** (iOS 26 tab bar + bottom accessory). On tablet and desktop while reading (not only compact), after a sustained scroll the dock shrinks to a small glass pill with the current mode glyph, and the page pill slides into the same row as its accessory. Scroll up or hover the bottom edge to expand. Feasible: extend `hide-on-scroll.ts` with a "minimised" state rather than hidden, and use the existing bar morph for the width change.
8. **Odometer page number and progress rim** (Family digits, scroll-driven). The page pill's number rolls digit by digit as pages pass, and a thin lime arc along the pill's rim shows progress through the document, linked to scroll with `animation-timeline: scroll()` so it costs no JS on scroll (Safari 26 / Chromium; static fallback). Digits on a spring through the motion core when jumping.
9. **Stateful glyphs** (Rive-style, no dependency). Tool icons answer their state: the pen nib makes a small stroke when chosen, the highlighter swipes, the eraser rubs, the lock shackle drops when Lock engages, Save draws a check. 180–300 ms, once, then idle (Q-10). Made from Phosphor SVGs with WAAPI on path transforms and `stroke-dashoffset`.
10. **Split read by dragging the page pill** (Arc Split View). Drag the page pill (or a tab) to the right half of the stage to open a second, independent view of the same or another document side by side; the split is kept per tab. Useful for reading a paper while looking at its figures or references. Compare already exists as a place; this is lighter, ad hoc, and gesture-made.
11. **Contextual command menu with live keys** (Linear). Cmd+K opened while a page, annotation or selection is focused opens the palette next to it, filtered to what applies; tooltips and the `?` overlay highlight modifier keys already held (hold Shift and every Shift shortcut lights up). Feasible: `commands/keymap.ts` has the map; track held modifiers on `keydown/keyup` while a tooltip or the overlay is open.
12. **Pencil-hover light on glass** (Liquid Glass specular + Stripe spotlight). The rim highlight of the nearest glass piece follows the pointer or a hovering Pencil: a soft radial light on the hairline, set as CSS custom properties from `pointermove` only while the pointer is near chrome, nothing at rest. Fits "only light glows". The aurora can lean faintly toward the Pencil while it hovers over the page in Markup.
13. **Neighbour squish and shape-morph selection in the ink strip** (Material 3 Expressive). The pressed swatch or tool widens slightly while neighbours give way, and the selected tool's well morphs from circle to squircle. Small, tactile, and readable at a glance on touch.
14. **Element-scoped View Transitions for live reorders** (Chrome 147). Reordering in the sidebar page list or Find results runs a scoped transition on that list only, so the page view keeps scrolling and inking during it, and two reorders can overlap. Fall back to the existing FLIP elsewhere.
15. **Content-sized trays** (Family). Multi-step sheets (Save a copy, Batch, Compress, OCR) resize to each step's content height on `--spring-smooth` instead of keeping the tallest height; the primary button stays pinned and morphs its label ("Compress" → "Compressing 42 %" → "Saved 3.1 MB").
16. **Scroll-linked grid depth** (scroll-driven `view()` timelines). In the Pages grid, cells entering and leaving the scrollport fade and scale by 2–3 % at the edges, and the soft edge deepens with scroll speed. Pure CSS, zero JS, off under reduced motion.
17. **Concentric corners on iPad** (Liquid Glass). Bottom sheets and the capsule on iPad nest into the display's corner radius when they reach the bottom edge (use `env(safe-area-inset-bottom) > 0` as the cue, then a larger bottom radius), and inner controls compute radius = outer − inset from one token.
18. **Menu search in the title menu** (iPadOS 26 menu bar). Typing while the title menu is open filters its items and also shows matching commands from the palette, so the menu doubles as a discoverable command search on touch.

## Sources

- MacStories, iOS and iPadOS 26 review, buttons/toolbars/tab bars: https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/3
- WWDC25 session 323 notes (tab bar minimise, bottom accessory): https://nonstrict.eu/wwdcindex/wwdc2025/323/
- WWDC25 session 284 notes: https://nonstrict.eu/wwdcindex/wwdc2025/284/
- Create with Swift, collapsing tab bar: https://www.createwithswift.com/making-the-tab-bar-collapse-while-scrolling/
- Create with Swift, bottom accessory: https://www.createwithswift.com/enhancing-the-tab-bar-with-a-bottom-accessory/
- Donny Wals, tab bars on iOS 26: https://www.donnywals.com/exploring-tab-bars-on-ios-26-with-liquid-glass/
- Apple, All new features iPadOS 26: https://images.apple.com/ph/os/pdf/All_New_Features_iPadOS_26_Sept_2025.pdf
- Create with Swift, glassEffectID morphing: https://www.createwithswift.com/morphing-glass-effect-elements-into-one-another-with-glasseffectid/
- Liquid Glass in Swift best practices: https://dev.to/diskcleankit/liquid-glass-in-swift-official-best-practices-for-ios-26-macos-tahoe-1coo
- iPadOS 26 press release (menu bar, Preview on iPad): https://www.businesswire.com/news/home/20250609061451/en
- iPadOS 26 hands-on (iPad mini): https://ark.beehiiv.com/p/i-tested-ipados-26-on-the-ipad-mini-7-surprising-things-apple-didnt-tell-you
- Material 3 Expressive component ports (button groups, split button, shape morph): https://pub.dev/packages/m3e_buttons , https://pub.dev/documentation/material_3_expressive/1.0.8/
- Family launch post: https://family.co/blog/launch
- Family case study credits: https://algo.tv/family-crypto-wallet
- Things support, Magic Plus: https://www.culturedcode.com/things/support/articles/2803582
- MacStories, Things 3 review: https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- Arc, master multitasking (Split View, Peek): https://start.arc.net/master-multitasking
- SlashGear, Arc features: https://www.slashgear.com/1634601/best-arc-browser-features/
- Linear, contextual command menu: https://linear.app/changelog/2019-10-07-contextual-command-menu
- Linear, how we redesigned the UI: https://linear.app/blog/how-we-redesigned-the-linear-ui
- Unsung, Linear's visual key feedback: https://unsung.aresluna.org/tags/linear/
- Rive data binding (web): https://rive.app/docs/runtimes/web/data-binding.md
- Rive inputs deprecation: https://rive.app/docs/runtimes/inputs
- Chrome, scroll-driven animations: https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- ICS Media, scroll-driven animations support (Safari 26): https://ics.media/en/entry/230718/
- Chrome, element-scoped view transitions: https://developer.chrome.com/blog/element-scoped-view-transitions
- Chrome, animate to height auto (`interpolate-size`): https://developer.chrome.com/docs/css-ui/animate-to-height-auto
- Interop 2026 overview: https://ecorpit.com/interop-2026-web-platform-developer-guide/
