# R12 research track: PDF and reading/research apps

Date: 2026-10-09. Track: `pdf-reading-research`.

Method: web search abstracts of App Store listings, vendor help pages, release notes and reviews
(2023–2026). docs.readwise.io and zotero.org could not be fetched directly (DNS blocked by the
egress proxy), so their facts rest on search abstracts. Recto was checked against the repo:
`state/view-store.ts` (layouts continuous · single · two-up), `shell/frame/focus-mode.ts` (Focus
hides chrome), `shell/review/ReviewPanel.tsx` (All · Comments · Marks · Fields), `viewer/LinkLayer.tsx`
(internal links jump at once, no preview, no back stack), `stage/PageScrubber.tsx`, `outline/`
(outline editing), `export/save-copy-run.ts` (document text to Markdown, not annotations). Recto has
no page-content theme (pages are always white), no reflow reading view, no annotation export, no
read-aloud, no navigation history, no user bookmarks separate from the outline.

## 1. The apps

### LiquidText (iPad, Mac, Windows)
- **Pinch to collapse.** Pinching two points of a document together "squishes up everything in
  between" so two distant passages sit side by side; a PDF acts "like an outline" without levels.
- **Highlight View / collapse around search.** One pinch collapses the document to just the
  highlighted passages or search hits, "with as much or as little context as you need".
- **Workspace.** Each document has a companion canvas (right of the document in landscape, below in
  portrait). Excerpts dragged out stay linked to their source; drop one on another to group.
- **Ink links.** Draw a line between two items (pages, documents, notes); tapping one end jumps to
  the other, even after either moves. Circling text with ink excerpts it.
- **Multi-target comments.** One comment can point at several selections across documents.
- Workspaces have names and background colours and can be shown in split panes.

### MarginNote 4
- **One card, three renderings:** a highlight is simultaneously a document mark, a mind-map node
  and a flashcard.
- Mind map: drag highlights into a tree, ten branch styles, auto mind map from card properties,
  outline view, export as "Mind Map" or "Card Outline".
- **Immersive Recall (4.4, May 2026):** highlights auto-blur (Gaussian) and reveal only when the
  reader actively recalls and taps them. FSRS scheduling for review.

### PDF Expert (Readdle)
- **Annotation summary** (iPad 1.1, March 2025; Mac): all annotations sorted by page, filterable by
  colour, navigable like bookmarks, **exported as HTML, Text or Markdown**.
- **Reading Mode** (iPhone): reflows PDF text to the screen, Night / Sepia themes, view settings.
- Reading options: single or two-page, themes, bookmarks, turning off the annotate/edit tabs,
  **Split View of two PDFs side by side**, tabs on iPad.

### Adobe Acrobat (mobile, desktop, web, Studio)
- **Liquid Mode** (mobile): reflows supported PDFs (≤ 200 pages) into a readable column; an
  auto-generated **outline with collapsible sections**; font size, character and line spacing;
  images expand on tap. Original file untouched.
- Read aloud, enhanced on the web in August 2025. Acrobat Studio (2025): PDF Spaces "knowledge hub"
  over up to 100 files with cited AI answers (cloud; out of scope for Recto, but the *citation back
  to the passage* pattern is reusable locally).
- Desktop: Previous View / Next View (Alt+←) after following links (established knowledge).

### Apple Preview (macOS, and new on iPadOS 26) and Apple Books
- Preview came to iPad in iPadOS 26 with Pencil markup, AutoFill for forms (ML field detection,
  fields highlighted in blue) and an empty page to sketch on.
- Books: six reading themes (Original, Quiet, Paper, Bold, Calm, Focus); Customize sliders for line,
  character and word spacing and margins; justification; Reset Theme. Tapping the page centre
  briefly replaces the title with **"16 pages left in chapter"**. Bookmark by button (and, in
  some versions, double-tap). Highlight colours and underline from one selection menu; a note shows
  as a small square in the margin. Four page-turn styles including the curl.

### Kindle
- **Page Flip:** skim page by page, scan by chapter or jump to the end "without losing your place";
  a bird's-eye view of pages; the place is saved and restored.
- X-Ray (terms and where they occur, with a frequency map), Word Wise (inline hints above hard
  words with a difficulty slider), Vocabulary Builder (every looked-up word saved with its sentence,
  quizzed as flashcards).

### Readwise Reader
- **Keyboard highlighting:** arrow keys move a purple paragraph focus indicator; **h** highlights the
  focused paragraph, **n** highlights and opens the note; images can be highlighted the same way.
- **Auto-highlighting:** a text selection becomes a highlight at once; Shift+H or ⌘K toggles it.
- Ghostreader: actions on a selection (define, explain, summarise, translate, flashcard, custom
  prompts) with answers in the Notebook (cloud LLM).
