# Niyet çubuğu (intent bar): build spec

Status: spec for the lead, 2026-10-31. Decisions reserved: **PRD-39** (the intent bar) and
**PRD-40** (Save a copy takes a request from the bar). Their rows are in §9.
Source of truth read: `origin/develop` at `80a5b90d`/`e7442ee9` (no command, palette or export
change between them).

The move, as the owner approved it: ⌘K stops being only a command list and reads sentences in
Turkish and English, on the device, with no model and no server. It parses what is typed, shows
what will happen in a live preview, runs it on Enter, and ⌘Z takes it back. This is R12 E10
"phase 3" (plain-language plans) done with the PRD-23 rule grammar, so PRD-9 (no on-device model)
still holds; PRD-39 lifts only PRD-23's "phase 3 stays out" clause.

"Niyet çubuğu" is the internal name of the move. The user-facing name stays "Command palette /
Komut paleti" unless the owner says otherwise (open question Q3).

---

## 1. Current state

### 1.1 How ⌘K works today

| Piece | File | What it does |
|---|---|---|
| Open/close | `commands/app-commands.ts` (`view.palette`, Mod+K, `allowInInputs`) → `ui-store.paletteOpen` | Toggles the palette; the Dock's "More commands" button runs the same command (tablet). |
| UI | `shell/CommandPalette.tsx` (773 lines) + `.module.css` | Base UI `Dialog`, APG combobox (focus stays in the input, `aria-activedescendant`). Sections in order: **intent** (`data-intent`), scope ("For 3 selected pages", PRD-29), suggested for this document, recent files, open documents, command groups. `useDeferredValue(query)` drives the list. Enter runs `active.run()`. The intent module is lazy: `loadIntents()` imports `commands/palette-intent` on the first open. |
| Ranking | `commands/fuzzy.ts` | `foldForSearch` (Turkish-aware, diacritic-free, **length-preserving** fold), `fuzzyFilter`, the PRD-23 score floor `isMeaningfulMatch`. |
| Parser | `commands/query.ts` (410 lines, PRD-23) | Pure `parseQuery(query, ctx) → QueryIntent \| null`. One intent per query: page jump, page-range action (`rotate`, `delete`, `duplicate`, `extract` over `3-7`, lists, even/odd, all, first/last N, this page; rotate takes left/right/degrees), recent file, heading jump, or `invalid` with a reason (`no-document`, `out-of-range`, `reversed-range`, `no-pages`, `all-pages`, `ambiguous-count`). A phrase is accepted only when every word is understood. `normalise()` folds, drops number suffixes (`7'ye`), ordinal dots (`4.`), joins ranges (`3 ile 7`, `3..7`, `3 to 7`), and turns `and/ve/,` into list spaces. |
| Rows and runs | `commands/palette-intent.ts` (226 lines) | `gatherQueryContext()` (page count, current page, outline headings, recents), `describeIntent()` (row label + quiet detail, both languages), `runIntent()` (selects the resolved pages, runs the page command through `commandRegistry.execute`, restores the selection; a half turn is `rotateDocumentPages(180)`). |
| Registry | `commands/registry.ts` | `CommandDefinition` with `act`, `via` (`markup`/`sheet`), `when`, `reason`, `keywords`. `isEnabled`, `disabledReason`, `refusalOf` (the change guard `state/guard.ts`), `execute(id)`. |
| Synonyms | `commands/keywords.ts`, `keyword-messages.ts`, `messages/*.json` `cmd_<id>_keywords` | Catalog keywords in **every** UI language. Folk words exist already for compress (`küçült`, `make smaller`), export images (`pdf to jpg`, `pdf'ten jpg`), split (`split pdf`). |
| Scope | `commands/palette-scope.ts` | `PAGE_SCOPE_COMMANDS`, suggestions (`fill-sign`, `recognize`). |
| Tests | `commands/query.test.ts` (211 EN/TR rows), `palette-intent.test.ts`, `keywords.test.ts` (141 command queries in both UI languages), `palette-scope.test.ts`, `command-acts.test.tsx`, `e2e/palette-intents.spec.ts` (teaching sample, 8 pages) | The corpus is a TS table of `[query, show(intent)]` rows. |
| Design spec | `docs/design/redesign-2026-10/components/08-feedback.md` §2 FB1, §3 FB2 | FB2 "argument row": one row restating the parse, ↵, reason when invalid; grammar table includes `move 5 before 2` (not built), zoom, find. |

### 1.2 Undo and history

- History is **snapshot based** (`packages/document-model/src/history.ts`). `applyOperation(op,
  label)` in `state/workspace-store.ts` commits any composition of model operations as **one**
  labelled entry and refuses on a locked document (ADR-0030 §2.5).
- Composable model operations: `rotatePages`, `deletePages`, `duplicatePages`, `movePages`,
  `reversePages` (`packages/document-model/src/pages.ts`), `splitDocument` (wrapped by
  `stage/section-operations.ts` `splitSection`, which names the parts), and furniture via
  `furniture/furniture-model.ts` `applyFurniture(ws, docId, kind, overlays)` with
  `defaultPageNumbers`, `pageNumberOverlay`, `defaultWatermark`, `watermarkOverlay`.
- Engine edits (annotations, redaction marks, text edits, signatures placed as stamps) commit
  separately through `applyEngineEdit` (`annotations/edit-runner.ts` `runAction`). They cannot
  join a model-operation entry.
- Undo toast: `toast.undo(message, { documentId })` (`ui/Toast`), as `deleteTargets` in
  `app-commands.ts` does.
- Outputs (Save a copy, images, text, print) never touch history: they write a new file.

### 1.3 Entry points the bar will drive

| Job | Today's door | Notes |
|---|---|---|
| Compress | `document.compress` → `openSaveCopy(doc, 'size')` (`tools/tool-commands.ts`) | Save a copy (`export/`) has Size = same/smaller/smallest/custom with per-preset estimates (`sizeEstimates`, from one engine analysis). **No target-size input today.** `quickSize(ws, doc)` (`export/size-quick.ts`) gives a rough size instantly. |
| Images | `document.exportImages` → `openSaveCopy(doc, 'images')` | Draft `images: { type: 'png'\|'jpeg'\|'webp', range, … }`. Preset only sets the format tab, not the type or range. |
| Text / Markdown | `document.exportMarkdown` → `openSaveCopy(doc, 'text')` | `ConvertChoice.format`. |
| Save a copy / Print | `file.export`, `file.print` | |
| Presets | `export/save-copy-model.ts` `applyPreset(draft, preset)` (pure); `export/export-store.ts` `SaveCopyPreset = 'pdf'\|'size'\|'images'\|'text'\|'details'` | Extension point for PRD-40. |
| Redact | `redaction.find` (`redaction/commands.ts`, `when: readMode`) → `showRedactionsPanel()` + `findSensitiveData(doc, patterns)` (`redaction/review.ts`) | `patterns` parameter exists; `PATTERN_IDS = email, iban, card, tckn, phone, date`. The finder lists matches; marking and applying stay the person's. |
| Sign (place) | `tool.signature` (`annotations/commands.ts`): arms the session's or newest saved signature (`armSavedSignature`), else opens New signature | Placement is a click/tap on the page; nothing places a signature by coordinates. |
| Sign (certificate) | `document.sign` → `openSignDialog` | |
| OCR | `document.ocr` → `openOcrDialog(docId)` | |
| Split | `section.split` → `openOperationDialog({ kind: 'split' })`; pure `previewSplit(pageCount, { mode: 'every', n })` and `splitSection(docId, spec)` | |
| Extract | `pages.extract` → S16 sheet prefilled with pages | Keep copies vs move is the sheet's choice. |
| Combine | `documents.mergeAll` | Opens S15, or a picker with one document. |
| Password | `document.setPassword` | |
| Fill & sign | `openMarkupDoor('sign')` (`markup/doors.ts`) | |
| Find | `viewer/search.ts` `setSearchQuery`, `openFind`, `runSearch` | |
| Office → PDF | PRD-18, behind `?office=1`, desktop/tablet only (EDN-19) | |

### 1.4 Phone

The compact edition has no palette. Its Go to page sheet (`shell/compact/CompactMoreSheets.tsx`
`GoToSheet`, loaded on intent, EDN-25) already has a text field with a live preview line
(`goto_preview`). Page actions live in the overview (`shell/compact/overview/page-actions.ts`:
`rotate`, `remove`, `duplicate`, `moveTo`, `exportPages`; MOB-3, MOB-8). The phone's bundle cap is
on `compactSession` (PF-23, 1 % growth).

### 1.5 What is reused

Reused as is: `foldForSearch`, `fuzzyFilter`, `formatPages`, the registry and guard, every door in
§1.3, `previewSplit`, furniture defaults, `findSensitiveData(doc, patterns)`, `FindThumb`
(`shell/sidebar/FindThumb.tsx`, page thumbnails from the one render cache), `toast.undo`, the
palette's lazy-load seam, the corpus style of `query.test.ts`. Replaced: `query.ts` (its grammar
moves into `commands/intent/`, its 211 rows become a regression table), `palette-intent.ts`
(becomes the adapter between the palette and `commands/intent/`).

---

## 2. Design

### 2.1 Actions and families

Every step of a reading belongs to one **family**; the family decides the preview, whether it can
chain, and what undo means.

