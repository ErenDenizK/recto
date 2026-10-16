# Menu and copy audit, 2026-10-16 (R21 cleanup lane)

The owner's brief of 2026-10-16 (`docs/process/brief-2026-10-16.md`, B-7, B-8, B-13, B-16)
asks for one place per command, the language switch in Settings only, no UI that does not
earn its place, and copy that never repeats itself, before the first real user tests. The rule
is DSN-46; the structure chosen here is DSN-47 (desktop and tablet) and DSN-48 (phone). This
file is the inventory behind them: where each command appeared on 1693c78 + 338ac6b, where it
lives now, and why.

## How a command may appear

- **One menu home** per command: a menu row, a bar button or a visible launcher button.
- **Always allowed besides the home:** ⌘K (every registered command, with its keywords) and
  the command's keyboard shortcut. They are ways to reach the home's command, not places on
  screen.
- **Allowed with a recorded reason:**
  - *Context menus* (right-click or long-press on a page, a thumbnail, a tab, a grid section):
    they offer the commands of the thing pressed, scoped to it, and are never on screen at
    rest. Their rows are listed below but not counted as homes.
  - *A selection's own bar* (the Library's selection bar, the Pages bar with pages selected):
    the same job on the chosen items is a different scope from the whole document's row.
  - *Two editions or two places that are never on screen together* (the Library's ⋯ and the
    document's More; the narrow window's bar and the strip). Each holds the command once in
    its own context.

## Surfaces checked

Desktop (1440 × 900, fine pointer), tablet (1180 × 820, touch, full edition) and the phone
edition (390 × 844), in English and Turkish:

- **Library:** top strip (◆ Library, tabs, +, ⋯), launcher (empty and with documents), head,
  cards, selection bar, Recent list, footer (removed), drop overlay.
- **Document:** top strip (◆, sidebar toggle, tabs with ✕, Find, ↶ ↷, Save, ◎), title menu,
  tab context menu, dock (Pages, Markup, Fill & sign, More), page pill menu, Pages grid bar
  (at rest and with a selection) and its ⋯, grid section menu, page and thumbnail context
  menus, Markup palette (Sign group, More tools), sidebar (Pages with Contents, Find, Review),
  narrow-window bar (`CompactTopBar`) and its short-viewport ⋯.
- **Sheets and popovers:** Save a copy, Combine, Split, Interleave, Crop, Resize, Password,
  Document info, Signatures, OCR, Compare, Batch, Settings (form sheet, every page), About,
  privacy popover, Keyboard shortcuts, ⌘K.
- **Phone:** Library (language switch removed, tools, sample card, Recents, Open PDF dock),
  split top (‹, title ▾ file menu, ⋯), capsule (Pages, n / N, Find, ✎), sheets (Contents,
  Go to page, Document info, About with its settings rows).
- **Toasts and empty states:** Library first run, sidebar empty states, Review, Find, the
  Save receipt, Combine, batch notes.

## Commands: places today → home after

"Title menu" is the document's ▾ menu (01-frame F5). Context menus are listed in brackets and
kept (see above).

