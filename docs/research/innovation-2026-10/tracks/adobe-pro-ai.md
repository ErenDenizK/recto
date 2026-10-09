# Track: adobe-pro-ai (professional suites and AI-assisted tools)

Research date: 2026-10-09. Scope: Acrobat Pro / Acrobat Studio and AI Assistant, Photoshop (iPad, iPhone, desktop Contextual Task Bar), Illustrator for iPad, InDesign, Canva, Microsoft Word and OneNote with Copilot, Google Docs, Apple Intelligence Writing Tools, and the browser on-device AI stack (transformers.js, WebGPU, WebNN, Chrome built-in AI APIs).

The constraint that shapes everything here: Recto never uploads a file. Every AI idea below either needs no model at all (heuristics over PDFium's text and font data), uses a browser-provided on-device model when one exists (Chrome built-in APIs), or uses a small model served **from Recto's own origin** (so the strict CSP still holds) and run with WebGPU or WASM. Where an idea only works in some engines, the proposal says what the other engines get.

---

## 1. Adobe Acrobat Pro / Acrobat Studio and AI Assistant

- **Generative summary.** One click builds an outline with headings, section links, bullets and main points per section. You can ask for a new summary or a given length.
- **Attributions.** Answers carry numbered references. Clicking one **highlights the source span in the PDF**, so you can check the answer. This is the single best trust pattern in the AI-for-documents space.
- **Suggested questions** appear in the assistant panel *while the document is still processing* (Oct 2025), so the wait already offers something useful.
- **PDF Spaces** (Aug 2025): a collection of files and web pages that becomes a "conversational knowledge hub" with notes and citations. Assistants take roles ("instructor", "analyst").
- **Natural-language organizing and editing** (Apr 2026): "move the appendix to the end, add page numbers and a watermark". In Aug 2026: rewrite, replace, format or highlight text by prompt. The assistant **finds every matching occurrence first and shows them before you apply**.
- Generated presentations, podcasts (quick highlights or deep dive), charts drawn from document data, and cover pages.
- **Liquid Mode** (mobile): reflows text, images and tables, and turns detected headings into a **collapsible outline**. It is server-side: the file goes to Document Cloud. It also mangles headings in some languages.

Lesson for Recto: Adobe's strongest ideas, citations, preview before apply and reflow, do not need a cloud. Adobe needs a cloud only because of how it is built. Recto can ship the same ideas with the privacy story Adobe lacks.

## 2. Photoshop (iPad, iPhone, desktop)

- **Contextual Task Bar** (desktop): a small floating bar that follows the active tool or selection with the likely next steps (Select subject → Remove background, Generative fill, Mask). It can be **docked, floated or hidden**, and Adobe keeps adding actions to it (Remove, Adjust colors in 2025).
- **iPad**: a "context-aware UI" in which tool options appear only when needed. Compact and Detailed layer views. The **touch shortcut**, a floating on-screen circle that stands in for Shift and Alt (primary on press, secondary when dragged outward), gives keyboard modifiers without a keyboard.
- **iPhone**: adjustments are layers with masks you can return to later. **Curves draws its graph over the image**, so the control and its result share one place.
- **Actions panel search** (2025 beta): natural-language queries such as "make it pop!" match actions even when the words don't match their names. The **Discover panel** (Cmd/Ctrl+F) searches tools, menus, tutorials and one-click Quick Actions.

## 3. Illustrator for iPad

- **Repeat** (radial, grid, mirror): artwork stays **live-linked**. Editing one instance updates all of them, double-tap edits in place, and **Expand** breaks the link. On-canvas widgets set count and spacing.
- **Vectorize** turns a photo of a sketch into vectors.
- **Pencil**: touch shortcuts give straight lines, plus smoothing and **"pause to make a corner"**.

## 4. InDesign

- **Generate Alt Text** for every image (accessibility).
- **Auto Style** applies a style pack to raw text.
- **Generative Expand**. Note that it replaces the original image, a production pitfall worth not copying.

## 5. Canva

- **Magic Switch** (now split into Magic Resize and Translate): one design turns into another format or language.
- **Magic Grab**: lifts an object out of a flat image so it can be moved.
- **Magic Layers** (2026): splits a flat AI output into editable layers, "for when AI only gets 80% of the vision". The idea is AI as a starting point that stays editable, not a final result.
- **Canva AI 2.0** (Create, Apr 2026) brings everything under one assistant.

## 6. Microsoft Word and OneNote with Copilot

- **Word**: **Alt+I on a blank line** opens "Draft with Copilot". **Visualize as a table** turns selected text into a table. Variants are browsed with **< and > arrows**, and a compose box refines the result ("add an empty third column"). A Coaching preview reviews a draft.
- **OneNote**: **lasso ink strokes, then a Copilot dropdown on the canvas** (summarize, rewrite, make a to-do list). **Text pen** converts handwriting as you write and supports **strike-through and scribble-to-delete gestures**. Ink to Text works on a lasso selection.

## 7. Google Docs

- **@ menu** with **smart chips** (people, dates, files, dropdowns, checklists, timers, variables, placeholders) and **building blocks** (meeting notes, email draft, review tracker), including custom building blocks. An **"@" button appears on empty lines**.
- **Document tabs** with sub-tabs, emoji and per-tab links: structure above headings.

## 8. Apple Intelligence Writing Tools

- **Proofread**: a scanning animation over the text, then a **floating palette with N suggestions underlined inline**. You step through them, accept or undo each one, and **toggle between original and revised**. On read-only text (a PDF) the result opens in a panel instead of inline.
- Reviewers noted the scan animation sometimes never ended. The lesson is that **AI progress needs an end state and a cancel**.

## 9. The on-device stack in a browser (status, Oct 2026)

| Piece | Status | Use in Recto |
|---|---|---|
| **transformers.js** (v3, WebGPU via ONNX Runtime Web, WASM fallback) | Mature; v4 reported | Embeddings (e.g. `mxbai-embed-xsmall`, ~25 MB q8), captioning, small seq2seq |
| **WebGPU** | Chrome, Edge, Safari 26 (iPadOS 26), Firefox (Windows) | Model inference, image cleanup shaders |
| **WebNN** | W3C CR (Jan 2026); Chrome origin trial M146/147 | Later: an NPU path through ORT-Web's WebNN execution provider |
| **Chrome built-in AI**: Translator, Language Detector, Summarizer (stable since 138), Prompt API (stable 148 per one source), Proofreader (developer trial) | Chrome desktop only, with hardware requirements | Progressive enhancement: **the model lives in the browser, so nothing leaves the device** |
| **Web Speech `speechSynthesis`** | All engines; Apple's on-device voices with word `boundary` events | Read aloud with word highlighting |

Rules for Recto's AI, from the CSP and "honest UI" principles:
1. Models are served from Recto's origin (GitHub Pages: 100 MB per file, keep models ≤ 50 MB) and cached in OPFS or the Cache API. They are downloaded only on explicit opt-in, with the size shown.
2. Every AI result is **cited** (it jumps to and highlights the source quads) and **previewed before it is applied**.
3. Heuristics come first: many "AI" features (outline, triage, reflow) are font, size and geometry analysis over PDFium text, with no model at all.

---

## Ideas for Recto (ranked)

Ranking weighs novelty in a PDF app, impact, and fit with Recto's principles. Effort: S < 1 week, M 1–2 weeks, L 3–5 weeks, XL more.

### 1. Cited local answers: "Ask this PDF" with attribution highlights (search-ai, L)
*From Acrobat AI Assistant attributions and PDF Spaces.* The Find panel gains a **Meaning** mode next to the exact-text search. Queries are embedded locally (transformers.js, a ~25 MB embedder served from Recto's origin) against a chunk index built from PDFium text and OCR text in a worker. Results are **passages, not keywords**, each with a numbered chip. Clicking a chip scrolls to the page and **pulses the source quads in lime** (the same layer as search hits). When Chrome's Prompt API is present, a one-line synthesized answer appears above the passages, and every sentence must cite a chip. Otherwise Recto shows the passages only, which is honest and still useful. A "Local only · model 24 MB · stored on this device" footnote sits under it.

### 2. Document triage card at open (search-ai / library-files, M)
*From Acrobat's suggested questions while processing and generative summary, done without a model.* When a PDF opens, or on hover in the Library, a glass card answers "what is this, and what does it need from me?": page count, reading time, language, **"2 signature fields · 14 form fields (9 required) · 3 comments addressed to you · scanned pages 4–7 have no text (OCR?)"**, plus the key terms (TF-IDF). Each line is a button that goes to the act (Fill, Sign, OCR). It is fully deterministic and instant, and it suits the Library-as-welcome model.

### 3. Local Liquid Mode: reflow reading view with collapsible headings (reading-navigation, L)
*From Acrobat Liquid Mode, which is server-side, so Recto can claim "the first private Liquid Mode".* Recto builds the structure from PDFium text runs (font size and weight clusters → heading levels, column detection, reading order, figures as images) and shows a reflowed column in the reading theme. Headings fold, the type size is adjustable, and **tapping any paragraph returns to the exact spot on the real page** (View Transition morph). This is the obvious core of the phone compact edition (ADR 0033), and it also serves accessibility on desktop. A confidence gate grays out the button for documents that don't reflow well, as Adobe does.

### 4. Natural-language edit plans that compile to visible steps (menus-commands / pages-organize, L)
*From Acrobat's April and August 2026 natural-language editing, the Photoshop Actions panel's "make it pop", and Word's < > variants.* In ⌘K, typing "remove blank pages, number the rest from 3, watermark DRAFT, compress for email" produces a **plan card**: a list of Recto's existing Batch recipe steps with their parameters as editable chips, a count of matches ("blank: pages 4, 11, 30") and **Run** or **Save as recipe**. Parsing uses a deterministic EN/TR grammar plus a synonym table, with no model, and the Prompt API only as an optional fallback that must still emit the same step schema. Nothing runs before the user sees the plan.

### 5. Intent search in ⌘K, in both languages (menus-commands, S–M)
*From the Photoshop Actions search and the Discover panel.* The command palette matches by intent and synonyms, not only names: "make smaller", "küçült", "for email" → Compress; "black out" or "karart" → Redact; "initials" → Signatures. A hand-written synonym map ships first. Later, a 6 MB embedding of command descriptions handles fuzzy intent. Results show the command's shortcut and **a one-line "what it will do to this document"** preview ("Compress · est. 4.2 → 1.1 MB").

### 6. Live-linked Repeat for marks across pages (markup-tools, M)
*From Illustrator for iPad's Repeat: live instances that update together, with Expand to unlink.* Select a stamp, initials, a text box or a redaction box → **Repeat → every page / odd / even / range / "pages like this one"**. Instances stay linked: move or edit one and all of them follow (a dashed lime "linked" badge shows on hover), and **Expand** unlinks them. Initials on every page, a "CONFIDENTIAL" header box, and a redaction of the same letterhead area on every page become one act. On export each instance is a real annotation. I know of no PDF app with live-linked annotation instances.

### 7. Press-and-hold "Before" on every change sheet (export-share / chrome-layout, S)
*From Writing Tools' original/revised toggle and Word's variant arrows.* Every sheet that changes the document (compress, OCR, redact, flatten, resize, crop) gets a **hold-to-compare** control. Holding Space (or pressing and holding the chip on iPad) swaps the live preview to the original pixels. Compression shows a **quality slider with a real preview tile at 100% zoom**. This is a small change across every sheet, it makes "honest UI" something you can feel, and it shows the result before commit.

### 8. Contextual next-step bar that learns locally (chrome-layout, M)
*From the Photoshop Contextual Task Bar (dock, float or hide).* Recto already has selection bars. The new parts are: (a) the **slot order adapts to the user's own sequences** (a per-device frequency model, so after selecting text the bar puts "Highlight" first for one user and "Copy" for another, never more than a one-slot move per session to keep it calm), and (b) a **pin** to dock it to the capsule for users who don't want it floating. Plus "Predicted next" after an act: after Rotate in the Pages grid, "Apply to all landscape pages?" appears once as a ghost chip.

### 9. The touch modifier puck for iPad (ink-tools / accessibility, S–M)
*From the Photoshop and Fresco iPad touch shortcut.* A small glass circle that appears while a tool is active on touch. **Holding it with the left thumb = Shift** (straight ink lines, 15° steps, perfect circles and squares, proportional resize). **Dragging it outward = Option** (duplicate while dragging, scale from the centre). This brings keyboard-grade precision to Pencil users without a Magic Keyboard. Pair it with Illustrator's **"pause to make a corner / hold to snap shape"** on the pen.

### 10. Proofread review flow for text edits and form fields (text-edit, M)
*From Apple Writing Tools Proofread.* In paragraph text edit and long text fields, **Check** runs Chrome's Proofreader API where available and otherwise the engine's native spellcheck through a hidden `spellcheck` contenteditable, so no dependency. Suggestions are **underlined inline**, a small floating glass palette shows "3 suggestions · ‹ › · Accept · Skip", and a **Original ⇄ Revised** toggle shows the effect. The scan animation is the aurora's light sweeping once across the paragraph, always with an end state and a cancel.

### 11. Ink-selection actions: tidy shapes, ink to text, make a checklist (ink-tools, M → XL)
*From OneNote Copilot on lassoed ink and the Text pen.* After a lasso, the bar offers **Straighten** (fits rough lines, arrows, boxes and circles to clean vector shapes, done geometrically, M), **Align** (rows of strokes) and, in phase 2, **Convert to text** with a small handwriting model (TrOCR-small via transformers.js, ~60 MB opt-in, XL) or Chrome's Handwriting Recognition API where present. The text pen's **scribble-to-delete and strike-through-to-delete gestures** fit Recto's pen immediately (S) and need no model.

### 12. Read aloud with word-following highlight (reading-navigation / accessibility, M)
*From Acrobat's "personal podcasts", done with private voices.* `speechSynthesis` reads in reading order (from the reflow structure in idea 3), skips running headers, footers and page numbers, follows each word with a soft lime underline using `boundary` events, and auto-scrolls. **"Listen from here"** appears on long-press of any paragraph. Apple's on-device voices make this sound premium on iPad and Mac. A mini player morphs into the capsule.

### 13. @-inserter in text boxes and notes: smart chips for PDFs (markup-tools, S–M)
*From the Google Docs @ menu and building blocks.* Typing **@** in a text box, note or form field opens a small menu: **Today** (locale date), **My name / initials** (from saved signature settings), **Page ref** (becomes a real PDF link annotation, "see p. 12"), **✓ / ✗**, and saved **building blocks** ("Approved by {name} on {date}", "Received", "Bates {n}"). An "@" ghost appears on an empty text box. This makes review stamps and form shorthand fast without adding toolbar clutter.

### 14. Local translate overlay (search-ai / reading-navigation, M)
*From Canva Magic Switch → Translate and Apple Live Text.* When Chrome's Translator API is present (on-device), **Translate page** draws translated text as a non-destructive reading layer over each text block (fitted in size, with the original on hover). It can be exported as a new PDF copy only on request. Other engines don't get the command at all. It is not a disabled tease, consistent with honest UI. This matters for Turkish and English users reading foreign contracts.

### 15. Local alt text and tagging assistant (accessibility, L)
*From InDesign Generate Alt Text.* Accessibility check finds images without /Alt. **Suggest** runs a small captioning model (Florence-2-base or a ViT-GPT2 class model, WebGPU, opt-in download), and the user reviews every suggestion in a card stack (Accept, Edit, Skip). Headings come from idea 3's structure and can become tags. Of these ideas, it is the most "pro-grade" one that no free local tool offers.

### 16. Scan cleanup brush (pages-organize / ocr, M)
*From Photoshop Remove and Generative fill, done without generation.* For scanned pages, a brush **paints out stains, punch holes and scanner shadows** using patch-based fill (PatchMatch in a WebGL or WASM shader, no model), and **Clean page** auto-whitens the background and deskews. A hold-to-compare control (idea 7) shows the result. Unlike Generative Expand, the original page image is kept for undo and is replaced only on export.

### 17. Local models panel: provable AI privacy (onboarding-help / other, S)
*A counter-pattern to every cloud assistant.* Settings → **On-device intelligence** lists each capability (Meaning search, Captions, Handwriting), its model, size, where it is stored (OPFS), **Download / Remove**, and a live "network: idle" badge from the existing local-only indicator. Built-in browser models are listed as "provided by your browser". It is required groundwork for ideas 1, 11 and 15, and it is itself a brand statement.

### 18. "AI working" light: one visual language for long jobs (visual-brand / motion, S)
*From the Apple Intelligence edge glow and the Writing Tools scan.* OCR, compare, semantic indexing and proofreading all use one treatment: the aurora light sweeps the page area being processed, page by page in the thumbnail rail, and ends with a single settle pulse. It is **only light, never a spinner**, it follows reduced motion (a static progress fill instead), and it always has a determinate count and a cancel.

---

## Sources

- Acrobat Studio and PDF Spaces (Aug 2025): https://news.adobe.com/news/2025/08/acrobat-studio-delivers-new-ai-powered-home-for-productivity-creativity
- Acrobat Studio, Jan 2026 (presentations, podcasts, AI editing): https://news.adobe.com/news/2026/01/adobe-acrobat-studio-transforms
- Acrobat desktop release notes: https://helpx.adobe.com/ie/acrobat/desktop/whats-new/whats-new-acrobat-desktop.html
- Acrobat AI summary and attributions: https://www.adobe.com/acrobat/online/ai-summary-generator.html , https://www.techtarget.com/enterprise-software/news/366571023/Reading-long-PDFs-less-painful-with-Adobe-AI-Assistant-tool
- Liquid Mode: https://techcrunch.com/2020/09/23/adobes-liquid-mode-uses-ai-to-automatically-redesign-pdfs-for-mobile-devices , https://blog.adobe.com/en/publish/2020/12/10/adobe-delivers-enhanced-pdf-reading-experience-for-accessibility , https://community.adobe.com/questions-15/liquid-mode-modifies-headings-5887
- Photoshop Contextual Task Bar: https://helpx.adobe.com/photoshop/using/contextual-task-bar.html ; July 2025 release: https://helpx.adobe.com/photoshop/using/whats-new/2025-7.html
- Photoshop iPad workspace: https://helpx.adobe.com/photoshop/ipad/get-started/overview-and-setup/workspace-ipad.html
- Photoshop iPhone first look: https://creativepro.com/?p=14412162
- Photoshop Actions panel natural-language search: https://community.adobe.com/t5/photoshop-beta-discussions/actions-updates-new-ui-search-and-suggestions-available-now/td-p/15285779
- Discover panel: https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/learn-with-discover-panel.html
- Illustrator on iPad (Repeat, touch shortcuts): https://helpx.adobe.com/illustrator/ipad/get-started/overview-and-setup/Illustrator-on-ipad.html , https://9to5mac.com/?p=673920
- InDesign generative features (alt text, expand): https://helpx.adobe.com/ca/indesign/desktop/generative-ai-features/gen-ai-features-overview.html , https://helpx.adobe.com/ee/indesign/using/generative-expand.html
- Canva AI: https://www.createwith.com/tool/canva/updates/canva-launches-magic-layers-to-bridge-the-gap-between-ai-output-and-creative-vis , https://www.shopify.com/blog/how-to-use-canva-ai
- Copilot in Word: https://support.microsoft.com/en-us/word/welcome-to-copilot-in-word , https://support.microsoft.com/en-us/topic/use-copilot-in-word-with-a-screen-reader-d6132416-993f-42d1-9c2c-4b84c112a9a5
- OneNote Copilot on ink: https://www.thurrott.com/?p=304913 , https://windowscentral.com/software-apps/microsoft-onenotes-new-ai-feature-is-here-to-save-my-studying-from-horrible-handwriting
- Google Docs @ menu: https://support.google.com/docs/answer/11276813 ; Workspace update: https://workspaceupdates.googleblog.com/2023/12/easy-access-to-people-documents-blocks-in-google-docs.html
- Apple Writing Tools: https://support.apple.com/guide/mac-help/mchldcd6c260 , https://sixcolors.com/post/2024/10/apple-intelligence-1-review-a-small-start-of-something-big/ , https://www.kodeco.com/ios/programs/apple-intelligence/ux-apple-intelligence/49480768-writing-tools-with-apple-intelligence/01-meet-writing-tools/02
- transformers.js v3: https://huggingface.co/blog/transformersjs-v3
- Chrome built-in AI APIs: https://developer.chrome.com/docs/ai/built-in-apis
- WebNN: https://www.phoronix.com/news/Chrome-146-Beta , https://blog.ziade.org/2025/11/21/why-webnn-is-the-future-of-ai-in-browsers/