| Family | Runs on Enter | Chains | Undo |
|---|---|---|---|
| **navigate** (go to page, heading, recent file, find) | Yes | No (alone only; see §2.8 ellipsis) | Nothing to undo |
| **document** (a model operation) | Yes, committed | Yes, any number, in typed order | All document steps of one sentence are **one** history entry |
| **handoff** (opens a tool, sheet or panel prefilled) | Opens it; the person finishes there | At most one, always last | Whatever the tool commits is its own entry; the footnote shows only for a chain of two or more steps, never for a lone handoff |
| **output** (opens Save a copy or Print preset) | Opens the sheet preset; never writes a file by itself (PRD-40) | At most one, always last; cannot follow a handoff | Nothing to undo; the copy is a new file |
| **unavailable** (a capability Recto does not have) | No; shows the nearest command row | No | — |

| Action | Family | EN words (folded) | TR stems (folded; suffixes per §2.4) | Slots | Default pages | Runs through |
|---|---|---|---|---|---|---|
| `goto` | navigate | go, go to, goto, jump to, page N, show page | git, sayfa N, N. sayfa, aç (with a page word) | page | — | `goToPageIndex` |
| `heading`, `recent` | navigate | as PRD-23 | as PRD-23 | text | — | as today |
| `find` | navigate | find, search, search for, look for | bul, ara | text (rest of the clause; quotes optional) | — | `setSearchQuery(text)`, `openFind()`; `runSearch(doc)` if no run starts on its own |
| `rotate` | document | rotate, turn | dondur, cevir (with pages/degrees/direction) | pages, degrees, direction | selection, else current page | `rotatePages` op |
| `delete` | document | delete, remove, del, drop, get rid of | sil, kaldir, cikar (sense 1 of 2) | pages | selection, else **none** (needs pages) | `deletePages` op |
| `duplicate` | document | duplicate, copy, clone | cogalt, kopyala | pages | selection, else none | `duplicatePages` op |
| `move` | document | move, put | tasi, koy (with a relation word) | pages, before N / after N / to start / to end | selection, else none | `movePages` op |
| `reverse` | document | reverse, reverse order, flip order | sirayi ters cevir, ters sirala, tersten sirala | pages | all | `reversePages` op |
| `split` | document | split, divide, break up, cut into | bol, ayir, parcala | every N / at N[,M] / into N parts | — | `splitDocument` op via `splitSection`'s naming |
| `pageNumbers` | document | add page numbers, number the pages, paginate | sayfa numarasi ekle/koy/ver, numarala | pages (a run, even, odd, all) | all | `applyFurniture('page-numbers', defaults)` |
| `watermark` | document (with text) / handoff (no text) | watermark, add watermark | filigran ekle/koy | text (quoted or the word before `filigran`/after `watermark`), pages | all | `applyFurniture('watermark', …)`; without text: `openFurnitureDialog('watermark')` |
| `extract` | handoff | extract, pull out, save pages as new, as a separate file | ayikla, ayri dosya(ya) cikar/kaydet, yeni belgeye cikar/al, cikar (sense 2 of 2) | pages | selection, else none | `pages.extract` with the pages selected (S16) |
| `combine` | handoff | combine, merge, join | birlestir | — | — | `documents.mergeAll` |
| `signPlace` | handoff | sign, put my signature, add my signature | imzala, imza at, imzami koy/ekle | page (one) | current page | go to the page, then `tool.signature` (arms the newest saved signature or opens New signature) |
| `certify` | handoff | digitally sign, sign with certificate, certificate, e-sign | e-imza, dijital imza, sertifika(yla) imzala, elektronik imza | — | — | `document.sign` |
| `redactFind` | handoff | redact, black out, censor, mask, hide | karart, sansurle, gizle, maskele | patterns (iban, email, phone, tckn, card, date; "personal/sensitive/kişisel" = all but date) | — | `mode.read`, then `showRedactionsPanel()` + `findSensitiveData(doc, patterns)` |
| `ocr` | handoff | ocr, recognize text, make searchable | ocr yap, metni tani, aranabilir yap, taramayi metne cevir | pages (ignored by the dialog today; shown) | all | `document.ocr` |
| `password` | handoff | password, encrypt, protect, lock with a password | sifrele, sifre/parola koy/ekle | — | — | `document.setPassword` |
| `fill` | handoff | fill, fill in, fill the form | doldur, formu doldur | — | — | `openMarkupDoor('sign')` |
| `compress` | output | compress, shrink, make smaller, reduce, optimize | sikistir, kucult, boyutunu azalt/kucult, hafiflet | size target | — | `openSaveCopy(doc, { kind: 'size', targetBytes })` (PRD-40) |
| `exportImages` | output | save as / export as / convert to / to + jpg, jpeg, png, webp, image, picture | jpg/png… olarak kaydet, jpg'ye cevir/donustur, resim/gorsel olarak kaydet | format, pages | all | `openSaveCopy(doc, { kind: 'images', type, range })` |
| `exportText` | output | as text, txt, markdown, md | metin/markdown olarak kaydet | format | — | `openSaveCopy(doc, { kind: 'text', format })` |
| `saveCopy` | output | save a copy, save as, export, download | kopya kaydet, farkli kaydet, indir | — | — | `file.export` |
| `print` | output | print | yazdir | — | — | `file.print` |
| `officeToPdf` | handoff | word/docx/excel/pptx **to** pdf | word'u pdf yap, word'den pdf | — | — | `file.open` (only with the Office flag on, desktop/tablet) |
| `unavailable` | unavailable | pdf **to** word/docx/excel/xlsx/powerpoint/pptx; translate | pdf'i word'e cevir…, turkceye/ingilizceye cevir | — | — | row with the nearest command: Word/Excel/PowerPoint → `document.exportMarkdown`; translate → none |

Not in this move: zoom, insert blank page, header/footer, Bates, redact-by-typed-text, multi-file
plans (Batch). They fall to the command list as today.

### 2.2 Pipeline

All in `apps/web/src/commands/intent/`, pure, synchronous, no store imports (the context is
passed in). One call per deferred keystroke.

```
text ─► normalise ─► tokenise ─► analyse (TR suffixes, lexicon tags) ─► clauses
     ─► fill slots per clause ─► resolve against the context ─► readings ─► score ─► top 1–2
```

1. **normalise** (`normalise.ts`): today's `normalise()` minus the `and/ve → space` step (the
   clause splitter needs conjunctions). Keeps a map from each normalised character back to the
   original (the fold is length-preserving; the regex steps record their offsets) so readings carry
   spans of the original text.
2. **tokenise** (`tokenise.ts`): tokens with a kind: `number` (`12`), `range` (`3-5`), `ordinal`
   (`3.`, `3'üncü`, `üçüncü`), `size` (`2mb`, `1,5 mb`, `500 kb`), `degrees` (`deg90`), `quoted`
   (`"TASLAK"`, `'GİZLİ'`, `“…”`), `conj` (`and`, `ve`, `then`, `sonra`, `ardından`, `,`, `;`),
   `word`. A decimal size (`1,5 MB`) is read before commas become list separators.
3. **analyse** (`turkish.ts`, `lexicon.ts`): each `word` token becomes a list of **senses**:
   `{ lex: LexEntry, weight }`, a filler, a page word, a number word, a relation word, a pattern
   name, a format, or `unknown`. Turkish words are matched by **stem + allowed suffix chain** against
   the lexicon only (§2.4); there is no general stemmer.
4. **clauses** (`grammar.ts`, §2.8): split at conjunctions that have a verb on both sides.
5. **fill slots**: every non-filler token of a clause must be consumed by the clause's action
   (pages, target, relation, text). One unconsumed token rejects that sense (PRD-23's "every word
   understood" rule, kept).
6. **resolve** (`ranges.ts`, `targets.ts`): page expressions → 1-based positions against
   `IntentContext`; problems become `Problem`s on the step (the reading is still shown, not
   runnable).
7. **readings**: the cartesian product of the clauses' surviving senses (capped at 16, pruned by
   score), each a `Reading` with steps in **run order** (§2.9).
8. **score** (`score.ts`, §2.6) and pick (§2.7).

### 2.3 Tokens, numbers and ranges (`ranges.ts`)