| Command | Places today | Home after | Why |
|---|---|---|---|
| **Combine** (the owner's example) | Library launcher *Combine files…* · Library ⋯ *Combine files…* · Library selection bar *Combine N files* · title menu *Combine with open documents…* · ⌘K *Combine with open documents…* · ⌘K *Merge files…* · the Combine sheet's *Add files…* · a card dropped on a card | Library: the launcher's *Combine files…*. Document: the title menu's *Combine with open documents…*. Kept by rule: the selection bar's *Combine N files* (the checked cards), ⌘K's two entries (MOB-10 keeps *Merge files…* as the word people search for), the sheet's *Add files…* (inside the job) and the drop gesture | Library ⋯ row removed: it repeated the launcher button on the same screen |
| Try the sample | Library launcher · Library ⋯ · phone Library card · ⌘K | Launcher (desktop, tablet); the card (phone) | Library ⋯ row removed, same screen |
| Batch… | Library launcher · Library ⋯ · ⌘K | Launcher | Library ⋯ row removed, same screen |
| Settings… | Library ⋯ · dock More · title menu tail · ⌘K · Mod+, | Library ⋯ (Library), dock More (document), short-viewport ⋯ (where the dock steps aside) | Title menu tail removed: it was an interim home "until the dock's More takes them" (F5 §5), and More has |
| Keyboard shortcuts | Library ⋯ (fine pointer) · dock More (every pointer) · title menu tail · ⌘K · ? | Library ⋯ and dock More, fine pointer only | Title menu tail removed; More now hides it on touch as the Library ⋯ already did (02.18) |
| About Recto / About this app | Library ⋯ (*About Recto*) · title menu tail (*About this app*, the web page) · Settings › About (*How Recto works* links the page) · phone ⋯ · ⌘K | Library ⋯ and Settings › About; phone ⋯ | Title menu tail removed. About itself unchanged (B-14) |
| Language | Library footer (English · Türkçe) · phone Library corner (EN · TR) · Settings › Language · ⌘K Language commands | Settings › Language; on the phone, About's settings rows (the phone's settings) | B-7: a setting, not a page control |
| Privacy popover | strip ◎ · Library footer chip "Nothing is uploaded" · title menu line "On this device · nothing uploaded" | strip ◎ in a document; on the Library ◎ only once the monitor counts an external request (a warning earns its place, a reassurance does not) | B-13; the promise stays in the empty welcome's line, Settings › Privacy and About |
| Save | strip Save button · title menu File · Mod+S · ⌘K | Strip Save button; the narrow bar's title menu (no Save button there) | Title menu row shows only in the narrow bar |
| Close document | tab ✕ · tab context menu · title menu File · Mod+W · ⌘K · Library selection bar *Close* (checked cards) | Tab ✕; the narrow bar's title menu (no tabs there) | Same rule as Save |
| Save a copy… | title menu · Mod+Shift+S · ⌘K | Title menu | Unchanged |
| Revert to the opened version… | title menu · ⌘K | Title menu | Unchanged |
| Insert pages from file… | title menu · Pages bar ⋯ at rest · Pages bar ⋯ with a selection · [grid and page context menus] · ⌘K | Title menu (whole document); Pages bar ⋯ with a selection (after the selection) | Removed from the Pages bar's ⋯ at rest, which repeated the title menu row |
| Split… | title menu · Pages bar ⋯ at rest · ⌘K | Title menu | Removed from the Pages bar's ⋯ at rest |
| Interleave with another document… | title menu · Pages bar ⋯ at rest · ⌘K | Title menu | Removed from the Pages bar's ⋯ at rest |
| Crop pages… | title menu · Pages bar ⋯ at rest · Pages bar ⋯ with a selection · dock More · [grid section, page, thumbnail and grid context menus] · ⌘K | Title menu (whole document); Pages bar ⋯ with a selection | Removed from dock More and from the Pages bar's ⋯ at rest |
| Resize pages… | title menu · Pages bar ⋯ at rest · Pages bar ⋯ with a selection · [grid section and grid context menus] · ⌘K | Title menu; Pages bar ⋯ with a selection | Removed from the Pages bar's ⋯ at rest |
| Rotate all ▸ | title menu · [page, thumbnail, grid context menus rotate the pressed pages] · ⌘K | Title menu | Unchanged |
| Recognize text (OCR)… | title menu Convert · dock More · Find's "Recognize text…" prompt on a page without text · ⌘K | Title menu | Removed from dock More. Find's prompt stays: it answers "no text on these pages" where it is asked |
| Compare with… | title menu · dock More · Library selection bar *Compare* (two checked) · 4 · ⌘K | Title menu; the selection bar for two checked cards | Removed from dock More |
| Sign with certificate… | title menu Protect · Markup Sign group *Certificate…* · Markup More tools *Certificate…* · ⌘K | Markup (Fill & sign) | Removed from the title menu; signing lives where people sign |
| Find sensitive data | title menu Protect · Markup More tools · ⌘K | Markup More tools | Removed from the title menu |
| Signatures… (S9) | title menu Protect row (dimmed on an unsigned file) · title menu header facts row on a signed file · ⌘K | The header's facts row (only on a signed file) | Row removed: it duplicated the facts row and sat dimmed on every unsigned file |
| Add bookmark | title menu tail · sidebar Contents ⊕ · ⌘K | Sidebar Contents ⊕ (DSN-26) | Removed from the title menu |
| Set password… · Remove password… · Strip metadata… | title menu Protect · ⌘K | Title menu | Unchanged |
| Page numbers · Header & footer · Bates · Watermark (and their Remove twins) | title menu Add to pages · ⌘K | Title menu | Unchanged |
| Compress… · Export pages as images… · Export as Markdown / text… | title menu Convert · ⌘K | Title menu | Compress moved to the top of Convert (the most used of the four) |
| Document info… | title menu · ⌘K | Title menu | Unchanged |
| Edit text · Redact (tools) | dock More · [page context menu Edit text] · E · ⌘K | Dock More | Unchanged: tools that act on the page in place |
| All commands… (⌘K) | dock More | Dock More | Unchanged |
| Lock | title menu header switch · tab context menu · dock *Locked* (opens the title menu) | Title menu header | Tab context menu kept by rule |
| **Phone:** Find | capsule *Find* · ⋯ *Find* | Capsule | ⋯ row removed |
| **Phone:** Go to page | capsule *n / N* · ⋯ *Go to page* | Capsule *n / N* | ⋯ row removed |
| **Phone:** Share / Download a copy (Changed: Share a copy, Save a copy) | ⋯ · the title's file menu | File menu (split top, the default); ⋯ in the capsule top (`?top=capsule`), which has no file menu | ⋯ rows removed in the split top |
| **Phone:** Document info | ⋯ · file menu | File menu (split top); ⋯ in the capsule top | Same |
| **Phone:** Contents · About Recto | ⋯ | ⋯ | Unchanged |

