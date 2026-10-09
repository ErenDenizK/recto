# Research track: writing and productivity apps

Track R12 · writing-productivity · 2026-10-09

Scope: iA Writer, Craft, Notion, Bear 2, Obsidian, Ulysses, Things 3, Linear, Arc / Dia,
Raycast, Superhuman. Goal: name concrete interactions these apps get right and map them onto
Recto's real areas, without repeating what Recto already has.

**What Recto already has (so not proposed again):** ⌘K palette with fuzzy match, recents,
dimmed rows with a reason, a selection boost, and "bare number goes to page"
(`shell/CommandPalette.tsx`, redesign §6.13); `?` shortcut overlay with key map v2
(`commands/keymap.ts`); Focus that hides the dock and pill (`shell/frame/focus-mode.ts`);
visible Undo plus a history scrubber (`history/`); Batch with saved recipes (`batch/recipes-store.ts`);
the Review list of comments, marks and fields (`shell/review/`); the teaching sample and the Library.

Method note: web fetches of vendor sites were blocked by DNS in this sandbox, so facts come from
search-indexed vendor pages (help centres, changelogs, blogs) and reviews. Where only
third-party analysis was available, it is marked as such.

---

## Things 3 (Cultured Code)

- **Magic Plus.** A floating + button. Tap opens a create menu; *drag* it into the list and the
  new item is inserted exactly where you drop it; drag it to the Inbox corner to file it there;
  drag it to the left edge of a project to create a heading. The control is the destination
  picker. ([Cultured Code support](https://www.culturedcode.com/things/support/articles/2803582),
  [9to5Mac](https://9to5mac.com/?p=482567))
- **Pointer snap.** On iPad with a trackpad, the cursor snaps to the Magic Plus and the button
  grows, signalling "grab me". ([MacStories](https://www.macstories.net/reviews/things-for-ipad-adds-enhanced-cursor-support-with-context-menus-and-special-clicks/))
- **Type Travel.** Outside a text field, just start typing a destination name and a popover
  appears with matches; Enter goes there. No shortcut needed first.
  ([Things blog](https://culturedcode.com/things/blog/2018/05/desktop-class-productivity-for-ipad/),
  [9to5Mac](https://9to5mac.com/2018/05/28/things-3-6-type-travel-ipad-keyboard/))
- **Natural-language dates** in the When / Deadline pickers ("tues 8am", "17 days from July 9"),
  in eight languages. ([Cultured Code](https://culturedcode.com/things/support/articles/9780167/))
- **Completion.** Staged checkbox fill, check scales, row slides away, gap closes; soft sound and
  haptic (third-party analysis: [design study](https://blakecrosley.com/blog/design-study-things)).

## Raycast

- **Action Panel.** ⌘K on the *selected item* opens every action for it; the first action is ↵,
  the second ⌘↵, and the panel is searchable. Global search and per-item actions share one
  surface. ([Developer docs](https://developers.raycast.com/api-reference/user-interface/action-panel),
  [Manual](https://manual.raycast.com/action-panel))
- **Arguments and dynamic placeholders.** Quicklinks and commands take inline argument pills
  (Tab between them); snippets expand `{clipboard}`, `{date}`, `{time}`, `{uuid}`.
  ([Changelog](https://www.raycast.com/changelog/windows/0-24), [Changelog index](https://www.raycast.com/changelog/macos))
- **Raycast Notes** (formerly Floating Notes): an always-on-top note window that auto-resizes to
  its content, ⌘P note switcher, ⌘K note actions, export to Markdown.
  ([Raycast blog](https://raycast.com/blog/raycast-notes), [MacStories](https://www.macstories.net/reviews/raycast-overhauls-its-notes-feature/))
- 2026: Raycast 2.x adds Screen Awareness and agentic AI Chat (cloud, so out of scope for Recto).

## Superhuman

- **100 ms rule, aiming for < 50 ms**, and a renderer that shows a message in 1–2 frames.
  "Measure everything you want to make fast." ([Superhuman blog](https://blog.superhuman.com/superhuman-is-built-for-speed/))
- **Superhuman Command (⌘K) teaches its own shortcuts**: every result shows its key, so users
  graduate from the palette. Onboarding drills habits on a synthetic inbox (third-party
  analysis: [design study](https://blakecrosley.com/guides/design/superhuman)).
- **Inbox zero reward**: a hand-picked photograph on an empty inbox; "Get Me To Zero" bulk-marks
  old mail done. ([Review](https://nicklafferty.com/reviews/gmail-vs-superhuman/),
  [transcript](https://gotranscript.com/public/how-superhuman-mail-uses-ai-to-achieve-inbox-zero))
- **Snippets** that fill the recipient's name and CC automatically.
  ([Tom's Guide](https://www.tomsguide.com/ai/superhuman-email-can-generate-emails-send-reminders-and-more-heres-how-to-sign-up))

## Linear

- **Peek**: press Space to preview the focused issue in place, Space again to close; *hold*
  Space for a peek that lasts only while held. ([Linear docs](https://linear.app/docs/peek.md))
- **Two-key "go to" sequences** (G then I, G then M) and a `?` list.
  ([Linear guide](https://linear.app/enablement/guides/navigating-linear))
- **Hover shows the shortcut**, mostly single letters; optimistic local-first updates that never
  wait for the network. ([Linear](https://linear.app/features/level-up),
  [design breakdown](https://www.925studios.co/blog/linear-design-breakdown-saas-ui-2026))

## iA Writer

- **Focus Mode**: Sentence, Paragraph or Typewriter. Sentence/Paragraph dim everything but the
  active unit; Typewriter keeps the caret vertically centred.
  ([iA support](https://ia.net/writer/support/editor/style-check))
- **Style Check** runs locally, no AI: fillers, redundancies and clichés struck through *on screen
  only*, never in export; per-category toggles and custom patterns. ([iA](https://ia.net/writer/support/editor/style-check),
  [Introducing Style Check](https://ia.net/topics/introducing-style-check))
- **Authorship (7.x)**: your own typing is full contrast, AI or pasted text is dimmed, another
  human's edits are underlined; 7.3 lets AI text "burst onto the page" with a gradient.
  Annotations ride at the end of the file. ([iA version history](https://ia.net/writer/support/help/version-history/release-notes-ipad))

## Ulysses

- **Typewriter mode** with dimmed surroundings; **goals** shown as a ring that fills toward a
  target, with deadlines. Late-2025 Liquid Glass redesign with resizable iPad panels
  (secondary source). ([Macworld](https://www.macworld.com/article/3278249/ulysses-13-review-for-mac-and-ios.html),
  [ScribeCount](https://scribecount.com/author-resource/writing-tools-for-authors/ulysses))

## Notion

- **Slash menu**: "/" at the caret hides 50+ block types behind one key; typing filters
  ("/head", "/table"). **Six-dot block handle** fades in on hover, drags any block, and opens
  "Turn into"; dragging a block to the far edge makes columns.
  ([Notion help](https://www.notion.com/en-gb/help/guides/transforming-content-blocks-in-notion),
  [release notes](https://www.notion.com/ar/releases/2022-07-20))
- **Side peek / Center peek / Full page**: how a linked page opens, chosen per view.
  ([Notion release notes](https://www.notion.com/de/releases/2022-07-20))

## Craft

- **Focus mode** hides sidebars and header; **Daily notes** from a sidebar calendar; Sketch
  block with Pencil; **Scribble** handwriting anywhere becomes text; Whiteboards v1.0 (late 2025).
  ([Craft daily notes](https://support.craft.do/en/plan-and-do/daily-notes),
  [Craft drawings](https://support.craft.do/en/write-and-edit/drawings),
  [App Store](https://apps.apple.com/us/app/craft-docs-notes-tasks-ai/id1487937127))

## Bear 2

- **Hide Markdown**: markup vanishes until the word is selected. Custom **Bear Sans** typeface,
  TagCons (2.7, 2026). **OCR search inside images and PDFs**, highlighting the attachment that
  matched (but not *where* in the PDF: "Bear is not a PDF reader").
  ([What's new](https://bear.app/faq/whats-new-in-bear-2/),
  [Bear 2.7](https://blog.bear.app/2026/03/bear-2-7-a-fresh-look-for-tagcons/),
  [Bear Beyond Text](https://blog.bear.app/2026/04/bear-beyond-text-working-with-images-pdfs-and-more/),
  [Search FAQ](https://www.bear.app/faq/how-to-search-text-inside-notes-in-bear))

## Obsidian

- **Command palette** with *pinned commands* at the top (useful on mobile) and hotkeys per
  command. **Page preview** popover on hover (community Hover Editor makes it editable). **Bases**
  (2025): local-file database views (table, cards). ([Obsidian help](https://obsidian.md/help/plugins/command-palette),
  [Hover Editor](https://community.obsidian.md/plugins/obsidian-hover-editor),
  [Bases](https://alternativeto.net/news/2025/8/obsidian-launches-new-bases-plugin-for-database-workflows-and-property-format-changes))

## Arc / Dia (The Browser Company)

- **Peek**: links from pinned tabs open in a floating preview instead of a new tab. **Little Arc**:
  a small throwaway window. **Split View**: drag a tab to the middle of the screen, up to four.
  **Air Traffic Control** routes links to a Space. Arc frozen May 2025 for Dia; Dia's
  "chat with tabs" and Skills ("/" shortcuts) are cloud AI.
  ([Arc Split View help](https://resources.arc.net/hc/en-us/articles/19335393146775-Split-View-View-Multiple-Tabs-at-Once),
  [SlashGear](https://www.slashgear.com/1634601/best-arc-browser-features/),
  [TechCrunch on Dia](https://techcrunch.com/2025/06/11/the-browser-company-launches-its-ai-first-browser-dia-in-beta),
  [iGeeksBlog](https://www.igeeksblog.com/dia-ai-browser-mac-launch/))

---

## Ideas for Recto (ranked)

Ranked by (impact × novelty) against effort. N = novelty in a PDF app (5 = unseen),
I = impact, E = effort.

1. **Peek: hold Space (or hover / long-press) on a link, citation, outline row or Find hit**
   (Linear Peek, Arc Peek, Notion side peek, Obsidian page preview). N5 I5 E M.
   A glass card renders the *destination region* ("Figure 3", "[12] Smith 2021") at the cursor
   without moving the reading position. Tap Space = pinned peek; hold = transient; ↵ jumps.
   PDFium gives link destinations; render a clip in the worker; anchor with the M4 menu material.
2. **Drag-to-place Plus** (Things Magic Plus). N5 I4 E M. Tap the capsule's + for a menu; drag
   it onto a page to drop a note/text/stamp/signature exactly there; drag into a gap in the
   Pages grid or PagesBar to insert a blank page or file *at that position*. Pointer Events +
   the existing `dnd/` and spring tokens; snaps to text lines.
3. **Action Panel on the target** (Raycast ⌘K per item, ↵ / ⌘↵). N4 I4 E M. With a highlight,
   page or field selected, ⌘K opens scoped to it with a removable scope chip ("Highlight · p.4 ×",
   Backspace widens to global). ↵ primary, ⌘↵ secondary; on touch the same list from long-press.
4. **Changes lens** (iA Writer authorship). N5 I4 E M. One toggle dims the original page content
   and shows everything *you* added or changed at full contrast (marks, edited text, filled
   fields, inserted/moved pages, redactions), with a count. Built from the virtual document model
   and history; ideal before Save a copy or sending.
5. **Commands with arguments and natural ranges** (Raycast arguments). N4 I4 E M. "rotate 3-7
   right", "extract 2, 5-9", "delete even", "zoom 150", "go to Methods"; Tab fills argument pills;
   EN and TR grammar ("3-7 sağa döndür"). Pure parser in `commands/`.
6. **Smart text: placeholders and natural dates** (Raycast snippets, Things NL dates,
   Superhuman snippets). N4 I4 E S–M. Text boxes and form fields expand `{today}`, `{today+14}`,
   `{initials}`, `{page}/{pages}`; date fields accept "next fri" / "gelecek cuma" and format to the
   field's AFDate mask. Saved snippets sit beside saved signatures.
7. **Cross-file search in the Library** (Bear OCR search, but finishing what Bear won't).
   N4 I4 E M. A local full-text index (IndexedDB/OPFS) of kept files including OCR text; results
   are page thumbnails with the hit highlighted, opening on that page.
8. **Scratch note** (Raycast Notes, Little Arc, Craft daily notes). N4 I4 E M. A floating glass
   note per document; drag text or a lasso clip into it (clips keep a back-link to the page);
   export as Markdown or append as a final "Notes" page / PDF comment.
9. **Reading focus: line band and typewriter stepping** (iA Focus, Ulysses typewriter).
   N4 I3 E M. Extends Focus: dim all but the current paragraph from the text layer geometry; ↑/↓
   step one line and keep it at the reading height. Off by default; reduced-motion aware.
10. **Page handle in reading view** (Notion six-dot handle). N4 I4 E L. In the margin of a page
    a grip fades in on hover; drag reorders right in the scroll (the page shrinks to a thumbnail
    mid-drag); the grip's menu holds "Turn into" acts: rotate, duplicate, extract, split here.
11. **"/" insert at the pointer** (Notion slash menu, Dia Skills). N4 I3 E S. In Markup, "/"
    opens an insert menu at the last click/pointer point (note, text, date stamp, ✓, ✗,
    signature, image); typing filters. Keyboard twin of idea 2.
12. **Shortcut coaching** (Superhuman palette teaching, Linear hover keys). N3 I3 E S. After a
    command is run three times by mouse or palette, a one-time quiet hint "Next time: ⇧⌘E";
    tooltips carry keycaps. Per device, opt-out, ids only.
13. **Type to travel and G-sequences** (Things Type Travel, Linear G+I). N3 I3 E S. Digits typed on
    the page open the page pill pre-filled; G then L Library, G then P Pages grid, G then R Review,
    G then O outline. Fits key map v2 groups.
14. **Completion rings and calm done-states** (Ulysses goal ring, Things completion,
    Superhuman inbox-zero). N3 I4 E S. Form fill shows "7 of 12" as a ring on the page pill with
    Tab to the next empty required field; when the last one fills, the success bloom and a one-line
    "Ready to sign". Review list cleared gets an aurora empty state, not a blank panel.
15. **Speed you can feel: intent prefetch** (Superhuman 100 ms / < 50 ms, Linear optimistic).
    N3 I4 E M. Prefetch-render the page under a hovered thumbnail, outline row or Find hit;
    optimistic Pages grid edits with the worker committing behind; a dev-only frame HUD and CI
    budget asserting input→paint < 50 ms.
16. **Pinned palette rows and recipes as commands** (Obsidian pinned commands, Raycast
    quicklinks). N3 I3 E S. Pin commands to the top of ⌘K (touch-first value); every saved Batch
    recipe becomes a ⌘K command that runs on the open document, with an optional shortcut.
17. **Drag a tab to split** (Arc Split View). N3 I3 E L. Drag a document tab to the stage's
    edge to read two documents side by side, each with its own pill; distinct from Compare.
18. **Style Check for PDFs you are filling or editing** (iA Style Check, local rules). N4 I2 E M.
    In Edit text and text boxes, strike-through fillers/repeats on screen only (EN/TR word lists,
    custom patterns), never in the saved file.
19. **On-device summary, when the browser offers it** (Dia chat-with-tabs, made local).
    N4 I3 E M. Feature-detect the browser's on-device Summarizer API; "Summarize selection" or
    "Summarize page" only when it runs locally; otherwise the command is absent with a reason.
    Blocker: Chromium-only today; Safari/iPad has none.

### Not recommended
- Cloud chat (Dia), team snippets (Superhuman), anything account-bound: violates "local first".
- Sound effects on completion (Things): optional at most; Recto's calm brand and browser
  autoplay rules argue for haptics-only on iPad where available (not available in Safari web).