Page expressions (all of PRD-23's, plus the new ones in bold):

| Form | EN | TR |
|---|---|---|
| Number, range, list | `3`, `3-5`, `3–5`, `3..5`, `3 to 5`, `3 through 5`, `3, 5, 7`, `3 and 5` | `3`, `3-5`, `3 ile 5`, `3'ten 5'e`, `3'ten 5'e kadar`, `3 ve 5` |
| Ordinal | `3rd page`, **`third page`** | `3. sayfa`, **`3'üncü sayfa`, `üçüncü sayfa`** |
| Edges | `first page`, `last page`, `first 3`, **`first two pages`, `last three`** | `ilk sayfa`, `son sayfa`, `ilk 3`, **`ilk iki sayfa`, `son üç sayfa`** |
| Number words | **one…twenty** | **bir…yirmi** |
| Parity, all | `even`, `odd`, `all`, `every page`, `whole document` | `çift`, `tek`, `tüm`, `bütün`, `hepsi`, `tüm sayfalar` |
| Current | `this page`, `current page` (page word required, PRD-23) | `bu sayfa`, `mevcut sayfa` |
| **Selection** | **`selected pages`, `the selection`, `these pages`** | **`seçili sayfalar`, `seçtiklerim`, `bu sayfalar`** |
| **Open end** | **`5 to end`, `from 5 on`, `5 onwards`** | **`5'ten sona`, `5. sayfadan itibaren`, `5'ten sonrası`** |
| **Except** | **`all except 3`, `all but 1-2`** | **`3 hariç`, `1-2 dışındaki`, `3 hariç tümü`** |
| **Pronoun** | **`it`, `them`** (previous clause's pages) | **`onu`, `onları`** |

`delete 2 pages` stays `ambiguous-count`; `3a` is not a page; ranges are validated as today
(`out-of-range`, `reversed-range`). Ordinal words cover first…tenth / birinci…onuncu.

Targets (`targets.ts`):

- **Size**: `<number>[.,<decimal>] (b|kb|k|mb|m|gb|megabayt|megabyte|kilobayt)` with an optional
  comparator: EN `under`, `below`, `less than`, `smaller than`, `at most`, `max`, `<`, `to`; TR
  `altına`, `altında`, `altı`, `-dan/-den/-tan/-ten küçük`, `-dan az`, `en fazla`, `maksimum`,
  `geçmesin`, and a bare dative (`2 MB'a`). All mean "at most". Bytes = value × 1024^k (MB = 1024²,
  as Save a copy's sizes print, `formatFileSize`). A size over the document's current quick size is
  still accepted (the sheet says it is already under; §3.4).
- **Degrees and direction**: as PRD-23 (`90 derece`, `sağa`, `saat yönünde`, `tersine`…).
- **Formats**: `jpg|jpeg → jpeg`, `png`, `webp`, `resim|görsel|image|picture|fotoğraf → jpeg`,
  `txt|text|metin → text`, `md|markdown → markdown`; `word|docx|doc`, `excel|xlsx|xls`,
  `powerpoint|pptx|ppt|sunum` are **office formats**: direction decides (§2.4 last rule).
- **Patterns**: `iban`; `email|e-mail|mail|e-posta|eposta`; `phone|telefon|tel|gsm`;
  `tckn|tc kimlik|kimlik no|tc no|tc numarası`; `card|kart|kredi kartı|credit card`; `date|tarih`;
  `personal|sensitive|pii|kişisel|hassas` = every pattern except `date` (the finder's own default,
  `UNTICKED_BY_DEFAULT`).
- **Text**: a `quoted` token; for `watermark`, also one unquoted word right before
  `filigran*` or right after `watermark` (`TASLAK filigranı`, `watermark DRAFT`), kept in the
  original case.

### 2.4 Turkish morphology (`turkish.ts`)

Folding (`foldForSearch`) already removes ı/i, ü/u, ö/o, ş/s, ç/c, ğ/g differences, so vowel
harmony collapses to `a/e` and `i/u`. The analyser never stems freely: a token matches a lexicon
**stem** only if the rest of the token is an allowed **suffix chain** for that stem's class.

- **Apostrophes** split a token: `IBAN'ları` → `iban` + suffix `lari`; `PDF'i`, `JPG'ye`, `5'i`,
  `2MB'a`. The suffix after the apostrophe is checked like any other.
- **Noun chains** (page words, `numara`, `imza`, `filigran`, `belge`, `dosya`, `iban`, `tarih`,
  formats): optional plural `lar|ler`, optional possessive `i|u|si|su|m|im|um|miz|imiz|umuz|niz`,
  optional case `i|u|yi|yu|ni|nu|a|e|ya|ye|na|ne|da|de|ta|te|nda|nde|dan|den|tan|ten|ndan|nden|in|un|nin|nun|la|le|yla|yle`.
  Built once as a `Set` of folded chains (a few hundred strings).
- **Locative adjective `-daki/-deki/-taki/-teki/-ki`** on a page word means "the thing on page N",
  not the page: `3. sayfadaki resmi sil` is **not** a page delete. The clause is rejected (falls to
  the command list). This is a safety rule, with corpus rows.
- **Verb chains** (stems listed per entry with their alternants, e.g. `kaydet|kayded`,
  `et|ed`): bare imperative; `in|un|iniz|unuz|yin|yun|yiniz|yunuz` (plural/polite); `elim|alim`
  (let's); `mek|mak` and `meyi|mayi|mesi|masi` (infinitive, nominal: `döndürmek istiyorum`);
  aorist + question `ir|ur|ar|er` followed by the particle token `mi|mu|misin|musun|misiniz`
  (`döndürür müsün`); `abilir|ebilir` + particle (`silebilir misin`). The particle tokens and
  `istiyorum`, `lütfen`, `rica` are fillers **only after a verb**.
- **Negation never acts**: a verb with `ma|me|may|mey|maz|mez` right after the stem (`silme`,
  `silmeyin`, `döndürme`, `silmeden`), and EN `don't`, `do not`, `never`, `not` before a verb,
  reject the clause. `silme` as a noun ("deletion") still reaches the command list by fuzzy match.
- **Ordinals**: `3.`, `3'üncü/3'ncü/3üncü` and the ordinal words are page positions; a dot after a
  number is ordinal unless a digit follows (decimal sizes are tokenised first).
- **Number suffixes** after an apostrophe or directly (`5'i`, `5i`, `7'ye`, `3ten`) are dropped
  except the ablative/dative pair in ranges (`3'ten 5'e`) and the dative/ablative in `move`
  (`5'i 2'nin önüne`).
- **Direction of conversion**: accusative marks the source, dative marks the target
  (`Word'ü PDF'e çevir` = Word → PDF; `PDF'i Word'e çevir` = PDF → Word). EN: `X to Y`, `as Y`,
  `into Y`, `convert Y` (Y target), `from X`. Office source + PDF target → `officeToPdf`; PDF (or
  no source) + office target → `unavailable`.
- **`çevir`** has three senses chosen by slot fit: with pages/degrees/direction → `rotate`; with a
  format target → `exportImages`/`exportText`/`unavailable`; with a language (`türkçeye`,
  `ingilizceye`, `to English`) → `unavailable: translate`; with `ters` and no degrees → two readings
  (`reverse` and `rotate` 180°).
- **Object words** `pdf`, `dosya*`, `belge*`, `document`, `file`, `it` (EN, when no pages before)
  are accepted only by actions whose entry says `object: true` (compress, split, outputs, ocr, sign,
  redact, combine, password, page numbers, watermark). `dosyayı sil` and `delete the file` are
  **not** a page delete; they fall to the command list.

### 2.5 The lexicon as data (`lexicon.ts`)

One array, both languages, always active whatever the UI language (as catalog keywords are). It is
grammar data, not display copy, so it is **not** in the message catalogs; display strings are.

```ts
export interface LexEntry {
  readonly action: Action;
  readonly lang: 'en' | 'tr';
  /** Folded words or multi-word phrases ("make smaller", "sayfa numarasi"); phrases match first. */
  readonly words: readonly string[];
  /** TR verb or noun stems that take suffix chains (§2.4), with consonant alternants. */
  readonly stems?: readonly { readonly stem: string; readonly class: 'verb' | 'noun' }[];
  /** 1 for the primary sense; 0.8 for a second sense of a shared word (çıkar → extract). */
  readonly weight: number;
  /** Slots the action takes; any other token rejects this sense. */
  readonly slots: readonly Slot[];
  /** Accepts object words (`pdf'i`, `dosyayı`, `the file`). */
  readonly object?: boolean;
  /** What the action does with no pages named. */
  readonly pagesDefault?: 'selection-or-current' | 'selection-or-none' | 'all' | 'none';
  /** Show the second reading even when its score is far below (a known two-way word). */
  readonly alwaysAsk?: boolean;
}
export type Slot = 'pages' | 'page' | 'degrees' | 'direction' | 'relation' | 'size' | 'format'
  | 'patterns' | 'text' | 'every' | 'parts' | 'language';
```

Fillers (a closed list; **no nouns**): PRD-23's (`page`, `pages`, `the`, `please`, `lütfen`,
`from`, `in`, `on`, `of`, `arası`, `numaralı`…) plus `a`, `an`, `to` (outside ranges), `for me`,
`benim`, `bana`, `şunu`, `şu`, `then`, `olarak` (only with a format), `istiyorum`, `can you`,
`could you`, `mi/mı/mu/mü` particles (only after a verb). A filler list that grows nouns would let
`3. sayfadaki tabloyu sil` through; `lexicon.test.ts` asserts the list has no word that is also a
noun stem.

Typo tolerance: a word of **5 or more** letters (folded) that is one Damerau-Levenshtein step from
a lexicon word matches it at weight × 0.75, never for numbers, formats or pattern names. The preview
row says the corrected word (`döndr` → "Rotate…"); the reading is still shown before it runs.

### 2.6 Scoring

`score(reading) = Π over clauses ( senseWeight × slotFit )`, where

- `senseWeight` = the entry's weight (1, 0.8 for a secondary sense), × 0.95 for a folk phrase
  marked `folk`, × 0.75 for a typo match;
- `slotFit` = 1 when every slot came from the text, 0.9 when a default filled one (rotate with no
  pages → selection or current page; compress with no size), 0 when a token is left over (the
  sense is dropped, not scored).

A reading exists only when every token is consumed (coverage 1). Scores are only for ordering and
for deciding whether a second reading is shown.

### 2.7 Ambiguity

- At most **two** readings are shown. The second is shown when its score is at least 0.8 × the
  first, or when any clause used an entry with `alwaysAsk`. Ties order by score, then by the
  lexicon's primary sense first.
- Known two-way words (`alwaysAsk`), each with corpus rows:

| Text | Reading 1 | Reading 2 |
|---|---|---|
| `çift sayfaları çıkar` | Delete pages 2, 4, 6… (PRD-23's reading of `çıkar`) | Extract pages 2, 4, 6… to a new document |
| `imzala` (no page, no certificate word) | Place your signature on page {current} | Sign with certificate… |
| `böl 10`, `split 10` | Split every 10 pages | Split at page 10 |
| `sayfaları ters çevir` | Reverse the page order | Rotate pages 180° |

- A reading that cannot run (a `Problem`) is still shown, with its reason, and is never the only
  reason another reading is hidden.
- `ambiguous-count` stays an invalid reading (PRD-23), not two readings.

### 2.8 Clauses, chaining and ellipsis (`grammar.ts`)

- **Split rule**: walk the conjunctions left to right; a conjunction is a clause boundary only if
  the clause so far **and** the segment after it (up to the next conjunction) each contain a verb
  (an action word or a bare format/size target). Otherwise it is a list connector. So
  `3 ve 5. sayfaları döndür` is one clause (list), `3. sayfayı döndür ve 5'i sil` is two,
  `rotate 3 and 5 and delete 7` is `rotate 3,5` + `delete 7`.
- **Verb ellipsis**: `3'ü döndür ve 5'i` → the trailing segment without a verb joins the clause
  (rotate 3, 5).
- **Page ellipsis**: a page-taking clause with no pages takes the previous clause's explicit pages
  (`3. sayfayı döndür ve çoğalt`), also through pronouns (`rotate 3 and duplicate it`). The
  preview shows the inherited pages.
- **Go to + verb**: `son sayfaya git ve imzala` → the go-to page fills the next clause's page slot
  and the `goto` step is dropped (the action goes there anyway). A navigate step is otherwise
  allowed only alone.
- **Bare targets as verbs**: a clause that is only a format (`jpg`, `as png`) is `exportImages`;
  only a size (`2 MB altına`) is `compress`; `word` alone is `unavailable: pdf-to-word` plus, with
  the Office flag on, a second reading `officeToPdf`; a bare number is `goto` (PRD-23).

### 2.9 Run order and chain rules (`plan.ts`, checked by the parser so problems show in preview)

1. All page numbers in the sentence are read against the document **as it is when the preview is
   drawn**, and resolved to page ids before anything runs. `son sayfayı sil ve 1. sayfayı döndür`
   deletes what is now page 24 and turns what is now page 1, whatever the order.
2. Document steps run in typed order as one composed operation, one history entry.
3. At most one finishing step (handoff or output), and it runs **after** the document steps,
   whatever the typed order (`sıkıştır ve döndür` = rotate, then compress). The sentence in the
   preview is written in run order, so the person reads the real order.
4. Problems (the reading is shown, not runnable):
   - two finishing steps (`two-finishing`): "One save or tool per sentence";
   - a document step after `split` (`after-split`): split replaces the document;
   - `pageNumbers` or `watermark` with **explicit** pages after `delete`/`duplicate`/`move`/
     `reverse` (`shifted`): positions would shift; "all pages", even and odd are fine;
   - furniture over a non-contiguous list (`not-a-run`): furniture ranges are all / skip-first /
     odd / even / one run (`RangeChoice`);
   - `delete` covering every page, including through a chain (`all-pages`);
   - `delete`/`duplicate`/`extract`/`move` with no pages and no selection (`needs-pages`);
   - split leaving one part (`single-part`, from `previewSplit`);
   - an action not on the phone (`phone`) in the compact edition.
5. A sentence with any problem never runs **any** of its steps: half a sentence is a misread.

### 2.10 Types (contract; lane N1 writes `types.ts` first, N2 and N3 build against it)

```ts
// apps/web/src/commands/intent/types.ts
import type { PatternId } from '../../redaction/patterns'; // type-only; patterns.ts is pure

export type Action =
  | 'goto' | 'heading' | 'recent' | 'find'
  | 'rotate' | 'delete' | 'duplicate' | 'move' | 'reverse' | 'split' | 'pageNumbers' | 'watermark'
  | 'extract' | 'combine' | 'signPlace' | 'certify' | 'redactFind' | 'ocr' | 'password' | 'fill'
  | 'officeToPdf'
  | 'compress' | 'exportImages' | 'exportText' | 'saveCopy' | 'print'
  | 'unavailable';
export type Family = 'navigate' | 'document' | 'handoff' | 'output' | 'unavailable';
export declare const FAMILY: Readonly<Record<Action, Family>>;

export interface Pages {
  /** 1-based positions now, ascending, unique. */
  readonly pages: readonly number[];
  /** How they were named, so a row can say "even pages" instead of a long list. */
  readonly named: 'list' | 'all' | 'even' | 'odd' | 'selection' | 'current' | 'edge' | 'except';
  /** Inherited from the previous clause (ellipsis); the row says so. */
  readonly inherited?: true;
}

export type Unavailable = 'pdf-to-word' | 'pdf-to-excel' | 'pdf-to-powerpoint' | 'translate';

export type Step =
  | { readonly action: 'goto'; readonly page: number }
  | { readonly action: 'heading'; readonly text: string; readonly matches: readonly QueryHeading[] }
  | { readonly action: 'recent'; readonly text: string; readonly matches: readonly QueryRecent[] }
  | { readonly action: 'find'; readonly text: string }
  | { readonly action: 'rotate'; readonly pages: Pages; readonly turns: -1 | 1 | 2 }
  | { readonly action: 'delete' | 'duplicate' | 'extract' | 'reverse' | 'ocr' | 'pageNumbers'; readonly pages: Pages }
  | { readonly action: 'move'; readonly pages: Pages;
      readonly to: { readonly before: number } | { readonly after: number } | 'start' | 'end' }
  | { readonly action: 'split';
      readonly how: { readonly every: number } | { readonly at: readonly number[] }
        | { readonly parts: number } | 'choose' }
  | { readonly action: 'watermark'; readonly text: string | null; readonly pages: Pages }
  | { readonly action: 'compress'; readonly targetBytes: number | null }
  | { readonly action: 'exportImages'; readonly format: 'jpeg' | 'png' | 'webp'; readonly pages: Pages }
  | { readonly action: 'exportText'; readonly format: 'markdown' | 'text' }
  | { readonly action: 'signPlace'; readonly page: number }
  | { readonly action: 'redactFind'; readonly patterns: readonly PatternId[] }
  | { readonly action: 'saveCopy' | 'print' | 'combine' | 'certify' | 'password' | 'fill' | 'officeToPdf' }
  | { readonly action: 'unavailable'; readonly capability: Unavailable;
      /** The command the row offers instead, or null. */ readonly nearest: string | null };

export type Problem =
  | 'no-document' | 'out-of-range' | 'reversed-range' | 'no-pages' | 'all-pages' | 'ambiguous-count'
  | 'needs-pages' | 'not-a-run' | 'shifted' | 'two-finishing' | 'after-split' | 'single-part' | 'phone';

export interface Reading {
  /** In run order (§2.9). */
  readonly steps: readonly Step[];
  readonly score: number;
  /** The first problem and the step it is on; null when the parser sees none. */
  readonly problem: { readonly kind: Problem; readonly step: number; readonly page?: number } | null;
  /** Original-text spans each step was read from (for a later input highlight). */
  readonly spans: readonly (readonly [number, number])[];
  /** A typo was corrected: the word as typed and as read. */
  readonly corrected?: readonly { readonly typed: string; readonly read: string }[];
}

export type ParseResult =
  | { readonly kind: 'readings'; readonly readings: readonly [Reading] | readonly [Reading, Reading] }
  /** An action word was found but another word was not understood: a quiet row, then commands. */
  | { readonly kind: 'partial'; readonly action: Action; readonly unknown: readonly string[] }
  /** Nothing to read: the command list as today. */
  | { readonly kind: 'none' };

export interface QueryHeading { readonly title: string; readonly page: number }
export interface QueryRecent { readonly id: string; readonly name: string }

export interface IntentContext {
  readonly pageCount: number;           // 0 when no document is open
  readonly currentPage?: number;        // 1-based
  readonly selectedPages: readonly number[]; // 1-based positions selected in the Pages bar (S10)
  readonly headings: readonly QueryHeading[];
  readonly recents: readonly QueryRecent[];
  readonly savedSignatures: number;
  readonly officeEnabled: boolean;      // PRD-18 flag on and not compact (EDN-19)
  readonly edition: 'full' | 'compact';
}

export declare function parseIntent(text: string, ctx: IntentContext): ParseResult;
```

### 2.11 Preview model (contract; lane N2's `preview.ts`, lane N3 draws it)

```ts
// apps/web/src/commands/intent/preview.ts
export interface IntentPreview {
  /** Identifies what is on screen: the folded text, the steps, the workspace version. */
  readonly key: string;
  /** The option's accessible name: the whole reading in run order, "…, then …". */
  readonly sentence: string;
  readonly steps: readonly PreviewStep[];
  /** Footnote: 'one' = one undo step; 'separate' = a handoff commits its own; 'none' = output/navigate only. */
  readonly undo: 'one' | 'separate' | 'none';
  readonly runnable: boolean;
  /** Why not, when not runnable (problem or guard refusal). */
  readonly reason?: string;
  /** For `unavailable`: the command row offered instead. */
  readonly nearest?: { readonly commandId: string; readonly title: string };
}
export interface PreviewStep {
  readonly family: Family;
  readonly label: string;                 // "Rotate pages 3–5 right"
  readonly detail?: string;               // "3 pages" · "Now about 4.8 MB" · "Opens Save a copy" · "You choose the spot"
  /** Pages to draw (1-based, now); the view draws at most 8 and "+N". */
  readonly pages?: readonly number[];
  readonly mark?: 'rotate-right' | 'rotate-left' | 'rotate-half' | 'delete' | 'duplicate' | 'move'
    | 'extract' | 'number' | 'watermark' | 'sign' | 'reverse';
  /** Split: each part's pages, "1–10", "11–20", "21–24". */
  readonly parts?: readonly string[];
}
export declare function previewOf(result: Reading, ctx: IntentContext, version: number): IntentPreview;
```

`previewOf` is pure given `ctx` and `version`; the guard part (`reason` from `changeRefusal` /
`commandRegistry.isEnabled`) is added by `previewWithGuard(reading, ctx, version)` in the same
module, which reads the stores. Tests use `previewOf`.

### 2.12 Intent → command mapping and the runner (`run.ts`)

`runReading(reading, shownKey): Promise<'ran' | 'stale' | 'refused'>`:

1. Recompute the context and version; if `previewOf(reading, ctx, version).key !== shownKey`,
   return `'stale'` and do nothing (§2.13).
2. Guard every step: document steps ask `changeRefusal(docId, act)` (`pages` for structure,
   `document` for furniture); handoff/output steps ask `commandRegistry.isEnabled` of their command
   (`document.compress`, `document.exportImages`, `document.exportMarkdown`, `file.export`,
   `file.print`, `pages.extract`, `documents.mergeAll`, `tool.signature`, `document.sign`,
   `document.ocr`, `document.setPassword`, `section.split`). Any refusal → `'refused'`, nothing runs.
   Exception: `redactFind` is not refused for "not in read mode"; it runs `mode.read` first.
3. Document steps: positions → page ids of the active document; one
   `applyOperation((ws, ids) => …compose…, label)` where label is the history line
   `history_intent` (the sentence's document steps, joined). Rotation of 180° is one `rotatePages`
   by 180 (as `rotateDocumentPages(180)`). Split uses `splitSection`'s part naming
   (`defaultPartTitles`) inside the composed op. Then one `toast.undo(m.toast_intent_done(…), {
   documentId })`. If `applyOperation` returns false, stop: the finishing step does not run.
   The selection is left as it was before (as `runPagesIntent` restores it today); the view scrolls
   to the first affected page that still exists when it is out of view.
4. The finishing step, if any, runs in the same task as Enter (pickers keep user activation, FB1):
   - `extract`: select the pages, `commandRegistry.execute('pages.extract')`, restore the
     navigator document as `runPagesIntent` does;
   - `signPlace`: `goToPageIndex(page - 1)`, then `commandRegistry.execute('tool.signature')`;
   - `redactFind`: `execute('mode.read')`, `showRedactionsPanel()`, `findSensitiveData(doc, patterns)`;
   - `split` with `how: 'choose'`: `execute('section.split')` (the sheet);
   - `watermark` with `text: null`: `openFurnitureDialog('watermark', doc.id)`;
   - outputs: `openSaveCopy(doc.id, request)` (PRD-40) or `execute('file.print')`;
   - others: `commandRegistry.execute(<command id>)`.
5. Navigate steps: as `runIntent` today; `find`: `setSearchQuery(text)`, `openFind()`.

### 2.13 "Never run a reading the user did not see"

- The palette keeps `paintedKeys`: after each commit that shows intent rows, a
  `requestAnimationFrame` inside a layout effect adds the shown previews' keys.
- Enter runs the active reading only when (a) `query === deferredQuery` (the rows on screen were
  made from exactly the typed text), (b) the active row's key is in `paintedKeys`, and (c)
  `runReading` finds the same key (the document has not changed underneath, e.g. by a toast's
  Undo). Otherwise Enter does nothing; a second Enter a frame later works. No spinner, no message:
  the rows are already on their way.
- Before the intent chunk has loaded, Enter runs the command list's active row, as today; no
  reading can be active then.
- The key includes a workspace version counter (`context.ts` increments it in a
  `useWorkspaceStore.subscribe` listener) and the active document id.

### 2.14 Failure and "not understood"

| Result | What the list shows | Enter |
|---|---|---|
| `readings` runnable | Reading row(s) with preview first, then today's sections | Runs the active reading |
| `readings` with a problem or guard refusal | The row with its sentence (legible) and the reason in the reason slot; preview pages still drawn | Nothing; the reason is announced |
| `partial` | One quiet, non-runnable row: "Didn't understand “yamuk” · rotate takes pages, a direction or degrees", then the command list (ranked on the whole text) | Runs the command list's first enabled row only if the person moved to it; on the partial row, nothing |
| `unavailable` | Row "Recto doesn't turn PDFs into Word files" (non-runnable) and right under it the nearest command as a normal row ("Export as Markdown / text…") | On the nearest row: runs it |
| `none` | Today's command ranking | As today |
| The text is a command's exact title (folded, a trailing "…" ignored) | `none`: never read as a sentence, so the command is the active row (PRD-39 amendment, 2026-11-01) | Runs the command |
| Nothing at all | FB11 empty: "No commands match “…”" plus one example sentence in the UI language | — |

### 2.15 Accessibility

- Each reading is an `option` in the existing listbox; its accessible name is `sentence`; the
  detail, the undo footnote and any reason are its `aria-describedby`. Thumbnails are
  `aria-hidden` (the sentence names the pages).
- Two readings: a `group` labelled "Two ways to read this / Bu iki türlü okunabilir"; both
  options are reachable with Up/Down and, when laid out side by side, Left/Right.
- Announcements (FB10, key `palette-args`, 500 ms after the last key): one reading → its sentence;
  two → "Two readings: …; or …"; a problem → the reason. After a run, the toast and the commands
  announce as today; the bar never says "Ran …" (FB1).
- Marks on thumbnails never rely on colour alone (A-19): delete = struck and dimmed plus the word
  in the sentence; forced colours keep outlines. Reduced motion: thumbnails appear without an
  entrance (A-10: no animation per key).
- Touch (tablet, coarse): rows 44 px, thumbnails 48 × 64, the two readings stacked.

### 2.16 Phone

The compact edition gets the bar **in a later lane (N4) after the owner answers Q1**. The default
proposal: the Go to page sheet's field (`GoToSheet`, loaded on intent) accepts sentences, with the
phone's subset: `goto`, `heading`, `find`, `rotate`, `delete`, `duplicate`, `move`, `signPlace`,
`compress`, `exportImages`, `exportText`, `saveCopy`. Anything else reads with problem `phone`
("On a larger screen / Daha geniş bir ekranda"). Office conversion is never offered on the phone
(EDN-19). The parser loads with that sheet's chunk only when the field gets its first non-digit
character, so `compactSession` (PF-23) does not change. Until N4 ships, nothing changes on phones.

### 2.17 i18n

All display text is in `apps/web/messages/en.json` and `tr.json` (proper Turkish), then
`pnpm --filter @pdf-editor/web i18n`; imported with `import { m } from '../i18n'`. Number
placeholders never take a suffix in Turkish copy: write `{pages}. sayfaları`, `{page}. sayfaya`
(today's pattern: "120. sayfaya git"). Plural forms follow the existing `palette_intent_*` arrays.

Lane N2 keys (preview, runner; appended after `palette_intent_ambiguous`):

| Key | EN | TR |
|---|---|---|
| `intent_move_before` | Move page {pages} before page {target} / Move pages {pages} before page {target} | {pages}. sayfayı {target}. sayfanın önüne taşı / {pages}. sayfaları {target}. sayfanın önüne taşı |
| `intent_move_after` | … after page {target} | … {target}. sayfanın arkasına taşı |
| `intent_move_start` / `_end` | Move pages {pages} to the start / end | {pages}. sayfaları başa / sona taşı |
| `intent_reverse` | Reverse the order of pages {pages} | {pages}. sayfaların sırasını ters çevir |
| `intent_reverse_all` | Reverse the page order | Sayfa sırasını ters çevir |
| `intent_split_every` | Split every {n} pages | Her {n} sayfada böl |
| `intent_split_at` | Split at page {pages} | {pages}. sayfadan böl |
| `intent_split_parts` | Split into {n} parts | {n} parçaya böl |
| `intent_split_choose` | Split… | Böl… |
| `intent_page_numbers` / `_all` | Add page numbers to pages {pages} / Add page numbers | {pages}. sayfalara sayfa numarası ekle / Sayfa numarası ekle |
| `intent_watermark` | Add the watermark “{text}” | “{text}” filigranını ekle |
| `intent_compress` / `_target` | Save a smaller copy / Save a copy under {size} | Daha küçük bir kopya kaydet / {size} altında bir kopya kaydet |
| `intent_export_images` / `_all` | Save pages {pages} as {format} / Save every page as {format} | {pages}. sayfaları {format} olarak kaydet / Tüm sayfaları {format} olarak kaydet |
| `intent_export_text` | Save as {format} | {format} olarak kaydet |
| `intent_sign_place` | Place your signature on page {page} | İmzanızı {page}. sayfaya koyun |
| `intent_sign_draw` | Draw your signature, then place it on page {page} | İmzanızı çizin, sonra {page}. sayfaya koyun |
| `intent_redact_find` | Find {kinds} to redact | Karartmak için {kinds} bul |
| `intent_find` | Find “{text}” | “{text}” ifadesini bul |
| `intent_then` | {first}, then {next} | {first}, ardından {next} |
| `intent_detail_now` | Now about {size} | Şu an yaklaşık {size} |
| `intent_detail_opens` | Opens {name} | {name} açılır |
| `intent_detail_spot` | You choose the spot | Yerini siz seçersiniz |
| `intent_detail_parts` | {count} documents | {count} belge |
| `intent_undo_one` | One undo takes it all back | Tek geri alma hepsini geri alır |
| `intent_undo_separate` | Each step undoes on its own | Her adım ayrı geri alınır |
| `intent_undo_copy` | The copy is a new file; this document stays as it is | Kopya yeni bir dosya; bu belge olduğu gibi kalır |
| `intent_reason_needs_pages` | Say which pages, like 3–5 | Hangi sayfalar? Örneğin 3–5 |
| `intent_reason_not_a_run` | Page numbers go on a run of pages, like 3–10 | Sayfa numaraları ardışık sayfalara eklenir, örneğin 3–10 |
| `intent_reason_shifted` | Add these after the pages are in place, in a second sentence | Bunu sayfalar yerleşince ayrı bir cümleyle ekleyin |
| `intent_reason_two_finishing` | One save or tool per sentence | Bir cümlede tek bir kaydetme ya da araç |
| `intent_reason_after_split` | Splitting ends the document; put it last | Bölme belgeyi sonlandırır; en sona koyun |
| `intent_reason_single_part` | That leaves one part | Bu tek parça bırakır |
| `intent_reason_phone` | On a larger screen | Daha geniş bir ekranda |
| `intent_unavailable_word` / `_excel` / `_powerpoint` | Recto doesn't turn PDFs into Word / Excel / PowerPoint files | Recto PDF'yi Word / Excel / PowerPoint dosyasına çevirmez |
| `intent_unavailable_translate` | Recto doesn't translate documents | Recto belgeleri çevirmez |
| `history_intent` | {steps} | {steps} |
| `toast_intent_done` | {count} changes made / 1 change made | {count} değişiklik yapıldı |

Reused: `palette_intent_rotate_*`, `palette_intent_delete|duplicate|extract`,
`palette_intent_go_page`, `palette_intent_count`, the existing reasons, `redaction_pattern_*`
(lower-cased with `toLocaleLowerCase(getLocale())` for `{kinds}`), `cmd_sign`, `ocr_cmd`,
`cmd_combine_open`, `cmd_export`, `cmd_print`, `cmd_convert_markdown`.

Lane N3 keys (bar chrome; appended after `palette_title`): `intent_bar_placeholder` ("Search, or
say what to do: rotate pages 3–5" / "Arayın ya da ne yapılacağını yazın: 3–5. sayfaları
döndür"), `intent_bar_two_readings`, `intent_bar_not_understood` ("Didn't understand “{word}”" /
"“{word}” anlaşılmadı"), `intent_bar_try` ("Try: {example}" / "Örnek: {example}"),
`intent_bar_announce_one`, `intent_bar_announce_two` ("Two readings: {first}; or {second}" / "İki
okuma: {first}; ya da {second}"), `intent_bar_more_pages` ("+{count}").

Lane N1 keys: catalog keywords only (findability, §2.18).

### 2.18 Findability (folk words)

Two routes, both tested:

1. The parser reads folk sentences (`pdf'i böl`, `küçült`, `jpg yap`, `word'e çevir`).
2. Catalog keywords (`cmd_<id>_keywords`, every UI language) gain folk words, so a word typed
   alone still ranks the right command when it is not a sentence: `document.exportImages`: `jpg
   yap, jpg'ye çevir, resme çevir, fotoğraf olarak kaydet, convert to jpg, as jpg`;
   `section.split`: `pdf'i böl, sayfalara ayır, parçala, split every`; `document.compress`: `mb
   altına, boyut düşür, compress to`; `document.exportMarkdown`: `word, docx, pdf to word, word'e
   çevir, metne çevir` (the nearest honest route, its title says text); `documents.mergeAll`: `pdf
   birleştir, dosyaları birleştir`; `redaction.find`: `karart, iban gizle, kişisel bilgi`;
   `document.ocr`: `taranmış, metne çevir`; `document.setPassword`: `şifrele, şifre koy`.
   `keywords.test.ts` gains a row per new word.

The first tester's "is there PDF to JPG?": `pdf to jpg`, `jpg`, `jpg olarak kaydet`, `jpg'ye
çevir` each reach Save as images with JPEG; a corpus row and an e2e step pin it.

### 2.19 Bundle cost

- No new dependency. The parser, lexicon, preview and runner live in the **intent chunk**, loaded
  by the palette's existing `loadIntents()` on the first open; nothing new enters the editor's
  first load or the compact closure.
- Budget: parser + lexicon (everything in `commands/intent/` except `preview.ts`, `run.ts`,
  `context.ts`) **≤ 12 KB gzip**; the whole intent chunk (with preview, runner and its messages)
  **≤ 20 KB gzip**, gated as a new absolute measure `intentBar` in `tools/qa/bundle-budget.json`
  (closure of the chunk that holds `commands/intent/parse`, minus chunks already in the `editor`
  closure). `editor` growth ≤ 0.5 KB (the new `SaveCopyRequest` type is erased; only the Save a
  copy target line is real code). `compact` and `compactSession`: 0 B.
- Speed: `parseIntent` ≤ 1 ms for a 60-character sentence on the CI machine (a unit test times
  1,000 corpus parses and asserts the mean). Thumbnails ask the render cache at the lowest
  priority, for the active reading(s) only, after 120 ms without a keystroke.

---

## 3. UI behaviour in words

(The lead and the design director set the visuals; existing tokens, M4 glass, Base UI, the
palette's own row and fill. Nothing here sets a colour or size beyond what FB1 already does.)

1. ⌘K opens the same palette. The placeholder invites a sentence (`intent_bar_placeholder`).
   Empty state unchanged (PRD-29), plus the capabilities examples of FB1 §5 written as sentences.
2. Typing a sentence: the first section is the reading. One reading = one row that grows to two
   lines: the sentence (with the step's glyph) and under it a strip of the affected pages as small
   thumbnails, each marked with what will happen (turned, struck, doubled, numbered, stamped,
   moved), at most 8 then "+N". Split shows its parts as small labels ("1–10 · 11–20 · 21–24").
   Outputs show facts instead of pages ("Now about 4.8 MB · under 2 MB", "24 pages → JPEG"). The
   footnote line says the undo story (`intent_undo_*`). ↵ at the row end.
3. Two readings appear together, both complete (sentence + pages), never one collapsed under the
   other; the group says "Two ways to read this". Side by side when the popup is wide enough,
   stacked otherwise (the design director's call; behaviour is the same). The first is active.
4. Commands still list below the reading (the person can always ignore the reading).
5. Enter runs the active reading (§2.13 rules). The palette closes first, then the steps run in the
   same task. Document steps: the pages change in place, one Undo toast ("2 changes made · Undo"),
   ⌘Z takes all of them back. A handoff opens its tool/sheet/panel already set (signature armed on
   page 2; Redactions panel finding IBANs). An output opens Save a copy already set (JPEG chosen,
   or Size with the target line).
6. A reading that cannot run stays legible, its reason sits where keycaps sit, Enter does nothing
   and the reason is announced.
7. A word not understood: a quiet row names it and gives one example; the commands below rank on
   the text as before.
8. A capability Recto lacks: an honest row, and the nearest real command right under it.
9. Locked document: document steps show the guard's reason ("Locked · Unlock first"); handoffs
   and outputs that open sheets still open (their sheets carry the lock banner, 07 §1.4).
10. Tablet: the Dock's "More commands" opens the same bar; coarse rows; the on-screen keyboard
    does not hide the reading (the popup's existing placement over the free rect).

---

## 4. Test plan

### 4.1 Corpus (the owner reads it; it is the test)

- Location: `apps/web/src/commands/intent/corpus/`: `corpus.tr.ts` (≥ 110 rows),
  `corpus.en.ts` (≥ 90 rows), `regression.ts` (the 211 rows of today's `query.test.ts`, ported
  unchanged except where PRD-39 changes a reading: `çıkar` rows now expect two readings),
  `fixtures.ts`, and `corpus.test.ts` (runs all three).
- Row format: `readonly [sentence: string, expected: string, ctx?: keyof typeof FIXTURES]`, one
  per line, grouped by family under comments, readable without code. `expected` is the output of
  `show(result)`:

```
rotate 3-5 +1                       one reading, one step
rotate 3-5 +1 ; compress <2MB       a chain, run order
? delete 2,4,6… | extract 2,4,6…    two readings (lists longer than 6 end in "…")
split every 10 [1-10 11-20 21-24]   split with parts
sign 2 · redact iban · export jpeg all · text markdown · find "fatura"
! all-pages delete 1-24             a reading with a problem (shown, not runnable)
partial rotate "yamuk"              action found, word not understood
unavailable pdf-to-word ~document.exportMarkdown
none                                command list
```

- Fixtures: `DOC24` (24 pages, current 7, no selection, headings as `query.test.ts`, recents,
  1 saved signature, office off, full), `DOC24_SEL` (pages 3, 4, 9 selected), `DOC1` (1 page),
  `NODOC`, `PHONE` (DOC24 with `edition: 'compact'`), `OFFICE` (office on).
- Required coverage (asserted by counting rows per tag in `corpus.test.ts`): ≥ 25 chains, ≥ 15
  two-reading rows, ≥ 25 must-not-act rows (`silme`, `don't delete 3`, `3. sayfadaki resmi sil`,
  `dosyayı sil`, `delete annotation`, `delete the file`, `sil` with no selection, `rotate the
  image`, `imzayı sil`…), ≥ 15 folk-word rows, ≥ 10 rows per family, every lexicon entry used at
  least once (asserted against `lexicon.ts`), every `Problem` at least once.
- The owner's examples are rows, verbatim:

| Sentence | Expected |
|---|---|
| `3-5. sayfaları döndür ve 2 MB altına sıkıştır` | `rotate 3-5 +1 ; compress <2MB` |
| `son sayfayı sil` | `delete 24` |
| `jpg olarak kaydet` | `export jpeg all` |
| `imzamı 2. sayfaya koy` | `sign 2` |
| `IBAN'ları karart` | `redact iban` |
| `split every 10 pages` | `split every 10 [1-10 11-20 21-24]` |
| `çift sayfaları çıkar` | `? delete 2,4,6… \| extract 2,4,6…` |

- More rows the builder must include (shape guide): `3 ve 5. sayfaları sil` → `delete 3,5`;
  `3. sayfayı döndür ve çoğalt` → `rotate 3 +1 ; duplicate 3 (inherited)`; `sıkıştır ve döndür` →
  `rotate 7 +1 ; compress` (run order); `ilk iki sayfayı sona taşı` → `move 1-2 end`; `5'i 2'nin
  önüne taşı` → `move 5 before 2`; `move 5 before 2`; `rotate all except 1 left` → `rotate 2-24
  -1`; `5. sayfadan itibaren sil` → `delete 5-24`; `sayfa numarası ekle` → `numbers all`; `çift
  sayfalara sayfa numarası koy` → `numbers even`; `"GİZLİ" filigranı ekle` → `watermark "GİZLİ"
  all`; `filigran ekle` → `watermark ? all` (handoff); `pdf'i word'e çevir` → `unavailable
  pdf-to-word ~document.exportMarkdown`; `word'ü pdf'e çevir` (OFFICE) → `office-to-pdf`;
  `türkçeye çevir` → `unavailable translate`; `imzala` → `? sign 7 | certify`; `e-imza ile imzala`
  → `certify`; `son sayfaya git ve imzala` → `sign 24`; `kişisel bilgileri karart` → `redact email
  iban card tckn phone`; `taranmış sayfaları metne çevir` → `ocr all`; `tüm açık belgeleri
  birleştir` → `combine`; `şifre koy` → `password`; `yazdır` → `print`; `fatura kelimesini bul` →
  `find "fatura"`; `döndr 3` → `rotate 3 +1 (döndr→döndür)`; `sil` (DOC24_SEL) → `delete 3,4,9`;
  `sil` (DOC24) → `! needs-pages delete`; `delete 1-24` → `!
  all-pages`; `rotate 3 and compress and print` → `! two-finishing`; `split every 10 and rotate 3`
  → `! after-split`; `sil 3 ve 5. sayfaya numara ekle` → `! shifted`; `pdf'i böl` → `split
  choose`; `böl 10` → `? split every 10 | split at 10`; `sayfaları ters çevir` → `? reverse all |
  rotate 1-24 2`; `1,5 MB altına sıkıştır` → `compress <1.5MB`; `jpg` → `export jpeg all`;
  `pdf to jpg` → `export jpeg all`; `rotate 3` (PHONE) → `rotate 3 +1`; `combine` (PHONE) → `!
  phone`.

### 4.2 Unit tests (vitest, `cd apps/web && pnpm exec vitest run --maxWorkers=1 <files>`)

| File | Lane | Covers |
|---|---|---|
| `commands/intent/turkish.test.ts` | N1 | Suffix chains (accept/reject tables), apostrophes, `-daki`, negation, verb forms, alternants, ordinals |
| `commands/intent/ranges.test.ts` | N1 | Every row of §2.3, invalid cases, number words EN/TR |
| `commands/intent/targets.test.ts` | N1 | Sizes (units, decimals, comparators), formats, direction, patterns, watermark text |
| `commands/intent/grammar.test.ts` | N1 | Clause split rule, ellipsis, run order, chain problems |
| `commands/intent/lexicon.test.ts` | N1 | No filler is a noun stem; every entry's words fold to themselves; no word maps to two actions unless one is marked secondary/`alwaysAsk` |
| `commands/intent/corpus/corpus.test.ts` | N1 | §4.1, plus the 1 ms timing |
| `commands/keywords.test.ts` | N1 | New folk keywords |
| `commands/intent/preview.test.ts` | N2 | Every corpus reading (imported from N1's corpus) has a preview in **both** locales: non-empty `sentence`, a non-empty `label` per step, `pages` on every page-taking step, `parts` on split, `undo` set; the key changes with the version |
| `commands/intent/run.test.ts` | N2 | Stale key → `'stale'`, nothing changes; refused guard → nothing runs; a two-step document chain is one history entry and one undo restores both; a chain with output opens Save a copy with the request after the commit; a failing commit stops the finishing step |
| `export/save-copy-model.test.ts` | N2 | `applyRequest` for each request; `chooseForTarget` table (same already under, smaller meets, smallest meets, none meets) |
| `commands/palette-intent.test.ts` (rewritten) | N3 | Rows from previews; partial and unavailable rows |
| `shell/CommandPalette.intent.test.tsx` (browser mode) | N3 | Enter before paint does nothing; Enter with `deferredQuery !== query` does nothing; two readings both options; Up/Down/Left/Right; `aria-describedby`; announcement text |

### 4.3 e2e (Playwright; lane N3, `apps/web/e2e/intent-bar.spec.ts`, teaching sample, 8 pages)

Build with `RECTO_RENDER_OVERRIDE=1 ../../tools/dev/heavy.sh pnpm build`, run
`E2E_SKIP_BUILD=1 E2E_PORT=<port> pnpm exec playwright test intent-bar.spec.ts --project=chromium
--workers=1`; tests wait with `settled(el)`.

1. `rotate 2-3 right and delete page 8`: the row shows pages 2, 3, 8; Enter; 7 pages, pages 2–3
   landscape; one ⌘Z → 8 pages, both portrait.
2. `çift sayfaları çıkar`: two readings visible at once; Enter runs the first (delete 2, 4, 6, 8);
   ⌘Z restores.
3. `jpg olarak kaydet`: Save a copy opens on Images with JPEG chosen; nothing downloads.
4. `3-5. sayfaları döndür ve 2 MB altına sıkıştır`: pages turned, Save a copy on Size with the
   target line; ⌘Z (after closing the sheet) takes the rotation back.
5. `pdf'i word'e çevir`: the honest row and the Export as text row under it; Enter on the first
   does nothing.
6. `silme 3` and `3. sayfadaki resmi sil`: no reading row; 8 pages stay.
7. Fast typing: `fill('delete 8')` and Enter in the same tick → either nothing or the delete
   after its row painted; never a delete without the row in the DOM (asserted with a
   `MutationObserver` log of `[data-intent]` rows before the page count changes).
8. `imzala` → two readings; choosing the second opens the certificate dialog.
- Phone project (lane N4 only): Go to page sheet, `son sayfayı sil`, preview line, Enter, Undo.

UI screenshots at 1440×900 and 1180×820 (touch) for N3's PR.

---

## 5. Lanes for builders

Four lanes. N1 and N2 run in parallel from the contracts in §2.10 and §2.11; N3 starts with
N1/N2's types and fixtures and merges last of the three; N4 waits for the owner (Q1). Each lane is
one branch and one PR into `develop` (PRC-17, PRC-18), Conventional Commits with scope `ui` (N1:
`ui`; N2: `export` for the Save a copy commit, `ui` for the rest).

### N1 · Parser and corpus (lane: platform-commands; no UI)

- **Owns**: `apps/web/src/commands/intent/` — `types.ts` (exactly §2.10, first commit, so N2/N3
  can import), `normalise.ts`, `tokenise.ts`, `turkish.ts`, `ranges.ts`, `targets.ts`,
  `lexicon.ts`, `grammar.ts`, `score.ts`, `parse.ts` (exports `parseIntent`), `corpus/*`, their
  tests; the `cmd_*_keywords` lines in `messages/en.json` and `tr.json` (§2.18) and
  `commands/keywords.test.ts`.
- **Does not touch**: `commands/query.ts`, `query.test.ts`, `palette-intent.ts`,
  `CommandPalette.tsx` (N3 removes the old ones).
- **Done when**: `corpus.test.ts` passes with the coverage counts of §4.1 and the 211 regression
  rows (with the PRD-39 `çıkar` change); all N1 unit tests pass; `parseIntent` mean ≤ 1 ms;
  `pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; the PR body lists the corpus row
  counts per tag and the estimated gzip of `commands/intent/` (minus preview/run/context) from a
  build's `recto:bundle-modules` report, ≤ 12 KB.
- **Depends on**: nothing.

### N2 · Preview, runner, Save a copy requests (lane: platform-commands + export)

- **Owns**: `commands/intent/context.ts` (`gatherIntentContext()`, the workspace version counter),
  `commands/intent/preview.ts` (§2.11, `previewOf`, `previewWithGuard`),
  `commands/intent/plan.ts` (composed operation, labels), `commands/intent/run.ts` (§2.12), their
  tests; `export/export-store.ts` and `export/save-copy-model.ts` for PRD-40: a
  `SaveCopyRequest = SaveCopyPreset | { kind: 'size'; targetBytes: number } | { kind: 'images';
  type: RasterFormat; range: string } | { kind: 'text'; format: 'markdown' | 'text' }`,
  `openSaveCopy(documentId, request)`, a pure `applyRequest(draft, request)` (extends
  `applyPreset`), a pure `chooseForTarget(estimates, quick, targetBytes): { size: SizeChoice;
  meets: boolean }` (the least lossy of same → smaller → smallest whose estimate ≤ target; else
  smallest with `meets: false`); `export/SaveCopySheet.tsx` and `SaveCopySections.tsx` only for
  the target line under Size ("Target: under 2 MB · Smaller ≈ 1.4 MB" / "Hedef: 2 MB altı · Daha
  küçük ≈ 1,4 MB"; when none meets: "Smallest is about 2.6 MB; the target can't be reached here"
  / "En küçük yaklaşık 2,6 MB; hedefe burada ulaşılamıyor"; keys `save_copy_target`,
  `save_copy_target_unmet`) and for applying the chosen size once the estimates arrive (until
  then the sheet shows Smaller, as `applyPreset('size')` does). The N2 message keys of §2.17 and
  the two Save a copy keys, appended after `palette_intent_ambiguous`.
- **Does not touch**: the parser files, `CommandPalette.tsx`, `palette-intent.ts`.
- **Done when**: `preview.test.ts` passes over N1's corpus in both locales (until N1 merges, over
  a local fixture list of `Reading`s written from §4.1's examples); `run.test.ts` and
  `save-copy-model.test.ts` pass; the existing `export/*` tests pass; the target line screenshot
  at 1440×900 and 1180×820; typecheck/lint/format clean.
- **Depends on**: N1's `types.ts` (first commit); final preview test needs N1 merged.

### N3 · The bar (lane: platform-commands UI)

- **Owns**: `shell/CommandPalette.tsx`, `CommandPalette.module.css`, new
  `shell/palette/IntentRows.tsx` + `.module.css` (reading rows, two-readings group, page strip on
  `FindThumb`, parts labels, footnote), `commands/palette-intent.ts` (rewritten as the adapter:
  `parseIntent` + `previewWithGuard` + `runReading`; the old `QueryIntent` code paths removed),
  deletion of `commands/query.ts` and `query.test.ts` (their rows live in N1's `regression.ts`),
  `commands/palette-intent.test.ts`, `shell/CommandPalette.intent.test.tsx`,
  `e2e/intent-bar.spec.ts`, `e2e/palette-intents.spec.ts` (kept green or folded in),
  `tools/qa/bundle-budget.ts` + `.json` (the `intentBar` gate, §2.19), the N3 keys of §2.17
  appended after `palette_title`.
- **Done when**: the §2.13 rules hold in browser tests; e2e §4.3 items 1–8 pass on Chromium; the
  bundle script passes with `intentBar ≤ 20 KB` and `editor` within its cap; screenshots at
  1440×900 and 1180×820 (touch) of: one reading, a chain, two readings, a problem, partial,
  unavailable; typecheck/lint/format clean.
- **Depends on**: N1 and N2 merged (it can build against their types and fixtures earlier).

### N4 · Phone (lane: compact) — after the owner answers Q1; first to cut

- **Owns**: `shell/compact/CompactMoreSheets.tsx` (`GoToSheet` reads sentences through a lazy
  import of `commands/intent/parse` on the first non-digit; preview line from `previewOf`; Enter
  runs `runReading`), `shell/compact/jump.ts` if needed, its tests, the phone e2e step.
- **Done when**: phone subset of §2.16 works, everything else shows `phone`; `compactSession`
  unchanged (bundle script); phone screenshot at 390×844.
- **Depends on**: N3 merged; Q1 answered.

### Order and concurrency

N1 ∥ N2 (two builders) → N3 → (N4). Never run typecheck/lint/build at the same time as vitest
(Paraglide). N2 and N3 both edit `messages/*.json` in different blocks (named above) so the merge
is mechanical.

---

## 6. Risks and cuts

| Risk | Mitigation |
|---|---|
| **Misreads that pass coverage** (a word wrongly in the filler list, a suffix chain too loose, `-daki` missed) run a real change | Coverage-1 rule, no nouns in fillers (asserted), negation and `-daki` rejection, ≥ 25 must-not-act rows, preview + one-step undo, `all-pages` refusal. The owner reads the corpus before deploy (PRC-25). |
| **Enter races the preview** (deferred value, lazy chunk, document changed by a toast's Undo) | §2.13: text equality, painted keys, version check in the runner; e2e item 7. |
| Turkish in the wild is wider than the corpus | The corpus grows with each tester report (a row per report, the lead's habit since PRD-23); a not-understood sentence always leaves the command list usable. |
| Two readings feel like a question too often | Only `alwaysAsk` words and near ties; the corpus counts how many rows show two readings (≤ 10 % outside the ambiguity section). |
| Save a copy target is only as good as the estimates | The sheet says the estimate and when the target cannot be met; no silent over-compression; no dpi search in this move. |
| Bundle | Gate `intentBar`; lexicon as compact arrays; suffix chains generated at module load from small tables. |
| Scope creep (zoom, header/footer, Batch plans, redact typed text) | Out of this move (§2.1); each falls to the command list. |

Cut order if time runs short (first cut first): **N4 phone**; typo tolerance; `split into N
parts` and `split at`; `move`; `reverse`; furniture as document steps (keep them as handoffs that
open the dialog); the target line in Save a copy (keep `{ kind: 'size' }` opening Smaller with
"Now about 4.8 MB" in the preview); side-by-side layout (stack); thumbnails (the sentence and
`pagesLabel` stay; the owner's "affected pages shown" is then met by text). Never cut: the corpus,
the preview-before-run rules, one-step undo for document chains, honest unavailable rows.

---

## 7. Open questions

For the owner (taste/scope):

- **Q1 · Phone.** Does the phone get sentences in this move, and where: the Go to page sheet's
  field (proposed), or a new "Type a command" row in ⋯? Default until answered: no phone change.
- **Q2 · Outputs on Enter.** Proposed: "jpg olarak kaydet", "2 MB altına sıkıştır" open Save a
  copy already set, and the sheet's button writes the file (one more press, real estimate shown).
  Alternative: Enter writes the file directly with the sheet's last choices. Default: the sheet.
- **Q3 · Name.** Does the bar get a visible new name (e.g. "Ne yapmak istersiniz?") or stay
  "Komut paleti" with a sentence placeholder? Default: stays, placeholder changes.

For the lead (taste within the owner's frame; defaults applied if unanswered):

- **Q4 · Layout of two readings** (side by side vs stacked at 640 px): the design director's.
  Default: side by side ≥ 560 px popup width.
- **Q5 · Thumbnail marks**: the design director draws the six marks (turned, struck, doubled,
  numbered, stamped, moved). Default until drawn: rotation shown by turning the thumbnail; the
  others by a small glyph from the existing icon set (`arrow-clockwise`, `trash`, `copy`,
  `hash`, `seal`, `arrows-down-up`).

Decided here as technique (recorded in PRD-39, not open): lexicon as code data; `çıkar` shows two
readings with Delete first (amends PRD-23); typo tolerance on ≥ 5-letter words at reduced weight;
page numbers read against the document before the chain; finishing step always last; a sentence
with any problem runs nothing; furniture needs a run of pages; `redactFind` switches to Read mode
itself.

---

## 8. Done for the whole move

- The corpus (≥ 200 new TR+EN rows plus 211 regression rows) is a passing test, and the owner has
  read it through (not a blocker for merging, a blocker for deploying: PRC-25).
- Every reading in the corpus has a preview in both languages (`preview.test.ts`).
- No path runs a reading whose preview was not painted from the same text and document version
  (browser test + e2e item 7).
- A chain of document steps is one undo step; a chain with a handoff says "Each step undoes on its
  own"; an output says the copy is a new file.
- `intentBar ≤ 20 KB gzip`, editor within its cap, compact unchanged.

---

## 9. Decision rows

### Index lines (`docs/process/decisions.md`, Product table)

```
| [PRD-39](decisions/product.md) | The palette reads sentences (TR/EN, chained, two readings when unsure), previews every step and runs only what was shown; no model | In force; the owner reads the corpus through | 2026-10-31 |
| [PRD-40](decisions/product.md) | Save a copy takes a request from the palette (images type/range, text format, size target); the bar never writes a file itself | In force | 2026-10-31 |
```

And PRD-23's index status becomes: `In force, amended by PRD-39 (phase 3 in; çıkar shows two readings)`.

### Full rows (`docs/process/decisions/product.md`)

```
| PRD-39 | **The intent bar: ⌘K reads sentences, shows what will happen, runs only what was shown (owner, the "Niyet çubuğu" move; R12 E10 phase 3 without a model).** `commands/intent/` is pure: `parseIntent(text, ctx)` returns up to two readings, a partial understanding, or nothing (the command list as before). Technique: PRD-23's fold and every-word-understood rule, a lexicon held as code data in both languages whatever the UI language, Turkish words matched only as lexicon stem + an allowed suffix chain (plural, possessive, case; verb imperative, polite, infinitive, question forms), apostrophes split, `-daki/-ki` on a page word and any negation (`silme`, `don't`) never act, object words (`pdf'i`, `dosyayı`) only for document-level actions, typo tolerance on words of five letters or more at reduced weight. Actions: go to, heading, recent, find; rotate, delete, duplicate, move, reverse, split, page numbers, watermark (document steps); extract, combine, place signature, certificate, redaction finder by pattern, OCR, password, fill (handoffs, which open their tool or sheet set); compress with a size target, images by type and range, text, save a copy, print (outputs, PRD-40); PDF to Word/Excel/PowerPoint and translation answer honestly with the nearest command. *Chaining*: clauses split at a conjunction only when both sides have a verb; page numbers are read against the document as previewed; document steps run in typed order as one history entry; at most one handoff or output, always last; a sentence with any problem runs none of its steps. *Two readings* show together when scores are close or the word is known two-way (`çıkar` delete/extract with Delete first, amending PRD-23; `imzala` place/certificate; `böl N`; `ters çevir`). *Seen*: Enter runs a reading only when the rows on screen were made from the exact typed text, have painted, and the document has not changed since. Corpus: `commands/intent/corpus/` (≥ 200 new TR/EN rows plus PRD-23's 211). Bundle: the parser loads with the palette's intent chunk, gate `intentBar` 20 KB gzip, editor and compact unchanged. Phone: not in this move until the owner chooses the entry (proposed: the Go to page sheet). Spec: `docs/specs/niyet.md`. | 2026-10-31 | Owner approval of the move (conversation, 2026-10-31); lead technique call; amends PRD-23; PRD-9 kept (no model) | In force; the owner reads the corpus through; phone and Enter-writes-the-file are open to the owner |
| PRD-40 | **Save a copy takes a request from the palette, and the palette never writes a file itself (PRD-39).** `openSaveCopy(documentId, request)` takes a preset as today or `{ kind: 'size', targetBytes }`, `{ kind: 'images', type, range }`, `{ kind: 'text', format }`; the pure `applyRequest` sets the draft. A size target picks the least lossy of Same, Smaller, Smallest whose estimate is at or under it once the engine's estimates arrive (Smaller until then) and says so under Size; when none meets it the sheet shows Smallest and says the target cannot be reached here. No dpi search. | 2026-10-31 | Lead technique call for PRD-39 | In force; the owner may choose Enter-writes-the-file instead (PRD-39 Q2) |
```