## The title menu after (DSN-47)

Header, unchanged except the privacy line: the first page, the name (F2), "8 pages · 100 KB",
the status of the changes, a signed file's facts row (opens Signatures), Lock, Hide markup.

1. **File:** Save a copy… · Revert to the opened version… (Save first and Close last only in
   the narrow window's bar).
2. **Pages:** Insert pages from file… · Combine with open documents… · Split… · Interleave with
   another document… · Rotate all ▸ · Crop pages… · Resize pages….
3. **Protect:** Set password… · Remove password… (while there is one) · Strip metadata….
4. **Add to pages:** Page numbers… · Header & footer… · Bates numbering… · Watermark… (each with
   its Remove twin while present).
5. **Convert:** Compress… · Recognize text (OCR)… · Export pages as images… · Export as
   Markdown / text….
6. *(no label)* Compare with… · Document info… (Remove dead links and Save repaired copy while
   they apply).

From 27 rows and three app items to 21 rows on a plain document, and the header loses a row; Protect moved above Add to
pages (passwords are asked for more often than Bates numbers). First focus is Save a copy…;
arrows, Home, End, Right on Rotate all and the `menuitem` roles are unchanged.

The **dock's More** is now Edit text · Redact | All commands… · Keyboard shortcuts (fine
pointer) · Settings…. The **Library's ⋯** is Settings… · Keyboard shortcuts (fine pointer) ·
About Recto. The **Pages bar's ⋯ at rest** is Paste · Select all · Select odd · Select even ·
Insert images…; with a selection it is unchanged. The title menu's Crop pages… and Resize pages… act on the selected pages, else the whole document (as Rotate all), never on the grid's focused cell.

## The phone's menus after (DSN-48)

- **Title ▾ (file menu):** the file's card (name, "PDF · size · pages") · Share or Download a
  copy (or, once changed, the "Changed on this device" group with Share a copy and Save a copy)
  · Document info.
- **⋯:** Contents (when the file has an outline) · About Recto. In the capsule top
  (`?top=capsule`, no file menu) ⋯ also holds the copy rows and Document info.
- **Capsule:** Pages · n / N (Go to page) · Find · ✎.
- **Language:** About › Language (English · Türkçe), with Theme, Reduce motion and Dim pages.

## UI and copy removed (B-13, B-16)

| What | Where | Reason |
|---|---|---|
| Footer "● Nothing is uploaded" chip | Library, bottom left | The owner's example; ◎ and the welcome's line say it already |
| Footer language switch | Library, bottom right | B-7 |
| "EN · TR" switch | phone Library, top corner | B-7; About's settings rows hold it |
| "Nothing leaves this device." under the "Library" title | Library with documents | The empty welcome says it once; every visit with documents repeated it |
| "On this device · nothing uploaded" | title menu header | ◎ sits beside the menu's trigger |
| Settings… · Keyboard shortcuts · About this app | title menu end | Dock More and the Library ⋯ hold them |
| "Built and checked on this device" | Save a copy sheet footer | Reassurance in a working sheet; the receipt toast says "verified" |
| "They stay on this phone." | phone Recents first-run card | The promise above already says "Nothing leaves this phone." |
| "Files are processed on this device." | Batch, while running | Same reassurance; the note keeps what Cancel does |

Copy fixed in Turkish: *Kopya kaydet…* → *Kopyasını kaydet…* (as the phone's *Kopyasını
indir*); *Şununla karşılaştır…* → *Başka bir belgeyle karşılaştır…* (as *Başka bir belgeyle
harmanla…*); the Library ⋯'s *Daha fazla* → *Diğer* (every other ⋯ says *Diğer*); the page
menu's *Sil: sayfa 3* / *Sola döndür: sayfa 3* → *3. sayfayı sil* / *3. sayfayı sola döndür*.

## Message keys

110 keys had no reader after this change (98 already orphaned before it, from earlier
redesigns: `mode_*`, `view_*`, `bar_group_*`, `menu_section_*`, …; 12 freed here:
`library_nothing_uploaded`, `library_external_requests`, `library_language`,
`compact_language`, `save_copy_footer`, `frame_privacy_line`, `frame_app_group`,
`dock_more_ocr`, `dock_more_compare`, `dock_more_crop`, `pages_bar_split`,
`pages_bar_interleave`). All 110 are deleted from `en.json` and `tr.json` (3,174 → 3,064).

## Open taste questions for the owner

1. The phone Library has no way to Settings before a file is open: the language follows the
   browser, and About (from the reader's ⋯) changes it. Should the phone Library get a small ⋯
   (Settings, About)?
2. Context menus still repeat page commands (Crop, Resize, Insert, Rotate) for the pressed
   page. Kept as the platform convention; the owner may want them thinner.
3. The split top's ⋯ on a file without an outline holds only About Recto. Keep it, or fold
   About into the file menu and drop ⋯ there?
4. Sign with certificate… now lives only in Markup's Fill & sign. If testers look for it under
   Protect, it can come back as that section's one signing row (and leave Markup).
