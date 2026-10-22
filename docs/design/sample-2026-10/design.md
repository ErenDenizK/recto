# Recto teaching sample, issue two: design spec

Status: proposal for the owner and the lead. It replaces the four-page sample built by
`tools/fixtures/sample-fixture.ts` (02-library §11, L10) and carries out EDN-9 ("the sample is
rewritten for phones once phone editing ships"). Every claim about what the app does was checked
in the code on 2026-10-15. The code paths are cited where a design choice depends on them.

**Built as v2 (MOB-14, MOB-15).** The visual layer on top of this spec is
[direction-v2.md](direction-v2.md): one night at the cape, page by page, with the lamp tab, the
dark try slip (it replaces §2's pale band), grain and light on the dark grounds, and the √2 type
scale (it replaces §2's sizes). The four files cap at 344 KiB together (it replaces §6's
total). Where this spec and those rows differ, the rows win.

---

## 0. In one paragraph

The sample becomes **the press-week folder of a small independent magazine**. *Margin*
(Turkish edition *Kenar*) is a fictional quarterly. Its issue No. 07 is themed **Light**. The
folder holds the cover proof, the editor's letter, the feature article, a photographer's contact
sheet, a contributor agreement, a letter from the article's subject that arrived by post and was
scanned, the printer's invoice, and the flatplan. Each item is a real document type that people
already handle as PDFs, and each one asks for exactly one Recto feature. A slim **try slip** at
the foot of each page teaches that feature in one line. The same page design is cut into two
files per language: a **full cut** (desktop and tablet, 8 pages) and a **phone cut** (6 pages).
Each cut holds only the pages whose lesson works in that edition, and its copy uses that
edition's own gestures.

---

## 1. Concept

### 1.1 Why a magazine's press week

- **It is the name.** *Recto* is the right-hand page of a printed leaf. A print-production world
  (proofs, contact sheets, flatplans, a printer's invoice) is the one fictional world where
  every PDF job is native, and it does not need explaining.
- **Different document types appear naturally.** A travel journal or a city guide is one
  document type with one voice, so forms, scans and invoices would feel bolted on. An editor's
  folder holds all of them in the same week, for the same issue, with the same people.
- **The pages talk to each other.** Nevin Sarıgül's scanned letter (page 6) asks for two
  corrections to the article on page 3: the lens dates from 1904, not 1906, and Pusula was a
  dog, not a cat. Recognize text finds "1904" in the letter, and Edit text makes the fix in the
  article. The flatplan (page 8) carries the editor's note "swap 4 and 5?", which becomes a real
  reorder. The invoice must have its bank details blacked out before it is forwarded. Each
  lesson is something a person in this world would actually do.
- **It carries the brand without a logo.** The issue's theme, *Light*, is the family's shared
  origin (PRC-13) and Recto's aurora (DSN-5). The cover is the one dark page, a beam of the
  mint-lime-yellow gradient over a graphite sea. Every other page is a white, solid content page
  (DSN-2: content is solid).
- **It is plainly fictional.** No real brand, place, person or bank is used. The footer of each
  page keeps "Recto sample · fictional data", and the article's footnote says so too.

Alternatives considered: a design studio's annual report (a cold, corporate voice, and there is
no honest scan in it); a travel journal (warm, but no invoice or agreement); a city guide (one
voice, and a weak case for edit text). The magazine wins on the variety of document types and on
how much a first-time reader wants to edit the copy.

### 1.2 The cast (all invented)

| Who | Role | Appears on |
|---|---|---|
| *Margin* / *Kenar* | "A quarterly for things at the edge" / "Kenarda kalanların üç aylık dergisi" | all |
| Mira Castell | editor | 2 (signs the letter), 8 (flatplan note) |
| Defne Aras | writer | 3 (byline), 6 (mentioned) |
| Jonah Pell | photographer | 3 (credit), 4 (contact sheet), 2 (an existing note) |
| Nevin Sarıgül | the last keeper of Cape Ardıç lighthouse (TR: Ardıç Burnu feneri) | 3, 6 |
| Pusula | her dog (the article wrongly calls her a cat) | 3, 6 |
| Saltmarsh Press | printer, 12 Ropewalk Lane, Harrowmere | 7 |

Cape Ardıç, Harrowmere and Saltmarsh Press are invented. The Turkish name is used in the English
edition too, so the English file also exercises ı, ç and ğ in the face (Sarıgül, Ardıç).

### 1.3 Two cuts of one design (the owner's "shared PDF")

The owner asked for one shared PDF whose working pages open in each edition. The design is one
set of nine page designs. **Technique (the lead's call, to be recorded as a decision):** the
generator builds those page designs once and writes two cuts per language, not one file that the
app trims at runtime.

| | Full cut `recto-sample-{en,tr}.pdf` | Phone cut `recto-sample-{en,tr}-phone.pdf` |
|---|---|---|
| Editions | desktop and tablet (full edition, EDN-6) | phone (compact edition, EDN-7) |
| Pages | 1 Cover · 2 Letter · 3 Feature · 4 Contact sheet · 5 Agreement · 6 Scan · 7 Invoice · 8 Flatplan | 1 Cover · 2 Letter · 3 Feature · 4 Contact sheet · 5 Agreement · 6 Flatplan (phone) |
| Copy | "choose", "double-click", key hints in parentheses, which tablets simply ignore | "tap", "press and hold", "pinch", the compact edition's labels |
| Cap | ≤ 125 KB (02.14, SAMPLE_MAX_BYTES) | ≤ 90 KB (target; no scan, no invoice) |
| Caching | precached, as today (`vite.config.ts` globPatterns) | runtime CacheFirst on the first Try the sample on a phone; the existing "needs to load once with a connection" state covers being offline |

Why two cuts, and not one file trimmed in the app:

1. **Wording can be true to each edition.** Every lesson line can say "tap" on a phone and
   "double-click" on a computer. One shared file would have to use neutral verbs everywhere, or
   hide text with optional content, which PDFium's text page still extracts and Find would hit.
2. **Structure stays correct.** Page numbers, the contents list, the outline, link
   destinations, the structure tree and `/Lang` are written for the pages that are actually
   present. A runtime subset through the page operations (`newEmptyDocument` +
   `duplicatePages`, as MOB-3's Extract does) has to be checked to keep the tags, the outline
   and the links; a dangling link or outline entry on the phone would be the first defect a
   person meets.
3. **The bytes are still shared.** Pages 1 to 5 are the same drawing code with the same fonts.
   Only the try slips, the folios and the contents differ.

If the owner prefers a single file anyway, the page order above already supports it: pages
shared by both editions come first (1 to 5), full-only pages next (6 to 8), and the phone-only
page last (9). The app would then open pages 1 to 8 on desktop and 1 to 5 plus 9 on a phone. The
cost is neutral wording on the shared pages, plus the risks in point 2.

### 1.4 How copy differs per edition (the rule)

- **Shared pages (1 to 5)** have identical document content in both cuts. Only the try slip
  differs.
- **Full cut:** the verbs are *choose*, *select*, *drag*, *type*. A shortcut goes in
  parentheses after the command name, e.g. "choose Edit text (E)", "press 3", "⌘F / Ctrl+F". A
  tablet user reads past the parentheses, and every line stays true with a finger.
  Double-clicking to edit text is the desktop hover hint (`edit_text_hint`) in Markup only;
  in viewing a double-click selects a word (ADR-0029 §2.3), so no try slip promises one: the
  feature page names Edit text (E) (TXT-20). The tablet equivalent must be checked by hand
  (§7, R-21).
- **Phone cut:** the verbs are *tap*, *press and hold*, *pinch*. Tools are named as the edit
  island names them (Edit, then Pen, Highlight, Text, Sign, Edit text), and the overview uses
  Select, Add and Share (MOB-3, MOB-9).
- **Turkish:** the full and compact editions label some things differently (desktop
  Highlight = "Vurgu" while the phone's selection bar says "Vurgula"; desktop Sign = "İmzala"
  while the phone tile says "İmza"). Where they differ, the copy uses a **verb**
  ("vurgulayın", "imzanızı ekleyin") instead of quoting a label, so it never contradicts the
  UI. Labels are quoted only where they are identical: Metni düzenle, Kalem, Karart, Hassas
  verileri bul, Kopya kaydet.
- The register is *siz* throughout (BR-V3). Copy is sentence case, with no exclamation marks
  and no hype (brand voice, design-language §2).

---

## 2. The page system (applies to every white page)

**Page:** A4, 595.28 × 841.89 pt, no bleed except the cover.

**Grid:**
- Side margins are 56 pt, so the measure runs from 56 to 539.28 (483.28 pt).
- Two columns of 233.64 pt with a 16 pt gutter: column 1 runs 56 to 289.64, column 2 runs
  305.64 to 539.28. The gutter is straight and wider than 2× the word space, which TXT-12
  requires.
- The body baseline grid is 13.5 pt.

**Vertical zones (y measured from the bottom):**

| Zone | y | Content |
|---|---|---|
| Running head | baseline 806, hairline at 797 | left "MARGIN · NO. 07 · LIGHT" / "KENAR · SAYI 07 · IŞIK"; right the page's section name. Inter Bold 6.5, Tc +0.9, MUTED. Tagged as an artifact. |
| Content | 772 down to 100 | |
| Try slip | 56 to 88 (32 pt; 44 pt for two lines) | see below |
| Footer | baseline 34 | "Recto sample · fictional data" left, "3 / 8" right (correct for each cut). Inter 7, MUTED. Artifact. |

**The try slip** is the one teaching device, and it looks the same on every page:
- A rounded rectangle (r 6) filled with PALE across the measure.
- At its left, a 6 pt lime dot (`#c8fb3d`) ringed by a 0.75 pt stroke in lime-800 `#446713`.
  The ring is there because lime alone falls under 1.3:1 on white.
- Then the label "TRY" / "DENEYİN" in Inter Bold 6.5, Tc +0.9, lime-800.
- Then one sentence in Inter 9/12, INK, at most two lines.
- It is tagged as a `P` inside a `Div` with `/Alt`-free text, and read last on the page.

**Colours** (DSN-3 and design-language §3):

| Token | Value | Use |
|---|---|---|
| INK | `#17191E` | headings, UI text |
| BODY | `#33373F` | serif body |
| MUTED | `#6B7079` (5.0:1 on white) | labels, captions, folios |
| RULE | `#D6D9DE` | hairlines, field borders |
| PALE | `#F3F4F6` | try slip, form card |
| LIME | `#C8FB3D` | dots, small marks; fills only on the dark cover |
| LIME-800 | `#446713` | lime-coloured lines and labels on white |
| Cover ground | `#0B0C0E`, sea lines `#2A2D35`, cover text `#F4F5F7`, cover muted `#9AA0AA` | cover only |
| Aurora | mint `#69EAA3` → lime `#CBFF5F` at 59 % → yellow-lime `#EDFA6D` | cover beam only (the mark's gradient, brand README) |

Two colour rules:
- **No blue in the content.** Blue `#4e61ed` is selection on the page, and a blue element would
  read as selected.
- **No lime fill behind text on white pages.** Lime is close to the highlighter inks (design
  language §3.2), so a lime box would look like an existing highlight and confuse the
  Highlight lesson.

**Type** (bundled OFL faces only, `packages/engine/assets/fonts/`):

| Role | Face | Size / leading | Notes |
|---|---|---|---|
| Masthead | Inter Bold | 104 | cover only; Tc −3 allowed (not an edit target) |
| H1 | Inter Bold | 34 / 36 | **Tc 0** (edit target) |
| H2 | Inter Bold | 15 / 18 | |
| Kicker | Inter Bold | 8, Tc +1 | lime-800 |
| Deck | Noto Serif | 13.5 / 19 | |
| Body | Noto Serif | 9.5 / 13.5, first-line indent 9.5 | justified on page 3, ragged elsewhere |
| Lead-in | Noto Serif Bold | 9.5 | first words of page 3's first paragraph |
| Pull quote | Noto Serif | 15 / 20 | |
| UI / lessons | Inter | 9 / 12 | |
| Caption, footnote | Inter | 7.5 / 10 | |
| Figures | Inter, with `tnum` | | tabular figures (DSN-6) for the invoice and the contents |

There is no italic face in the bundle, so the design uses no italics anywhere. Emphasis is
carried by weight, size and the serif/sans contrast.

**Fonts embedded:** Inter Regular, Inter Bold, Noto Serif Regular, Noto Serif Bold. Four
subsets with the fixed subset tags the fixture already uses. JetBrains Mono is used **only as
outlines for the scan raster** and is never embedded, which saves about 7 KB.
- Subset charset: the existing CHARSET (ASCII, Turkish letters, ’‘“”–—…·×) plus € ₺ ■.
- **For Noto Serif Regular and Bold**, also the Latin-1 letters `À–ÿ` and `Œœ`. People will type
  names such as "José" or "Zoë" into the article, and those letters then stay in the page's own
  font (tier 2) instead of falling back to a substitute face. The estimated cost is +3 to
  4 KB.
- `features: { calt: false, liga: false }` for every face. A ligature glyph standing for "fi"
  cannot be split by an edit (`glyphSelection` refuses ranges that split a glyph).

---

## 3. Order and count

| # full | # phone | Page | Document type | Feature taught | Full | Phone |
|---|---|---|---|---|---|---|
| 1 | 1 | Cover | magazine cover proof | links (cover lines open their pages), outline | ✓ | ✓ |
| 2 | 2 | Keeping a light on | editor's letter + contents | select, highlight, Find, pen in the margin, an existing note | ✓ | ✓ |
| 3 | 3 | The last keeper of Cape Ardıç | feature article, 2 justified columns | **edit text** (paragraph editor) | ✓ | ✓ (EDN-17) |
| 4 | 4 | Roll three | photographer's contact sheet | pen, shapes, notes, stamp (phone: pen, text) | ✓ | ✓ |
| 5 | 5 | Contributor agreement | a fillable form | forms fill, then sign | ✓ | ✓ (MOB-1, EDN-14) |
| 6 | — | A letter from the cape | scanned typed letter (image only) | Recognize text (OCR), then Find | ✓ | — (no OCR on phones) |
| 7 | — | Invoice 2026-0412 | printer's invoice | redaction with Find sensitive data | ✓ | — |
| 8 | — | Flatplan | flatplan with 8 miniatures | Pages grid: reorder, rotate, extract; Save vs Save a copy; ⌘K for Compress / Compare | ✓ | — |
| — | 6 | Flatplan (phone) | the same flatplan with 6 miniatures | pinch to the overview, press and hold to move, Select, Add, Share; Save a copy | — | ✓ (MOB-2, MOB-3, MOB-9) |

The full cut has 8 pages and the phone cut has 6. With 6 pages, the phone overview lands at 3
columns (MOB-7: 2 columns only for 4 pages or fewer), which is two full rows.

**Deliberately not given a page:**
- **Compare** needs a second document.
- **Compress** has nothing interesting to do on a 120 KB file.
- **Combine** and **insert from file** need a second file.

The flatplan's slip points to ⌘K for all of these instead. A page that cannot be acted on in
one step would break the "every page works" promise.

---

## 4. Pages

For every page: purpose, layout, exact EN/TR copy, the try slip for each cut, tags, editions,
and its share of the size budget. Bold in copy marks text set in the bold face.

### Page 1: Cover

**Purpose:** the first impression, and the links lesson. It is the only dark page, so it is also
the most recognisable thumbnail in the Library, the Pages grid and the phone overview.

**Layout (full bleed):**
- The background is `#0B0C0E`, covering the whole page.
- **Sea:** 38 horizontal hairlines (0.5 pt, `#2A2D35`) from y 300 down to 130. Their spacing
  grows downward (perspective), drawn as paths.
- **Beam:** a wedge from a lighthouse at (448, 318) opening leftward to the page edge, about
  14° wide, filled with an axial shading (Type 2, the aurora ramp: mint → lime at 59 % →
  yellow-lime, alpha 1). A second, wider wedge at 35 % opacity (ExtGState `ca`) gives it a glow.
- **Lighthouse:** a simple tapered tower, 18 × 72 pt, in `#F4F5F7`, with a lime lamp room. All
  of this is vector, about 3 KB.
- **Masthead** at top-left (x 52, baseline 700): "Margin" / "Kenar" in Inter Bold 104, Tc −3,
  `#F4F5F7`.
- **Issue line** under it (baseline 676): "No. 07 · Light · Autumn 2026" in Inter Bold 11,
  Tc +1, lime.
- **Tagline** at top (baseline 790): Inter 8, cover muted.
- **Cover lines:** three blocks at the bottom left, x 56, on a 76 pt pitch (baselines 244, 168,
  92). Each block is:
  - the page number in Inter Bold 22, lime;
  - the title in Inter Bold 15, `#F4F5F7`;
  - one line of dek in Inter 9.5, cover muted.
- Each cover-line block is one **Link annotation** whose rect is the whole block (≥ 70 pt tall,
  which is ≥ 46 px at phone fit width; R-14).
- **Try slip:** a dark variant at y 28 to 52, with `#16181D` fill and `#F4F5F7` text, plus the
  footer at baseline 14.

**Copy:**

| | EN | TR |
|---|---|---|
| Tagline | A quarterly for things at the edge | Kenarda kalanların üç aylık dergisi |
| Masthead | Margin | Kenar |
| Issue | No. 07 · Light · Autumn 2026 | Sayı 07 · Işık · Sonbahar 2026 |
| Line 1 | **3** The last keeper of Cape Ardıç: thirty-one years, 112 steps, one lamp | **3** Ardıç Burnu’nun son bekçisi: otuz bir yıl, 112 basamak, tek bir fener |
| Line 2 | **4** Roll three: inside the lamp room, twelve frames by Jonah Pell | **4** Üçüncü film: fener odasının içi, Jonah Pell’den on iki kare |
| Line 3 | **5** Write for us: the contributor agreement | **5** Bizim için yazın: yazar sözleşmesi |
| Try (both cuts) | Every line on this cover opens its page. | Bu kapaktaki her satır kendi sayfasını açar. |

In each cut, each cover line links to pages 3, 4 and 5, which exist in both cuts. The outline
(`/PageMode /UseOutlines`) has one entry per page of the cut, titled with the page names in §3.

**Tags:**
- `H1` "Margin" holds the masthead text.
- `P` for the issue line.
- `Figure` for the drawing, with `/Alt`. EN: "A lighthouse at night throwing a lime and mint
  beam across a dark sea". TR: "Gece, karanlık denizin üzerine limon yeşili ve nane rengi bir
  ışık huzmesi düşüren bir deniz feneri".
- A `L` with three `LI`, each `LI > Link` with OBJR and `/Contents` "Go to page 3: The last
  keeper of Cape Ardıç" (TR "3. sayfaya git: …").

**Budget:** about 6 KB (art 3, text 1.5, links and tags 1.5).

### Page 2: Editor's letter and contents

**Purpose:** reading acts: select, copy, highlight, Find, pen. The letter's right-hand margin is
a ruled "margin" for notes (the magazine's name, literally). It also carries one existing sticky
note, so the Review panel (full) and the note layer (phone) have something in them from the
start.

**Layout:**
- Running head, right: "EDITOR’S LETTER" / "EDİTÖRDEN".
- Kicker at baseline 760.
- H1 "Keeping a light on" at baseline 724.
- The letter in Noto Serif 11/16, ragged, x 56 to 372.
- The margin column x 392 to 539:
  - the label "MARGIN NOTES" / "KENAR NOTLARI" in Inter Bold 6.5, Tc +0.9;
  - 18 dotted rules (RULE, 0.5 pt, dash 1 2) on a 20 pt pitch from y 700 down.
- The signature line in Inter Bold 9 after the letter.
- **Contents** below it (from about y 330): an H2 "In this issue" and five rows on a **30 pt
  pitch**. Each row has a tabular page number, a title in Inter 10.5 and a dotted leader. Each
  row is a link over its full width.
- Then the folder group (full cut) or the one-line note (phone cut).
- An **existing Text annotation** (a sticky note, `/Name /Comment`) at the margin beside
  paragraph 1:
  - author `/T` "Jonah Pell", dated 2026-10-01;
  - `/Contents` EN "Can the lens photo run bigger on page 3?", TR "Mercek fotoğrafı 3. sayfada
    daha büyük basılabilir mi?".

**Copy:**

| | EN | TR |
|---|---|---|
| Kicker | EDITOR’S LETTER | EDİTÖRDEN |
| H1 | Keeping a light on | Bir ışığı yanık tutmak |
| P1 | This issue began with a letter. Nevin Sarıgül wrote to us in the spring to say that her lighthouse was going automatic, and that she would like someone to write it down before it was forgotten. We went in June, and again in September, and both times we stayed until the lamp came on. | Bu sayı bir mektupla başladı. Nevin Sarıgül ilkbaharda bize yazdı: feneri otomatiğe geçecekti ve unutulmadan önce birinin bunu yazmasını istiyordu. Haziranda gittik, eylülde yine gittik; ikisinde de fener yanana kadar kaldık. |
| P2 | Every piece in No. 07 is about a light that somebody keeps: a lamp, a darkroom, a kitchen window at four in the morning. None of them is about the light itself. They are about the people who stay awake for it. | 07. sayıdaki her yazı, birinin yanık tuttuğu bir ışığı anlatıyor: bir fener, bir karanlık oda, sabahın dördünde bir mutfak penceresi. Hiçbiri ışığın kendisiyle ilgili değil; hepsi onun için uyanık kalan insanlarla ilgili. |
| P3 | Read slowly. Write in the margins. That is what they are for. | Yavaş okuyun. Kenarlara yazın. Kenarlar bunun için var. |
| Sign-off | **Mira Castell**, editor | **Mira Castell**, editör |
| H2 | In this issue | Bu sayıda |
| Rows | 1 Cover · 2 Editor’s letter · 3 The last keeper of Cape Ardıç · 4 Roll three: inside the lamp room · 5 Write for us | 1 Kapak · 2 Editörden · 3 Ardıç Burnu’nun son bekçisi · 4 Üçüncü film: fener odasının içi · 5 Bizim için yazın |
| Folder (full) | H2 "From the editor’s folder"; rows 6 A letter from the cape (scanned) · 7 The printer’s invoice · 8 Flatplan | H2 "Editörün dosyasından"; 6 Burundan bir mektup (taranmış) · 7 Matbaanın faturası · 8 Sayfa planı |
| Folder (phone) | One line, no links: Three more pages, a scanned letter, the printer’s invoice and the flatplan, are in the sample on a computer or tablet. | Üç sayfa daha, taranmış bir mektup, matbaanın faturası ve sayfa planı, bilgisayar ve tabletteki örnek belgede. |
| Try, full | Select a sentence and highlight it, or press ⌘F / Ctrl+F to find a word. The margin is for your Pen (P). | Bir cümleyi seçip vurgulayın ya da bir sözcüğü bulmak için ⌘F / Ctrl+F’ye basın. Kenar boşluğu Kalem (P) içindir. |
| Try, phone | Select a sentence and tap Highlight. Then tap Edit and write in the margin with the Pen. | Bir cümle seçip Vurgula’ya dokunun. Ardından Düzenle’ye dokunun ve Kalem ile kenar boşluğuna yazın. |

("Vurgula" is quoted in the phone cut only, where the selection bar shows exactly that,
`compact_highlight_action`.)

**Tags:**
- `H1`; `P` ×3; `P` for the sign-off.
- The margin column is an artifact (rules). Its label is a `P`.
- `H2` + `TOC` > `TOCI` > `Link`.
- The note annotation is tagged as `Annot` with OBJR.

**Budget:** about 4 KB.

### Page 3: The feature (the edit-text page)

**Purpose:** the page people should *want* to edit. It is real editorial typography that
exercises the paragraph editor honestly:
- justified columns that reflow and keep their justification (TXT-10, 13, 15, 16);
- mixed weights inside one paragraph and one line;
- Turkish letters;
- growth into free space, and tightening when there is none;
- a heading, a deck, a byline, a caption and a pull quote as separate blocks.

**Layout:**
- Running head, right: "FEATURE" / "DOSYA".
- Kicker "FEATURE · LIGHT" / "DOSYA · IŞIK" at baseline 764, lime-800.
- **H1** at baselines 728 / 692: Inter Bold 34/36, INK, Tc 0, set over the full measure, two
  lines.
- **Deck** at baselines 658 and 639: Noto Serif 13.5/19, BODY, left aligned, measure x 56 to
  476. Two lines; the second must end before 70 % of the measure, which leaves room to add
  words without growing.
- **Byline** at baseline 612: Inter 8.5. "Words"/"Photographs" in Regular, the names in Bold,
  all on one line. A hairline follows at y 600.
- **Column 1** runs x 56 to 289.64, from baseline 580 down. It holds P1 to P4, justified, in
  one BT/ET per line. Under P4 there are **at least 3 empty body lines (40.5 pt)**. Then a
  20 pt hairline, then the **footnote** in Inter 7.5/10, sitting on y 104.
- **Column 2** runs x 305.64 to 539.28, from y 588 down:
  - **Figure:** a vector duotone plate, 233.64 × 120 pt. It shows the first-order lens as
    concentric prism rings, graphite on a darker graphite, with one lime ring (the flame).
  - **Caption** below it, 8 pt gap, Inter 7.5/10, MUTED, 2 lines.
  - Then 13.5 pt space, then **P5** (justified).
  - **Pull quote** with one empty line above and below: a 2 pt LIME-800 rule on its left
    (x 305.64), the text indented 12 pt, Noto Serif 15/20, INK, ragged, 2 to 3 lines.
  - **P6** (justified), ending level with the footnote's baseline or above it.

**Copy (EN):**

- Kicker: FEATURE · LIGHT
- H1: The last keeper of Cape Ardıç
- Deck: For thirty-one years, Nevin Sarıgül climbed 112 steps every evening to light the lamp
  at the end of the cape. In March the light went automatic. She still climbs.
- Byline: Words **Defne Aras** · Photographs **Jonah Pell**
- P1: **The lamp room smells** of brass polish and paraffin, though no paraffin has burned here
  since 1987. Nevin Sarıgül opens the window a hand’s width, as she has every evening since she
  arrived in 1995 with one suitcase and a cat called Pusula. Below us the sea is the colour of
  slate, and the first fishing boats are already leaving the harbour.
- P2: Her job was easy to describe and hard to do: light the lamp at sunset, wind the clockwork
  that turns the lens, keep the glass clean, and write everything in the logbook, the wind, the
  visibility, every ship that passed. She did it alone for thirty-one years, through storms that
  twice took the roof off the oil store.
- P3: In March a small grey box arrived from the coastal authority. It holds a sensor, a battery
  and a radio, and it switches the light on by itself when the evening grows dark enough. Nobody
  has to climb the stairs any more.
- P4: Nobody, that is, except Nevin. She still goes up at dusk, checks that the box has done its
  work, and writes one line in the logbook. Most evenings it is the same line: Light on, all
  well.
- Caption: The first-order lens, made in 1906, still turns once every ten seconds. Photograph:
  Jonah Pell
- P5: The lens is the size of a small room, a beehive of glass prisms that gathers a weak flame
  and throws it twenty-two nautical miles out to sea. Every Sunday she cleans it with a soft
  cloth and a bowl of warm water, one prism at a time.
- Pull quote: “A lighthouse is only a promise that someone is still awake.”
- P6: When I ask whether she minds the box, she laughs. The machine is better at being on time,
  she says, but it does not notice the weather turning, or a boat that is late home. On those
  nights she stays up anyway, with the kettle and the radio, until the last boat is in.*
- Footnote: * Cape Ardıç and everyone in this article are fictional, like every name in this
  sample.

**Copy (TR):**

- Kicker: DOSYA · IŞIK
- H1: Ardıç Burnu’nun son bekçisi
- Deck: Nevin Sarıgül otuz bir yıl boyunca her akşam 112 basamak çıkıp burnun ucundaki feneri
  yaktı. Martta fener otomatiğe geçti. O hâlâ çıkıyor.
- Byline: Yazı **Defne Aras** · Fotoğraf **Jonah Pell**
- P1: **Fener odası pirinç cilası** ve gaz yağı kokuyor, oysa burada 1987’den beri gaz yağı
  yanmadı. Nevin Sarıgül pencereyi bir karış aralıyor; 1995’te tek bir bavul ve Pusula adında
  bir kediyle geldiğinden beri her akşam yaptığı gibi. Aşağıda deniz arduvaz renginde, ilk
  balıkçı tekneleri limandan çıkmaya başlamış bile.
- P2: İşini anlatmak kolaydı, yapmak zor: gün batımında lambayı yakmak, merceği döndüren saat
  mekanizmasını kurmak, camı temiz tutmak ve her şeyi nöbet defterine yazmak; rüzgârı, görüşü,
  geçen her gemiyi. Otuz bir yıl boyunca bunu tek başına yaptı, yağ deposunun çatısını iki kez
  uçuran fırtınalarda bile.
- P3: Martta sahil idaresinden küçük, gri bir kutu geldi. İçinde bir algılayıcı, bir pil ve bir
  telsiz var; akşam yeterince karardığında ışığı kendiliğinden yakıyor. Artık kimsenin
  merdivenleri çıkması gerekmiyor.
- P4: Nevin dışında kimsenin. O hâlâ alacakaranlıkta yukarı çıkıyor, kutunun işini yapıp
  yapmadığına bakıyor ve deftere tek bir satır yazıyor. Çoğu akşam aynı satırı: Işık yandı, her
  şey yolunda.
- Caption: 1906’da yapılan birinci derece mercek hâlâ on saniyede bir tur atıyor. Fotoğraf:
  Jonah Pell
- P5: Mercek küçük bir oda büyüklüğünde: zayıf bir alevi toplayıp yirmi iki deniz mili açığa
  fırlatan, cam prizmalardan bir arı kovanı. Her pazar onu yumuşak bir bez ve bir kâse ılık
  suyla, prizma prizma temizliyor.
- Pull quote: “Fener, birinin hâlâ uyanık olduğuna dair bir sözden ibarettir.”
- P6: Kutuya içerleyip içerlemediğini sorduğumda gülüyor. Makine dakiklikte ondan iyiymiş, diyor,
  ama havanın döndüğünü ya da eve geç kalan bir tekneyi fark etmiyor. O gecelerde çaydanlığı ve
  telsiziyle yine de uyanık kalıyor, son tekne limana girene dek.*
- Footnote: * Ardıç Burnu ve bu yazıdaki herkes kurgusaldır; bu örnek belgedeki bütün adlar
  gibi.

The Turkish copy contains ğ, ş, ç, ö, ü, ı, â and the capitals İ and I. The body text has them
("İşini", "İçinde"), and so does the kicker ("IŞIK"), which must be upper-cased with
`toLocaleUpperCase('tr')`.

**Try slips:**

| Cut | EN | TR |
|---|---|---|
| Full | Choose Edit text (E), then any paragraph, to change its words. Put your name in the byline, or add a sentence to the end of the first column and watch it reflow. | Metni düzenle’yi (E), ardından bir paragrafı seçip sözcüklerini değiştirin. Künyeye kendi adınızı yazın ya da ilk sütunun sonuna bir cümle ekleyip metnin yeniden dizilişini izleyin. |
| Phone | Tap Edit, choose Edit text, then tap any paragraph. Put your name in the byline, or add a sentence and watch the column reflow. | Düzenle’ye dokunun, Metni düzenle’yi seçin ve bir paragrafa dokunun. Künyeye kendi adınızı yazın ya da bir cümle ekleyip sütunun yeniden dizilişini izleyin. |

**Edit targets, in the order a person will meet them:**

| Target | Why it is a good demo | What the editor does |
|---|---|---|
| **Byline** (one line, Inter Regular and Bold spans) | The most delightful first edit ("you wrote this"). It exercises style spans: typing inside a bold name stays bold. | It rewraps within its line, with room to the right edge. |
| **H1** (Inter Bold 34, Tc 0) | A big, visible change ("Cape Ardıç" → your town). A heading is detected (size ≥ 1.15 × body). | Two lines, left aligned. |
| **Deck** (serif 13.5, ragged) | Its second line ends at 70 % or less of the measure, so a few added words fit with no growth. | commit |
| **P4** (justified, last in column 1) | **The main reflow demo.** At least 3 empty lines under it, then the footnote. One added sentence (2 lines) grows into the free space and stays justified, because the stretch cap is taken from its own untouched lines (TXT-15). | `grow` |
| **P2** (justified, mid-column) | It contains "thirty-one" and "the oil store". An addition here has no room, so the editor shows honestly what happens: "Spacing tightened by N %", or the overflow choice. This is the power-user page. | `tighten` / `overflow` |
| **P1** (lead-in in Noto Serif Bold) | It holds the planted error "a cat called Pusula", which the scanned letter corrects, and mixed weights. | commit (same width) |
| **Caption** (Inter 7.5) | It holds the planted error "1906", which the letter corrects (→ "1904"). | commit |
| **Pull quote** (serif 15, ragged) | A larger, ragged block between justified ones. | commit or `grow` |

**How the text must be written** so that the editor sees what a typesetter would have made.
These are fixture rules, and each one is backed by the engine's detection rules in
`packages/engine/src/text-edit/blocks.ts` (steps 1 to 11) and the TXT decisions:

1. **One paragraph never crosses a column.** A paragraph continued in the next column is two
   paragraphs (blocks.ts, known failure modes). Columns break between paragraphs, and the copy
   is fitted to make that true in both languages.
2. **No drop cap.** A large initial spanning lines is detected as a drop cap and **refused**
   (`ParagraphRefusal 'drop-cap'`). The opening is a bold lead-in instead.
3. **Justification by TJ offsets after real space glyphs, never by Tw.** pdf-lib embeds the
   faces as Type 0 / Identity-H, and `Tw` applies only to single-byte code 32, so it would do
   nothing. Use one BT/ET per line with an absolute Tm, and a TJ array whose negative offset
   after each space carries the stretch. This is the "Word style" of
   `tools/fixtures/edit-corpus-fixtures.ts`; reuse its TJ helper. The last line of each
   paragraph is left aligned, with natural spaces.
4. **The fixture's own justification follows the editor's rules**, so untouched and rewritten
   lines look alike:
   - greedy first fit with natural word gaps;
   - stretch only within non-final lines, at most 1.5 × the natural gap (TXT-15's floor);
   - **no hyphenation** anywhere, because the rewrap does not hyphenate.

   The generator **asserts** this per line and per locale. If a line would stretch more, the
   copy or the measure is adjusted, never the rule.
5. **No Tc, no Tz, no text rise in edit targets.** Tracking is only in labels, kickers, the
   running head and the masthead.
6. **Footnote markers at body size** ("*"), never superscripts. Superscripts are folded into
   their line for detection, but the layout has no baseline shift per span, so a rewrap would
   drop the rise.
7. **Captions in Inter, not the body face.** Captions set in the body's font and size join the
   text. The pull quote differs in size by more than 0.5 pt, so it never joins P5 or P6.
8. **One text object per line, never shared between paragraphs** (avoids `shared-object`). No
   clipping paths around text (avoids `clipped`). No Form XObjects for text (avoids `in-form`).
9. **Tags drive the paragraphs:**
   - `H1`, `P` (deck), `P` (byline), `P` ×6;
   - `Figure` (`/Alt`) + `Caption > P`;
   - `BlockQuote > P`;
   - `Note > P` for the footnote.

   Detection groups by `/P`, `/LI`, `/LBody` and `/H1` to `/H6` (blocks.ts step 3), so the
   inner `P` makes captions, quotes and the footnote exact blocks too.
10. **No decoration attached to the reflowing text.** The end mark (■) was dropped: a path
    that sits after a last word would not move with a rewrap.

**Figure alt:**
- EN: "The lighthouse's first-order lens: rings of glass prisms around a small flame".
- TR: "Fenerin birinci derece merceği: küçük bir alevin çevresinde cam prizma halkaları".

**Budget:** about 9 KB. That is the content stream with TJ per line (about 7) plus the tags and
the vector plate.

### Page 4: Roll three (contact sheet)

**Purpose:** the markup page.
- Full edition: pen, shapes (ellipse), notes, stamp ("Approved").
- Phone: pen and text.

A contact sheet is the one real document whose purpose is to be circled and scribbled on.

**Layout:**
- Running head, right: "CONTACT SHEET" / "TEMAS BASKISI".
- Kicker "PHOTOGRAPHS · ROLL 3" / "FOTOĞRAFLAR · FİLM 3".
- H1 "Inside the lamp room" / "Fener odasının içi".
- One line of intro in Noto Serif 11.
- A **4 × 3 grid** of frames, each 108 × 108 pt with 17.76 pt gutters, in x 56 to 539.28 and
  y 610 to 230. The frames sit on a strip of film: a `#17191E` band with sprocket holes drawn
  as small rounded rectangles.
- Each frame is a minimal vector composition in graphite tones (n3 to n9) with at most one lime
  element: the light. The twelve frames are:
  1. the lens rings;
  2. the spiral stair seen from below;
  3. the logbook open;
  4. a kettle on a stove;
  5. the window and the sea;
  6. the lamp lit;
  7. the grey box;
  8. Nevin's hands on the brass;
  9. the beam over water;
  10. Pusula's bowl;
  11. the door at dusk;
  12. the empty stair.

  They are drawn at 20 to 40 path operators each.
- Under each frame there is a frame code in Inter 7, `tnum`, MUTED: "3/01" … "3/12".
- At the bottom, a printed instruction from the photographer, as on real sheets: Inter 9,
  "Pick one for page 3. — J.P." / "3. sayfa için birini seçin. — J.P."
- Free space under the grid (y 210 to 100) for notes.

**Try slips:**

| Cut | EN | TR |
|---|---|---|
| Full | Circle the frame you would print with the Pen (P) or an ellipse (O), stamp it Approved, and add a note (N) to say why. | Basılacak kareyi Kalem (P) ya da elips (O) ile daire içine alın, Onaylandı damgası vurun ve nedenini bir notla (N) yazın. |
| Phone | Tap Edit and circle the frame you would print with the Pen. Text adds a few words beside it. | Düzenle’ye dokunun ve basılacak kareyi Kalem ile daire içine alın. Metin, yanına birkaç sözcük eklemenizi sağlar. |

**Tags:**
- `H1`, `P`.
- One `Figure` for the whole sheet, with `/Alt`:
  - EN: "Contact sheet of twelve photographs from the lamp room: the lens, the stair, the
    logbook, a kettle, the sea, the lamp, the grey box, the keeper's hands, the beam, a dog's
    bowl, the door at dusk, the empty stair".
  - TR: "Fener odasından on iki fotoğraflık temas baskısı: mercek, merdiven, nöbet defteri, bir
    çaydanlık, deniz, lamba, gri kutu, bekçinin elleri, ışık huzmesi, bir köpek kabı,
    alacakaranlıkta kapı, boş merdiven".
- The frame codes are artifacts.

**Budget:** about 7 KB (paths dominate). If over, cut to 9 frames (3 × 3).

### Page 5: Contributor agreement (form)

**Purpose:** forms fill on both editions:
- on the phone, by a tap with the fill bar (MOB-1);
- on desktop and tablet, by click and Tab.

The person then signs with the Sign tool (a picture of a signature, `tool_signature_tooltip`).

**Do not add a /Sig field.** On desktop an unsigned signature field opens a notice ("A
placeholder for a signature. This app does not sign…", `FormLayer.tsx` SignatureNotice), while
on the phone it opens Sign. One element would behave two ways and contradict the lesson. The
signature place is a drawn line with "×".

**Layout:**
- Running head, right: "AGREEMENT" / "SÖZLEŞME".
- H1 "Contributor agreement" / "Yazar sözleşmesi".
- A sub-line "Margin No. 07 · Light" / "Kenar Sayı 07 · Işık".
- The terms in Noto Serif 10/14.5, ragged, 2 short paragraphs.
- The form card: PALE fill, r 10, x 56 to 539.28, padding 20.

**Fields** are on a **72 pt row pitch**:
- 72 pt × 0.655 px/pt is 47 px at a 390 px phone's fit width, so neighbouring targets never
  overlap even before MOB-1's 44 px nearest-field rule.
- Text fields are **26 pt tall**, with a fixed **11 pt DA** (never auto 0, so `fieldZoom` lands
  at a predictable 16 px), a white fill and a RULE border.
- Text fields are **at most 250 pt wide**, so at the MOB-1 zoom (11 pt → 16 px, about
  2.2 × fit) the field still fits a 390 px screen.

| Row | Field (name, type) | Width | EN label / TU | TR label / TU |
|---|---|---|---|---|
| 1 | `name` text | 250 | Your name | Adınız soyadınız |
| 1 | `date` text | 150 | Date | Tarih |
| 2 | `email` text | 250 | Email | E-posta |
| 3 | `fee` radio, export `transfer` | 14 × 14 | Pay my fee of €240 by bank transfer | 240 € ücretimi banka havalesiyle ödeyin |
| 3b | `fee` radio, export `trust` (32 pt below, same group) | 14 × 14 | Give my fee to the Cape Ardıç Lighthouse Trust | Ücretimi Ardıç Burnu Feneri Vakfı’na bağışlayın |
| 4 | `agree` checkbox | 14 × 14 | I have read this agreement and accept it. | Bu sözleşmeyi okudum ve kabul ediyorum. |
| 5 | signature line (not a field) | 250 | Signature | İmza |

Row 3b sits 32 pt under row 3, which is closer than the 72 pt pitch. The two radios belong to
one group, and MOB-1's nearest-field rule resolves between them. The rows *between groups* keep
72 pt.

**Terms copy:**

- EN P1: Thank you for writing for Margin. This agreement covers your piece in No. 07. We may
  print it once in this issue and keep it in our online archive.
- EN P2: Everything else stays yours. You may publish the piece anywhere from 1 January 2027.
  We pay within 30 days of publication.
- TR P1: Kenar için yazdığınız için teşekkür ederiz. Bu sözleşme, 07. sayıdaki yazınızı
  kapsar. Yazınızı bu sayıda bir kez basabilir ve çevrimiçi arşivimizde tutabiliriz.
- TR P2: Diğer bütün haklar sizde kalır. Yazınızı 1 Ocak 2027’den itibaren dilediğiniz yerde
  yayımlayabilirsiniz. Ücretinizi yayından sonraki 30 gün içinde öderiz.

**Try slips:**

| Cut | EN | TR |
|---|---|---|
| Full | Choose a field and type; Tab moves to the next one. Then add your signature on the line with Sign (G). | Bir alanı seçip yazın; Sekme tuşu sonrakine geçer. Ardından İmzala (G) ile çizginin üzerine imzanızı ekleyin. |
| Phone | Tap a field and type; › on the bar moves to the next. Then tap Edit, choose Sign, and sign on the line. | Bir alana dokunup yazın; çubuktaki › sonrakine geçer. Ardından Düzenle’ye dokunun, İmza’yı seçin ve çizginin üzerine imzanızı atın. |

("İmzala" and "İmza" are quoted only in the cut whose UI shows them: `tool_signature` and
`compact_tool_sign`.)

**Tags:**
- `H1`, `P` ×3.
- A `Form` element per widget, with OBJR, as today.
- Every field has a `/TU` (the label above), which is its accessible name.
- Field labels drawn on the page are `P`, or artifacts when the `/TU` repeats them.

`SAMPLE_FIELDS` becomes `['name', 'date', 'email', 'fee', 'agree']`.

**Budget:** about 6 KB (fields and appearance streams about 3 KB).

### Page 6 (full only): A letter from the cape (scan)

**Purpose:** Recognize text, then Find. It is a realistic artefact rather than a page that
announces "this is a scan".

The **page is one greyscale image and nothing else.** No vector text at all, so the facts chip
reads "No text on 1 page · Recognize" and the OCR sheet's default scope ("pages without visible
text", `OcrSheet.tsx`) picks exactly this page. The footer and the try slip are **in the
raster**:
- the footer as today;
- the try slip as a printed routing label paper-clipped to the letter's foot.

OCR will also read the label, and that is harmless: it even makes the lesson searchable.

**The raster** (`lib/raster.ts`, glyph outlines through fontkit, seeded PRNG, deterministic):
- A4 at **150 dpi** (1240 × 1754), as today. An 11 pt monospace has an x-height of about 12 px
  at 150 dpi, and the OCR "Standard" quality renders scans at their own resolution with a floor
  of 200 dpi (`ocr_quality_standard_hint`).
- **The scanner bed:** a flat lid tone (value 246). This compresses to almost nothing.
- **The sheet:** A5 portrait (420 × 595 pt) at the upper left (x 40, y 200 from the top),
  **rotated 0.7°**, with:
  - a 3 px soft shadow along its right and bottom edges;
  - a paper tone that is a *low-frequency* gradient (lid vignetting, 236 to 244), with no
    per-pixel noise;
  - one horizontal **fold** at 50 % (a 2 px lighter line over a 6 px darker band);
  - about 40 dust specks (as today).
- **The type:** JetBrains Mono outlines at 11 pt, ink value 40 to 70 varying per glyph (a
  typewriter's uneven strike), and a baseline jitter of ±0.3 px. Margins inside the sheet are
  36 pt; at 6.6 pt per character that gives 52 characters per line.
- **The stamp:** a rounded rectangle in mid-grey (value 120 at 70 % ink), rotated −5°, at the
  sheet's top right and outside the text block. Text in Inter Bold 9: "RECEIVED 2 OCT 2026" /
  "ALINDI 2 EKİM 2026".
- **The signature:** one stroked Bézier scribble (a filled outline of a 1.2 pt pen) above the
  typed name.
- **The routing label:** a white label with a 0.5 pt grey border, under the sheet at y 1480 to
  1560 px. A small dot, then "TRY" / "DENEYİN", then the try line in Inter 9.
- **Encoding:** 8-bit DeviceGray, FlateDecode **with the PNG Up predictor** (`/DecodeParms
  << /Predictor 12 /Colors 1 /Columns 1240 >>`). The smooth paper becomes runs of zeros. The
  fallback, if a byte budget is missed, is 4 bits per component. PDFium decodes both. The
  Compress table skips only 1-bit images.

**Letter copy (typed, line breaks as typed):**

EN:
```
The Lighthouse
Cape Ardıç

29 September 2026

Dear Mira,

Thank you for the proofs. Defne has been kinder
to me than the wind was last winter.

Two small corrections. The lens was made in
1904, not 1906. And Pusula was a dog, not a
cat. She would be offended.

You asked what I write in the logbook now. Last
night it was: wind NE 4, visibility good, two
boats out, two boats home, lamp on at 18:52.
All well.

Come in October if you can. The light is best
after the first storm.

With my regards,
[signature]
Nevin Sarıgül
```

TR:
```
Fener Evi
Ardıç Burnu

29 Eylül 2026

Sevgili Mira,

Provalar için teşekkür ederim. Defne bana geçen
kışın rüzgârından çok daha nazik davrandı.

İki küçük düzeltme var. Mercek 1906’da değil,
1904’te yapıldı. Pusula da kedi değil, köpekti.
Duysa gücenirdi.

Nöbet defterine artık ne yazdığımı sormuşsunuz.
Dün akşam şunu yazdım: rüzgâr KD 4, görüş iyi,
iki tekne çıktı, iki tekne döndü, fener 18.52’de
yandı. Her şey yolunda.

Fırsat bulursanız ekimde gelin. Işık en güzel
ilk fırtınadan sonra olur.

Saygılarımla,
[imza]
Nevin Sarıgül
```

**Try (in the raster label):**
- EN: "Choose Recognize text, then find “1904”. Nevin asks for two corrections: make them on
  page 3 with Edit text."
- TR: "Metni tanı’yı seçin, ardından “1904”ü bulun. Nevin iki düzeltme istiyor: bunları 3.
  sayfada Metni düzenle ile yapın."

(The Turkish dock row reads "Metni tanı…", `dock_more_ocr`.)

**Tags:** one `Figure` with `/Alt`:
- EN: "Scanned typed letter from Nevin Sarıgül to Mira Castell, no text layer".
- TR: "Nevin Sarıgül’ün Mira Castell’e daktiloyla yazdığı taranmış mektup, metin katmanı yok".

After OCR, the engine's invisible text layer does the rest.

`SAMPLE_SCAN_PAGE` becomes 6.

**Budget: ≤ 34 KB**, which is the largest item. It was 47 to 51 KB for today's mostly white
page, and the gain comes from the flat bed, the smooth paper and the predictor. It must be
measured in the first spike (§6).

### Page 7 (full only): Printer's invoice

**Purpose:** redaction with **Find sensitive data**. The finder (`redaction/patterns.ts`)
detects email, IBAN (mod-97), card (Luhn), TCKN (checksum), phone and dates. An invoice is
where those really sit, and "black out the bank details before forwarding" is a real errand.

**Layout:**
- Running head, right: "INVOICE" / "FATURA".
- Top left: "Saltmarsh Press" in Inter Bold 18, and "Printers since 1961 · 12 Ropewalk Lane,
  Harrowmere" in Inter 8.5, MUTED.
- Top right: "Invoice 2026-0412" / "Fatura 2026-0412" in Inter Bold 13, and the date
  "15 October 2026" / "15 Ekim 2026".
- "Bill to: Margin, Mira Castell" / "Fatura adresi: Kenar, Mira Castell".
- A table on a 22 pt row pitch: description on the left, amount right-aligned, `tnum`, Inter
  9.5, and a hairline between rows. The amount column's right edge is at 539.28.
- The totals block.
- The payment box: a PALE card holding the bank details and the contacts.

**Table EN (GBP):**

| Description | Amount |
|---|---|
| Printing, Margin No. 07: 1,200 copies, 48 pages, uncoated 100 g/m² | £2,640.00 |
| Cover: 300 g/m², one special colour | £420.00 |
| Proofs, two rounds | £90.00 |
| Delivery to the studio | £60.00 |
| Subtotal / VAT 20 % / **Total** | £3,210.00 / £642.00 / **£3,852.00** |

**Table TR (TRY):**
- Baskı, Kenar Sayı 07: 1.200 adet, 48 sayfa, kuşesiz 100 g/m²: 92.400,00 ₺
- Kapak: 300 g/m², tek özel renk: 14.700,00 ₺
- Provalar, iki tur: 3.150,00 ₺
- Stüdyoya teslimat: 2.100,00 ₺
- Ara toplam 112.350,00 ₺ / KDV %20 22.470,00 ₺ / **Toplam 134.820,00 ₺**

**Payment box.** The values are chosen to be detectable and safely fictional:

| | EN | TR |
|---|---|---|
| IBAN | GB82 WEST 1234 5698 7654 32 (the SWIFT registry's published example) | TR33 0006 1005 1978 6457 8413 26 (the registry's published example) |
| Email | accounts@saltmarsh-press.example (`.example` is reserved, RFC 2606) | the same |
| Phone | +44 7700 900412 (Ofcom's range for drama, 07700 900000 to 900999) | +90 212 000 04 12 (a subscriber number cannot start with 0, so it is unassignable; check, R-16) |
| Payment terms | Payment within 30 days. Please quote the invoice number. | Ödeme 30 gün içindedir. Lütfen fatura numarasını belirtin. |

There is no card number and no TCKN: an invoice has no reason to carry them.

**Try slip (full only):**
- EN: "Before you forward this invoice, black out the bank details: choose Redact (X), then
  Find sensitive data, then Apply redactions."
- TR: "Bu faturayı iletmeden önce banka bilgilerini karartın: Karart’ı (X), ardından Hassas
  verileri bul’u, sonra Karartmaları uygula’yı seçin."

**Tags:**
- `H1` (the printer's name), `P`.
- `Table > TR > TH/TD`. This is not a paragraph tag, so detection falls back to geometry
  `cell`s; the invoice is not an edit target.

**Budget:** about 4 KB.

### Page 8 (full only): Flatplan

**Purpose:**
- the Pages grid: reorder, rotate, extract, delete;
- the meaning of Save vs Save a copy;
- the pointer to ⌘K for what has no page (Compress, Compare, Combine).

**Layout:**
- Running head, right: "FLATPLAN" / "SAYFA PLANI".
- Kicker "FLATPLAN · NO. 07" / "SAYFA PLANI · SAYI 07".
- H1 "Put the issue in order" / "Sayıyı sıraya koyun".
- **Eight miniatures** in a 4 × 2 grid, each 96 × 136 pt (A4 ratio), with a RULE border. Each
  is a simplified drawing of the real page, generated from the same layout constants (the
  cover dark, the scan grey, and so on). They follow today's `miniature()` approach.
- A number label under each miniature, Inter 8, `tnum`.
- An editor's note in a PALE card, Inter 9: "**Mira:** the contact sheet should follow the
  agreement. Swap 4 and 5?" / "**Mira:** temas baskısı sözleşmeden sonra gelmeli. 4 ile 5’in
  yerini değiştirelim mi?"
- An H2 "Kept, then saved" / "Önce saklanır, sonra kaydedilir" followed by two lines (below).
- A closing line in MUTED.

**Copy:**

| | EN | TR |
|---|---|---|
| Kept 1 | Your changes are kept on this device. Save (⌘S / Ctrl+S) writes them into the file. | Değişiklikleriniz bu cihazda saklanır. Kaydet (⌘S / Ctrl+S) onları dosyaya yazar. |
| Kept 2 | Save a copy writes a new file and leaves this one as it is. | Kopya kaydet yeni bir dosya yazar, bu dosyayı olduğu gibi bırakır. |
| More | ⌘K or Ctrl+K finds every command: try “compress” or “compare”. | ⌘K ya da Ctrl+K her komutu bulur: “sıkıştır” ya da “karşılaştır” yazmayı deneyin. |
| End | That is the whole issue. Open your own PDFs whenever you are ready. | Sayı bu kadar. Hazır olduğunuzda kendi PDF’lerinizi açın. |
| Try | Press 3 or choose Pages to see every page, then drag page 4 after page 5. A page’s menu rotates, extracts or deletes it. | Bütün sayfaları görmek için 3’e basın ya da Sayfalar’ı seçin, sonra 4. sayfayı 5. sayfanın arkasına sürükleyin. Bir sayfanın menüsü onu döndürür, ayıklar ya da siler. |

**Tags:**
- `H1`, `P`, `H2`, `P`.
- One `Figure`, alt EN: "Miniatures of the eight pages of this sample in order: cover,
  editor's letter, feature, contact sheet, agreement, scanned letter, invoice, flatplan". TR:
  "Bu örnek belgenin sekiz sayfasının sırayla küçük resimleri: kapak, editörden, dosya, temas
  baskısı, sözleşme, taranmış mektup, fatura, sayfa planı".

**Budget:** about 4 KB.

### Page 6 of the phone cut: Flatplan (phone)

**Purpose:** the phone's page acts:
- pinch to the overview (MOB-2);
- press and hold to move, then Select, Rotate, Delete, Add and Share (MOB-3, MOB-9);
- Save a copy and Share a copy (EDN-14).

**Layout:**
- The header as on page 8.
- **Six miniatures** in a 3 × 2 grid. Larger tiles, 136 × 192 pt, mirror the phone overview's
  3 columns.
- The Mira note: "Swap 4 and 5?"
- The lines below, in Inter 10.5/15. Larger than desktop, because these are read at fit width
  on a phone, where 10.5 pt ≈ 6.9 px. They are meant to be read after zooming, and nothing on
  this page needs a tap target.

**Copy:**

| | EN | TR |
|---|---|---|
| Kicker | FLATPLAN · NO. 07 | SAYFA PLANI · SAYI 07 |
| H1 | Every page at once | Bütün sayfalar bir arada |
| Line 1 | Pinch any page smaller to see them all. Tap a page to go back into it. | Bütün sayfaları görmek için herhangi bir sayfayı iki parmağınızla küçültün. İçine dönmek için bir sayfaya dokunun. |
| Line 2 | Press and hold a page, then drag it to move it. Select lets you rotate, delete or share pages; Add brings in pages from another file. | Bir sayfayı taşımak için basılı tutup sürükleyin. Seç ile sayfaları döndürebilir, silebilir ya da paylaşabilirsiniz; Ekle, başka bir dosyadan sayfa getirir. |
| Kept | Your changes stay on this device. When you are done, choose Save a copy or Share a copy in the More menu. | Değişiklikleriniz bu cihazda kalır. İşiniz bitince Diğer menüsünden Kopya kaydet’i ya da Kopyasını paylaş’ı seçin. |
| Desktop | The scanned letter, the invoice and every other tool are in the sample on a computer or tablet. | Taranmış mektup, fatura ve diğer bütün araçlar bilgisayar ve tabletteki örnek belgede. |
| End | That is the whole issue. Open your own PDFs whenever you are ready. | Sayı bu kadar. Hazır olduğunuzda kendi PDF’lerinizi açın. |
| Try | Pinch this page smaller, then press and hold page 4 and drag it after page 5. | Bu sayfayı iki parmağınızla küçültün, sonra 4. sayfayı basılı tutup 5. sayfanın arkasına sürükleyin. |

The labels Seç, Ekle, Diğer, Kopya kaydet and Kopyasını paylaş are the compact edition's own
(`compact_overview_*`, `compact_more`, `compact_save_*`).

**Tags:** as on page 8, with the alt text listing six pages.

**Budget:** about 3.5 KB.

---

## 5. Accessibility (the whole file)

- **Tagged PDF:** `/MarkInfo << /Marked true >>`, `/StructTreeRoot` with `Document` > per-page
  `Sect` > the elements listed per page.
- `/Lang (en)` or `(tr)` on the catalog, and `/ViewerPreferences << /DisplayDocTitle true >>`.
- **Artifacts:** running heads, folios, rules, the film strip, sprocket holes, the margin's
  dotted rules and the sea lines.
- **Reading order** follows content order. On page 3 that is: kicker, H1, deck, byline,
  column 1 (P1 to P4, footnote), then column 2 (figure, caption, P5, quote, P6), then the try
  slip.
- **Every figure** has `/Alt` in its file's language, with the exact text given per page above.
- **Every form field** has `/TU`. Every link has `/Contents` and a `Link` structure element
  with OBJR.
- **Contrast:**
  - Body text `#33373F` on white is about 12:1.
  - MUTED is 5.0:1; it is never used under 7.5 pt.
  - LIME-800 on white is about 6.4:1 and on PALE about 5.9:1.
  - The cover's text `#F4F5F7` on `#0B0C0E` is about 18:1, and cover muted is about 7:1.
  - Lime on the cover ground is about 16:1.
- **The outline** has one entry per page of the cut, with the titles from §3.

---

## 6. Size budget

The estimates are from today's file: three subsets at about 7.2 to 8 KB each, and the scan at
47 to 51 KB.

| Item | Full EN | Full TR | Phone EN/TR |
|---|---|---|---|
| Inter Regular, Inter Bold subsets | 15 | 15 | 15 |
| Noto Serif Regular, Bold subsets (+ Latin-1) | 19 | 19 | 19 |
| Page 1 cover | 6 | 6 | 6 |
| Page 2 letter | 4 | 4.5 | 4 |
| Page 3 feature | 9 | 10 | 9 |
| Page 4 contact sheet | 7 | 7 | 7 |
| Page 5 agreement | 6 | 6.5 | 6 |
| Page 6 scan | 34 | 36 | — |
| Page 7 invoice | 4 | 4.5 | — |
| Page 8 flatplan / phone flatplan | 4 | 4 | 3.5 |
| Structure tree, outline, annotations, xref, info | 8 | 8 | 6 |
| **Total** | **≈ 116 KB** | **≈ 120.5 KB** | **≈ 75.5 KB** |
| Cap | 125 KB (128,000 B) | 125 KB | 90 KB target |

The margin is thin (4.5 KB on Turkish). **Order of cuts if a build is over:**
1. Scan: switch to 4 bits per component (saves about 8 KB).
2. Contact sheet: 9 frames (saves about 2 KB).
3. Drop Latin-1 from Noto Serif Bold, keeping Regular (saves about 2 KB).
4. Simplify the cover sea to 24 lines (saves about 1 KB).

The generator keeps failing the build above the cap, as today. A **spike** that builds only the
scan and the feature page should come first, before any copy polish, to confirm the two biggest
numbers.

---

## 7. Risks and how the design avoids them

| # | Risk | Mitigation |
|---|---|---|
| R-1 | A drop cap is refused (`drop-cap`) and would fail the first edit people try. | No drop cap; a bold lead-in instead. |
| R-2 | A paragraph broken across columns becomes two paragraphs, and an edit then reflows only half. | Columns break between paragraphs; the copy is fitted per locale, and the generator asserts it. |
| R-3 | `Tw` does nothing on Identity-H fonts, so justification would silently fail and lines would read as ragged. | TJ offsets after real space glyphs (TXT-8/10/16), one BT/ET per line. |
| R-4 | The original lines look different from rewrapped ones (wider gaps, hyphens). | The fixture justifies by the editor's own rules: natural gap, stretch ≤ 1.5 ×, no hyphenation. Asserted. |
| R-5 | Superscript footnote markers lose their rise on a rewrap. | "*" at body size. |
| R-6 | A ligature glyph cannot be split by an edit. | `liga: false` (and `calt: false`) on every face. |
| R-7 | Typed letters outside the subset fall back to a substitute face (mixed fonts after an edit). | Full CHARSET plus Latin-1 on the serif faces. Characters beyond that still use the bundled Noto substitutes, honestly labelled by the editor. |
| R-8 | Text grows into the footnote, the figure or the try slip. | P4 has ≥ 3 free lines. P2 is *meant* to show tighten/overflow. TXT-3 counts the slip and figure paths as obstacles. |
| R-9 | Captions or the pull quote join the body during detection. | Inter captions; a pull quote 5.5 pt larger with a blank line around it; tags with an inner `P`. |
| R-10 | A shared text object, a clip or a form XObject makes paragraph mode refuse (`shared-object`, `clipped`, `in-form`). | One object per line per paragraph; no clip paths or XObjects around text. |
| R-11 | OCR reads Turkish with English only: the OCR sheet defaults to *UI language + English*, so an English UI opening `?sample=tr` misreads ğ, ş and ı. | Suggested app change: add the document's `/Lang` to `defaultLanguages`. Until then, the Turkish file is fine in a Turkish UI. |
| R-12 | The first OCR use downloads a language pack and needs a connection. | Already handled by the sheet ("Downloads {size}"). The lesson does not promise offline. |
| R-13 | The stamp and the signature produce junk or low-confidence words. | The stamp sits outside the text block; the scribble is small and below the text. Whatever remains shows in Review with J/K, which is itself a lesson. Rotation is only 0.7°. |
| R-14 | Phone tap targets: 44 px at fit is 67 pt. | Cover lines and form rows are on a 72 to 76 pt pitch. Contents rows (30 pt ≈ 20 px) are **below target at fit**, so they are a secondary path, and the cover lines are the links lesson on phones. Do not teach contents links on the phone. |
| R-15 | A form field wider than the screen after MOB-1's zoom. | ≤ 250 pt wide; fixed 11 pt DA. |
| R-16 | Redaction data that belongs to someone real. | Registry example IBANs, `.example` email, Ofcom drama number. Check the TR phone number once against the national plan. |
| R-17 | A /Sig field behaves differently per edition. | Not used; a drawn signature line and the Sign tool. |
| R-18 | Lime or blue in the content reads as a highlight or a selection. | Lime only as dots, rules and labels on white; blue never. |
| R-19 | Size over 125 KB, mostly the scan. | §6 budget, spike first, ordered cuts. |
| R-20 | Tests and other parts of the app pin the old sample. | See the list below. |
| R-21 | On iPad, "double-click a paragraph" may not be the touch path into edit text. | Hand-check on the iPad (PRC-9 task script). If double-tap does not open it, the full slip becomes "Double-click a paragraph, or choose Edit text (E) and tap it." |
| R-22 | The dark cover against the app's themes. | Pages are content and solid in both themes (DSN-2). The cover is dark by design and thumbnails show it the same. Glyphs on the dark ground are not edit targets. |
| R-23 | Fictional names that match a real person. | The footer and footnote say "fictional data". Search the four personal names once before shipping. |
| R-24 | Two Turkish UI labels differ by edition (Vurgu/Vurgula, İmzala/İmza). | Verb-based copy, labels quoted only per cut (§1.4). |

**Things the old sample pinned (R-20):**
- `SAMPLE_PAGE_COUNT` (4 → 8; phone 6) and `SAMPLE_SCAN_PAGE` (3 → 6).
- `SAMPLE_FIELDS`.
- `e2e/sample.spec.ts`: "1 / 4", and Fill & sign bringing the form (now page 5) into view.
- `sample-fixture.test.ts`.
- The phone Library's static drawing of the first page (`CompactLibrary.tsx`, DSN-31), which
  must be redrawn as the new cover.
- 02-library §11 itself.
- `vite.config.ts` precache: the full cut stays precached; the phone cut goes to runtime cache.
- `openSample` picks the phone file on the compact edition.

---

## 8. What to record and decide

**For the owner (taste):**
- The world: a magazine's press week, *Margin* / *Kenar*, issue *Light*.
- The dark cover.
- The planted errors that the letter corrects.
- The phone cut's own flatplan page.

**For the lead (technique; add DSN or EDN rows):**
- two cuts generated from one design, rather than a runtime subset;
- precache only the full cut;
- TJ justification and the copy-fit assertions;
- the 4-face subset plus Latin-1 on the serif faces;
- the scan encoding;
- no /Sig field;
- the `/Lang`-aware OCR default (a small separate change).
