# Web-platform firsts for Recto

Research track: **web-platform-firsts**, 2026-10-09. What the browser platform ships in 2026 that would let Recto, a local-only PDF editor, feel like an installed app and do things no PDF web app does.

## 0. What Recto already uses (so these are not proposed again)

Checked in `apps/web/src`:

- **Save in place** through File System Access (`files/save.ts`), handles kept per document, Recents handles in IndexedDB (`files/recents.ts`).
- **Folder output for Batch** with `showDirectoryPicker` (`batch/deliver.ts`).
- **Pen input**: coalesced and predicted events, pressure, tilt, a pen-hover cursor (`annotations/pen/ink-input.ts`), a `desynchronized` canvas, a dry-ink layer.
- **Web Share** with files (`export/save-copy-model.ts`), **ClipboardItem** copy (`tools/deliver-file.ts`).
- **View Transitions** (`motion/view-transition.ts`, `stage/grid/grid-transition.ts`), `navigator.storage.persist`.
- **Own eyedropper** that samples page pixels, deliberately not the system `EyeDropper` (`viewer/page-pixels.ts`).
- A PWA manifest with `display: standalone` and icons only. It has **no** `file_handlers`, `launch_handler`, `share_target`, `display_override`, `shortcuts` or `protocol_handlers`.

Not used anywhere: `launchQueue`, Window Controls Overlay, Badging, FileSystemObserver, OPFS sync access, BroadcastChannel/Web Locks, Document Picture-in-Picture, Screen Wake Lock, BarcodeDetector, Local Font Access, the Translator/Language Detector/Summarizer APIs, WebGPU/WebNN, the Ink API, or drag-out (`DownloadURL`).

## 1. Platform survey (status October 2026)