- `?` and ⌘K list every shortcut. Highlights sync to Obsidian, Notion, Logseq and Daily Review.

### Zotero 7 and 8
- Ink, underline and text annotations; one annotations sidebar; tags on annotations.
- **Hover over a citation or internal link shows a popup with the referenced entry or figure.**
- Zotero 8: an **Appearance panel** (scrolling, spreads, split view, themes) whose view settings are
  per document; **reader themes** Dark, Snow, Sepia and custom foreground/background pairs, one for
  light mode and one for dark; themes replace the old "invert" (images are only darkened a little);
  **full-page scans are themed too** by mapping their whites and darks to theme colours.

### Highlights (Mac/iOS)
- Exports native PDF annotations as Markdown with page numbers; **colour → tag** (text underlined in a
  given colour gets a tag); sort annotations by colour instead of page; a **sidecar Markdown file**
  kept next to the PDF and updated live (used to feed Obsidian).

### Skim (macOS)
- **Reading bar:** a coloured translucent band over the current line, moved with ⌥↑ / ⌥↓ or dragged;
  colour and opacity in preferences.
- **Snapshots:** a region of the PDF kept in its own small window for reference while reading on.
- Notes pane listing every annotation; "notes as text" export with page numbers; presentation mode
  with transitions; the PDF data is not modified.

## 2. Ideas for Recto, ranked

Score is novelty in a PDF app × impact, effort as a tie breaker. Each maps onto Recto's real code.

| # | Idea | From | Area | Novelty | Impact | Effort |
|---|---|---|---|---|---|---|
| 1 | **Fold**: pinch to collapse the pages between two passages; "Fold to marks" | LiquidText | reading-navigation | 5 | 4 | L |
| 2 | **Link peek and the Back chip** | Zotero 7, Skim, Acrobat | reading-navigation | 3 | 5 | M |
| 3 | **Page themes** (Paper, Sepia, Night, custom) that also theme scans | Zotero 8, Books | reading-navigation | 3 | 5 | M |
| 4 | **Pins**: keep a figure or table floating while reading on | Skim snapshots, LiquidText | reading-navigation | 4 | 4 | M |
| 5 | **Peek-scrub**: look anywhere, let go, be back | Kindle Page Flip | reading-navigation | 4 | 4 | M |
| 6 | **Notes out**: Markdown highlights notebook with colour meanings | Highlights, PDF Expert, Skim | export-share | 3 | 4 | S |
| 7 | **Excerpt Shelf**: a linked workspace beside the page | LiquidText, MarginNote | markup-tools | 4 | 4 | XL |
| 8 | **Thread**: an ink link between two marks | LiquidText | markup-tools | 5 | 3 | L |
| 9 | **Recall**: blur every highlight, tap to reveal | MarginNote 4.4 | reading-navigation | 5 | 3 | S |
| 10 | **Paragraph keys**: ⌥↓ paragraph focus, H highlight, N note | Readwise Reader | accessibility | 4 | 3 | M |
| 11 | **Text view**: local reflow with Books-like typography | Acrobat Liquid Mode, PDF Expert | reading-navigation | 3 | 5 | XL |
| 12 | **Reading ruler** snapped to the text model | Skim | accessibility | 3 | 3 | S |
| 13 | **Listen**: read aloud with word tracking, on-device voices only | Acrobat, Books | accessibility | 2 | 4 | M |
| 14 | **Colour meanings** in the palette | Highlights, MarginNote | markup-tools | 3 | 3 | S |
| 15 | **"Pages left in section"** and per-file resume | Apple Books, Kindle | reading-navigation | 2 | 3 | S |
| 16 | **Ribbons**: quick user bookmarks separate from the outline | Books, PDF Expert | reading-navigation | 2 | 3 | S |
| 17 | **Side by side**: two views of one document (or two documents) | PDF Expert, Zotero 8, LiquidText | chrome-layout | 2 | 4 | L |
| 18 | **Auto-highlight toggle** for selections | Readwise Reader | markup-tools | 3 | 3 | S |

### 1. Fold (signature)
Two-finger pinch *vertically* in continuous layout (or ⌥-drag on desktop, or "Fold here" from a
page menu) collapses everything between the two fingers into a thin glass seam labelled
"pp. 4–17 folded". The seam springs open on tap. "Fold to marks" in the Review header collapses the
document to bands around each highlight, comment and search hit (context slider: line · paragraph ·
page). In Recto the stage already virtualises pages; a fold is a layout entry in `read-layout` with
a band list per page, rendered by clipping the page canvas (`clip-path` or a cropped bitmap from
the worker). It never changes the document; it is view state, with undo-free toggling.

### 2. Link peek and the Back chip
Hover (desktop, 350 ms) or long-press (touch) an internal link, an outline row or a citation like
"[12]" or "Fig. 3": a glass popover shows a rendered crop of the destination (the dest rect from
PDFium, else the top third of the target page) with "Go" and "Pin" (idea 4). Following any jump
(link, outline, Find, page pill) pushes the previous view; the page pill grows a "← p. 12" Back chip
for 8 s, and ⌘[ / ⌘] (Alt+← on Windows) walk the stack. `LinkLayer.tsx` today scrolls immediately
and keeps no history.

### 3. Page themes
A per-document Appearance row (Zotero 8 pattern) with Original · Paper · Sepia · Night · Custom
(foreground + background). Rendered as a GPU colour map on the page bitmap: map paper white to the
theme background and ink black to the theme foreground through a luminance curve, keep chroma for
coloured pixels, and only darken image regions a little (image rects come from PDFium page objects).
Scans are themed the same way. Highlights and ink keep their identity colours (blend after the map).
Export is untouched; a small "Theme on" glyph sits in the pill so nobody mistakes a sepia page for
the file. Fits the dark-by-default chrome, which today frames a glaring white page at night.

### 4. Pins
Marquee or Pencil-circle a region (figure, table, equation) and choose Pin: it floats as a small
solid card (content stays solid per the language) above the stage, draggable, resizable, re-rendered
at the device pixel ratio; tap to fly back to its source. Up to three pins per document, kept in the
session. Useful for papers ("see Figure 3") and contracts (definitions).

### 5. Peek-scrub
Press and hold the page pill (or hold Space+drag the scrubber): a filmstrip opens and the page flies
to whatever is under the finger; lifting returns to the place you left with a spring, unless you tap
"Stay". The same "look without losing your place" works for Find results with a modifier.
`PageScrubber.tsx` supplies the gesture; the return uses the Back stack of idea 2.

### 6. Notes out
Review gains "Copy as Markdown" and "Save notes…": highlights grouped under the outline heading they
fall in, each with page number, its text (from the text model), comment, author and colour meaning
(idea 14) as a tag; a deep link `file.pdf#page=12`. Also Plain text and a printable "Notes" page
appended to a copy. Optional File System Access sidecar `name.notes.md` rewritten on every save,
the Highlights pattern, so Obsidian users get live notes with no cloud.

### 7. Excerpt Shelf
A third sidebar section (or a split pane in the Pages grid space) that is a free canvas: drag a text
selection, a lasso region or an annotation onto it to create an excerpt card that remembers its
source (doc, page, quads). Cards group by dropping one on another, can be written on with the pen,
and a tap flies back to the source with the source highlighted. Export: Markdown outline (MarginNote
"Card Outline") or a new PDF page appended to the document. Shelf state lives in the OPFS snapshot.

### 8. Thread
Draw a stroke from one mark to another (with the pen in Markup, starting on a highlight): instead of
ink it becomes a thread, a pair of PDF Link annotations (GoTo each other) plus a faint connector drawn
when both ends are visible. Tapping either end flies to the other with the Back chip. Survives export
as standard links, so Acrobat and Preview follow them too.

### 9. Recall
A toggle in the pill menu: every highlight's text blurs (a canvas blur of the quad area, not glass);
tap one to reveal it, tap again to hide; a counter "7 of 23 recalled". Turns a student's highlighted
PDF into self-test with no new data. Pure view state.

### 10. Paragraph keys
In viewing, ⌥↓ / ⌥↑ moves a lime-ringed paragraph focus over the page (paragraphs from
`text-model.ts` / the paragraph model); H highlights it, U underlines, N highlights and opens a note,
C copies. Matches Recto's keyboard-first principle and gives screen-reader users a structured way to
mark text.

### 11. Text view
A Read layout "Text" next to continuous · single · two-up: the structure tree (tagged PDFs) or the
paragraph inference already built for Edit text yields a reflowed column in Inter Recto with Books
controls (size, line spacing, margins, width, theme), headings as a collapsible outline (Liquid Mode),
images and tables as tap-to-expand page crops. Selections map back to quads so highlights made here
are real PDF highlights. This is also the right base for the read-only phone edition (ADR-0033).
Honest UI: a banner "Text view is an approximation; the page is the original".

### 12. Reading ruler
A thin solid band (accent-tinted, low opacity) snapped to the current text line, with the rest of the
page dimmed 20 %; ⌥↓ / ⌥↑ steps lines, drag moves it, works in Focus. Accessibility aid for dyslexia
and long contracts.

### 13. Listen
Read aloud from the current paragraph with `speechSynthesis`, filtering voices to
`localService === true` (some Chrome voices are network services; never use them, per principle 1).
The spoken word is tracked through `boundary` events and drawn as a moving underline; the page
follows. Controls in the capsule: play, rate, voice. Safari exposes the system voices locally.