### File System Access, OPFS, FileSystemObserver (Chromium; OPFS everywhere)
- `showOpenFilePicker`/`showSaveFilePicker`/`showDirectoryPicker` are Chromium desktop only. Safari and Firefox have OPFS (`navigator.storage.getDirectory()`, `createSyncAccessHandle` in workers) but no pickers onto real folders.
- **FileSystemObserver** ran as an origin trial in Chrome 129–134, with an Intent to Ship posted in December 2024 for desktop. It reports changes to files and folders the user has already granted. That is how an app finds out "the PDF changed on disk" or "a new scan landed in the folder" without polling. ([Chrome blog](https://developer.chrome.com/blog/file-system-observer), [Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/6oOaFmia2dc/m/gx0KgpQqBQAJ))

### File Handling + Launch Handler + Share Target (installed PWA)
- `file_handlers` in the manifest plus `launchQueue.setConsumer()` landed in Chrome 102 on desktop (macOS, Windows, ChromeOS). Users can then pick "Open with Recto" in Finder or Explorer, and Recto can be the default PDF app. `launch_handler: { client_mode: "focus-existing" }` sends the next file into the window that is already open, not a new one. Safari and Firefox do not have it. ([Chrome 102](https://developer.chrome.com/blog/new-in-chrome-102), [MDN file_handlers](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/file_handlers), [web.dev OS integration](https://web.dev/learn/pwa/os-integration))
- `share_target` with `POST` + `multipart/form-data` lets an installed Android/ChromeOS/Windows PWA receive shared PDFs and images. iPadOS does not offer web apps as share targets.

### Window Controls Overlay (Chromium desktop PWA)
- `display_override: ["window-controls-overlay"]` removes the title bar. The page draws into that area, with `titlebar-area-*` env() variables and `app-region: drag`.

### Badging (Chromium desktop; Safari Home Screen and macOS web apps)
- `navigator.setAppBadge(n)`. On iOS/iPadOS 16.4+ it works for Home Screen web apps only, and only once notification permission is granted. ([WebKit blog](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/), [MDN guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Display_badge_on_app_icon))

### Pointer Events for Apple Pencil, Ink API
- Safari 16.1 brought Apple Pencil **hover** on M2+ iPad Pro: pen `pointermove` with no buttons pressed before contact. ([MacRumors](https://macrumors.com/2022/10/24/apple-safari-16-1-launch)) Pencil Pro **barrel roll (twist)** and **squeeze** are still not exposed to the web; it is an open WebKit request ([bug 296943](https://bugs.webkit.org/show_bug.cgi?id=296943)). Developers report that pen `pointermove` in Safari is sampled at a lower rate ([Apple forums](https://developer.apple.com/forums/thread/776468)), so `getCoalescedEvents` matters.
- **Ink API** (`navigator.ink.requestPresenter()`, delegated ink trail) is Chromium only. It is mainly useful on Windows, where the OS compositor draws the last few ms of ink ahead of the page. ([MDN Ink API](https://developer.mozilla.org/en-US/docs/Web/API/Ink_API)) Recto's research doc 12 already recommends it.

### Graphics and on-device ML
- **WebGPU** ships on by default in Safari 26 (macOS, iOS, iPadOS, visionOS) and in Chrome; Firefox has it on Windows and macOS. ([Gigazine Safari 26](https://gigazine.net/gsc_news/en/20250623-safari-26-webkit-beta), [Safari 26 notes](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes))
- **WebNN** was an origin trial in Chrome 145–147 and Edge (Edge's trial expires 2026-08-11). It is not yet shippable. ([Phoronix](https://www.phoronix.com/news/Chrome-146-Beta), [Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/5CWKSChYo98))
- **Chrome built-in AI**: **Translator**, **Language Detector** and **Summarizer** are stable since Chrome 138 on desktop. They run on-device: Summarizer uses Gemini Nano, which needs about 22 GB free and a capable GPU. The Prompt API is stable for extensions. ([Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis), [Translator](https://developer.chrome.com/docs/ai/translator-api), [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api))
- **Handwriting Recognition API** (`navigator.createHandwritingRecognizer`) exists in Chromium. Support depends on the platform (ChromeOS: English plus a gesture model). ([web.dev](https://web.dev/handwriting-recognition/))

### Other capabilities
- **Document Picture-in-Picture**: Chromium 116+, Firefox 151 (May 2026), not in Safari. ([developer-signals #260](https://github.com/web-platform-dx/developer-signals/issues/260))
- **BarcodeDetector**: Chromium on macOS, ChromeOS and Android. Safari has it behind a flag that is broken since iOS 18 ([Apple forums](https://developer.apple.com/forums/thread/767761)). A wasm fallback (zxing) would be needed, but Recto never adds dependencies, so the fallback is "no".
- **Local Font Access** (`queryLocalFonts`): Chromium 103+ only, with a permission prompt. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Local_Font_Access_API))
- **Drag-out of files** (`dataTransfer.setData('DownloadURL', 'application/pdf:name.pdf:blob:…')`): Chromium only, not standard. ([web.dev Box case study](https://web.dev/case-studies/box-dnd-download))
- **CSS anchor positioning** in Safari 26.0, with flip-x/flip-y fallbacks in 26.2. Scroll-driven animations in Safari 26. ([WebKit 26.1](https://webkit.org/blog/17541/webkit-features-for-safari-26-1/), [WebKit 26.2](https://webkit.org/?p=17640))
- **Compression Streams** are Baseline (Safari 16.4, Firefox 113). **BroadcastChannel/Web Locks** are Baseline. **Screen Wake Lock** is Baseline, and works in iOS Home Screen apps since 18.4.

## 2. Ideas for Recto, ranked

Ranked by novelty × impact ÷ effort, while staying local-only.

1. **"Open with Recto": become the OS PDF handler** (`file_handlers` + `launch_handler: focus-existing` + `launchQueue`). Double-clicking a PDF in Finder or Explorer opens it in the Recto window that is already open, as a new tab with a writable handle, so Save writes in place straight away. No PDF web app does this well. Chromium desktop only; elsewhere nothing changes. Effort S.
2. **Live file: watch the open PDF on disk** (FileSystemObserver). If another app rewrites the file, a glass toast appears: "Changed on disk: Reload / Compare with mine". Compare reuses Recto's existing compare. On browsers without the observer, check `lastModified` on focus. Effort M.
3. **Watch folder / Inbox in the Library**. The user grants a "Scans" or "Downloads" folder once. New PDFs appear in the Library with a live dot, and a Batch recipe can run on them automatically (OCR, compress, rename) while Recto is open. A Hazel-style inbox, fully local. Effort M.
4. **Drag a page out as a file**. In the Pages grid, drag a thumbnail (or a selection) out of the window onto the desktop or into Mail to get `Name – p3.pdf`. Uses `DownloadURL` with a blob URL created on `dragstart` from a pre-extracted subset. On Safari, fall back to Web Share. Effort M.
5. **Pencil hover previews (iPad M2+, Wacom)**. While the Pencil hovers: a ghost nib shows the exact width and colour at the current zoom; hovering over an existing ink stroke with the eraser shows which strokes would go; hovering a form field highlights it and shows its label; hovering near the page edge gives a gentle edge glow (scroll intent). Hover never commits anything. The app already detects hover; this turns it into a preview language. Effort S–M.
6. **Window Controls Overlay "frameless Recto"**. In the installed desktop app, the top strip glass pieces sit in the title bar next to the traffic lights, `app-region: drag` on the empty glass, matching the `--free-*` rect. The app looks native in the Dock. Effort S.
7. **On-device translate and summarize a page** (Translator + Language Detector + Summarizer, Chrome 138+ desktop). Select text and pick "Translate" (EN↔TR first) for an inline glass card. "Summarize this page/section" gives key points that can be pinned as a note annotation. Language detection sets OCR's language automatically. Shown only when `availability()` says the model is on the device, labelled "on this device". The model download goes from Google to the browser, not from Recto, so the privacy wording has to be honest. Effort M.
8. **Handwriting → text and scribble gestures** (Handwriting Recognition API where available). Write with the pen in a text box or form field and it turns into typed text (Scribble-like). Scratch out a word in a text-edit block to delete it. Feature-detected; hidden where missing. Effort L.
9. **Multi-window workspace** (BroadcastChannel + Web Locks + `window.open`). Pop out a document or the Pages grid into a second window (a second monitor or Stage Manager). Selection, undo and page moves stay in sync. Web Locks stops two windows from saving the same handle at once. Effort L.
10. **Picture-in-Picture reference page** (Document PiP). Pin a page, or the Find results, into an always-on-top glass mini window while filling a form in another app or writing in Recto. Chromium and Firefox desktop. Effort M.
11. **Signing-session badge and focus** (Badging + Wake Lock). The installed app's badge shows the number of form fields still to fill, or unresolved review notes. Present and Read modes hold a Screen Wake Lock so the iPad does not dim while someone is reading or presenting. Effort S.
12. **"Use my fonts" for text edit and text boxes** (Local Font Access). When editing text in a PDF whose font is not embedded, offer the matching installed font (by PostScript name) and embed it, instead of a substitute. This follows Recto's "honest UI" rule: say "Matched your installed Helvetica Neue". Chromium only. Effort M.
13. **QR/barcode awareness** (BarcodeDetector). On Chromium, detect QR codes on pages and turn them into tappable links, with a peek of the target before opening. Show a "Contains a QR to example.com" chip in Review (also phishing awareness). Without the API, the feature is absent. Effort S.
14. **WebGPU page compositor for zoom and the grid**. Upload rendered tiles as textures. Pinch-zoom and the 200-thumbnail Pages grid then animate on the GPU, with mip-mapped thumbnails and a real-time "light table" depth blur. Also makes GPU-side glass refraction behind the capsule possible. Effort XL, so do this only after measuring.
15. **Local-first sync via sidecar files (CRDT log)**. Annotations as an append-only op log in `file.pdf.recto` (or inside the PDF as an embedded file). Two people who swap the file through any channel (AirDrop, USB, Drive) merge edits without conflicts on open. "Collaboration without a cloud" fits the vision's non-goal list. Compression Streams keep the log small. Effort XL.
16. **Shortcuts and protocol handler**. Manifest `shortcuts` (New from clipboard, Combine files, Scan to PDF) appear on a right-click of the Dock/taskbar icon. `protocol_handlers` with `web+recto` lets other local tools deep-link "open page 4 of this handle". Effort S.
17. **Delegated ink trail on Windows** (Ink API). Already recommended in research 12. Listed here for completeness and ranked low because it is not visible on Apple hardware.

## 3. Feasibility notes

- Everything above feature-detects and degrades to today's behaviour. Nothing needs a server.
- Safari/iPad gets: Pencil hover previews, WebGPU, Badging/Wake Lock (Home Screen), CRDT sidecars, multi-window (Safari windows), anchor-positioned popovers. Chromium desktop gets the OS integration set (file handling, WCO, observer, drag-out, local fonts, built-in AI).
- Built-in AI and the Handwriting Recognition API use models the browser downloads. Recto's CSP and privacy claims stay true because Recto sends nothing itself, but the "Local only" indicator must explain this.