### 14. Colour meanings
Each highlight colour in the palette can carry a name ("Key", "Question", "Disagree", "Definition"),
shown as a tiny legend in Review's filter chips and written to the annotation's subject; Review can
group by meaning; export uses them as tags (idea 6).

### 15. "Pages left in section" and resume
Tapping the page pill shows, for 2 s, the outline section and "4 pages left in Methods" (Books). Each
Library card shows a thin progress arc and opens at the exact page, zoom and scroll offset of the last
session (stored with the recent file handle).

### 16. Ribbons
B (or a tap on the top-right corner of a page on touch) drops a lime ribbon on the page; ribbons list
in the pill menu and the Pages sidebar, and are written as a "Bookmarks" outline group on export only
if the user chooses so; otherwise they stay local view state.

### 17. Side by side
Split the stage into two panes on the same document (independent scroll and zoom) or two open tabs;
Compare already has a two-pane place, so the pane machinery exists. iPad: drag a tab to the right edge.

### 18. Auto-highlight toggle
In Markup with Highlight armed this already happens; the idea is a viewing-mode toggle (⇧H, ⌘K
"Auto-highlight selections") so research reading never needs the palette or the selection bar.

## Sources
- LiquidText App Store listing: https://apps.apple.com/app/id922765270
- LiquidText 2.0 multiple documents (MacStories): https://www.macstories.net/ios/liquidtext-2-0-brings-support-for-multiple-documents/
- LiquidText pricing and features: https://www.liquidtext.net/pricing-features
- LiquidText review (Macworld): https://www.macworld.com/article/228419/liquidtext-for-ipad-review-all-you-need-for-deep-research-projects.html
- LiquidText hands-on (AppleInsider forums): https://forums.appleinsider.com/discussion/201198
- MarginNote 4 App Store: https://apps.apple.com/us/app/marginnote-4-ai-notes-mindmap/id1531657269
- MarginNote features and what's new: https://www.marginnote.com/en/features/ , https://www.marginnote.com/en/whats-new/
- PDF Expert annotation summary: https://support.readdle.com/pdfexpert/en_US/annotate-pdfs/view-and-export-annotation-summary
- PDF Expert reading mode: https://support.readdle.com/pdfexpert/en_US/reading-pdfs/reading-mode
- PDF Expert for iPad 1.1 (iClarified, 2025): https://www.iclarified.com/entry/index.php?enid=21121
- PDF Expert Reading Mode (iPhone in Canada): https://www.iphoneincanada.ca/news/pdf-expert-new-pdfs-reading-mode/
- Adobe Liquid Mode help: https://helpx.adobe.com/acrobat/mobile/view-manage-files/liquid-mode.html
- Adobe Liquid Mode launch: https://blog.adobe.com/en/publish/2020/12/10/adobe-delivers-enhanced-pdf-reading-experience-for-accessibility
- Acrobat on the web release notes: https://helpx.adobe.com/acrobat/web/whats-new/release-notes.html
- Acrobat Studio (eWeek): https://www.eweek.com/news/adobe-acrobat-studio/
- iPadOS 26 newsroom (Preview on iPad): https://www.apple.com/newsroom/2025/06/ipados-26-introduces-powerful-new-features-that-push-ipad-even-further/
- Preview on iPadOS 26 hands-on (BGR): https://www.bgr.com/1921935/ipados-26-preview-app-hands-on/
- Apple Books reading guide: https://support.apple.com/en-asia/guide/iphone/iphc1af7c57/ios
- Apple Books tips: https://www.igeeksblog.com/tips-to-master-apple-books-on-iphone-ipad/
- Apple Books "pages left in chapter" (AppleVis): https://applevis.com/comment/147953
- Kindle features (Amazon press): https://press.aboutamazon.com/2014/11/new-features-for-kindle-e-readers-now-available
- Kindle tips: https://boredom-at-work.com/kindle-tips-and-tricks/
- Readwise Reader getting started: https://blog.readwise.io/p/bf87944f-b0fe-4f08-a461-f75ab8aded6a/
- Readwise Reader highlights, tags and notes: https://docs.readwise.io/reader/docs/faqs/highlights-tags-notes
- Readwise Reader 2025 guide: https://curtismchale.ca/2025/03/29/read-later-with-readwise
- Ghostreader discussion: https://outlinersoftware.com/topics/viewt/9903
- Zotero 7: https://www.zotero.org/blog/zotero-7/
- Zotero 8: https://www.zotero.org/blog/zotero-8/
- Highlights for Mac (Macdrifter): https://www.macdrifter.com/2014/10/highlights-for-mac-turns-pdf-annotations-into-markdown.html
- Highlights + Obsidian sidecar (MPU): https://talk.macpowerusers.com/t/batch-process-annotations-from-pdfs-out-to-obsidian/24470
- Skim: https://skim-app.sourceforge.io/ ; Macworld review: https://www.macworld.com/article/185084/skim.html
