# R22 research: one phone sheet pattern (C-11) and the clean-up plan (C-9)

Read-only research for the 2026-10-17 brief. The owner chooses C-11's option; the clean-up
packages run in lanes after R22's feature lanes.

## C-11: one pattern for phone sheets

### What the phone uses today (`apps/web/src/shell/compact/`)

| Opens from | What opens | Pattern | Items | How often |
|---|---|---|---|---|
| Split top ⋯ | Contents (if the PDF has an outline), About | Liquid menu grown from its button | 1–2 | rare |
| Title ▾ | File card, Share / Save a copy, Document info | Liquid menu | 2–3 + card | per document |
| Capsule top ⋯ (`?top=capsule`, not default) | Contents, Share, Info, About | Menu | 3–5 | not in use |
| Page number | Go to page | `CompactSheet` (full width, bottom edge, scrim, one height, Done) | a field | occasional |
| ⋯ → Contents | Outline | `CompactSheet` tall | n rows | per document |
| Info, About, Password | Facts; settings rows | `CompactSheet` | content | rare |
| Library gear | the About sheet (settings live there) | `CompactSheet` | content | rare |
| A note | Note text | Popover | content | rare |
| Overview ＋ Add | From a file, Blank page, recents | Menu | 2 + N | occasional |
| Overview ⋯ (selection) | Duplicate, Move, Extract, Split | Menu | 5 | occasional |
| Edit chip ▾ | Tool drawer: floating, 16 px inset, 28 px corners, no scrim, stays open, caret to close; a list version behind `?drawer=list` | custom panel | 5 tools + options + actions | every editing session |
| Sign → New | New signature | desktop `ui/sheet` at 92 % (a third sheet path) | pad | rare |

Four looks (grow-out menus, a bottom-edge sheet, a floating drawer, the desktop sheet) with
different corners, headers, closing and motion. The problem is not "pop-up or drawer"; it is
that the panels look like different products.

### iOS

Menus (⋯, title) for short command lists where one tap acts and closes; iOS 26 grows them
from their button, as our liquid menu does. Sheets (HIG) for content, settings or anything that
stays open: grabber, medium and large detents, swipe down to close; in iOS 26 a medium sheet
floats inset with large corners and attaches to the edges at large. Our tool drawer already
looks like an iOS 26 medium sheet; `CompactSheet` looks pre-26. Popovers become sheets on iPhone.

### Options

- **A (recommended): menus for commands, one sheet for everything else.** A menu when the list
  is a few commands and one tap finishes; everything showing content, holding settings or
  staying open is the same floating glass sheet (grabber, title, round close, medium height,
  pull up to large, swipe down to close). The tool drawer is its "stays open, no scrim" form;
  Contents, Go to page, Info, Settings, Password, New signature and the note are its "scrim"
  form. Changes: `CompactSheet` takes the drawer's inset shape and header and gets medium/large
  heights (Base UI 1.8 Drawer snap points, no dependency); New signature and the note move onto
  it; the split-top ⋯ (1–2 rows) merges into the title menu; the gear opens "Settings" with
  About as a row; one drawer variant (tiles or list) stays. About 3–4 days in the compact lane.
  Risks: swipe-to-close against the detent drag in iOS Safari, the compact motion specs, no
  glass over glass over the edit island.
- **B: everything is a drawer.** One look, but Share and Info cost a tool panel's weight and
  break the iOS habit that ⋯ is a menu. Not recommended.
- **C: keep the split, align the details.** Same corners, close button and motion on today's
  four presentations. About 1 day; the bottom-edge sheet still reads as another object.

Owner questions: A or C; tiles or list for the tool drawer.

## C-9: clean-up and optimisation plan

### Measurements

- Bundles: first paint 119.8 / 120 KB gz, compact 296.0 KB (+1.0 %, at its cap), editor
  831 KB, precache 13.45 MB.
- First paint carries ~42 KB gz it does not need: `src/pwa/register.ts` imports the session
  store and `ui/Toast/toast` up front, which pull in `workspace-store` (13.8 KB) and the whole
  `@pdf-editor/document-model` barrel (28.5 KB, batch recipe validation included).
- The compact edition carries all 110 icons (`ui/icons.generated.tsx`, 16.8 KB gz); it uses ~36.
- `decisions.md` is 145 KB, 228 rows (one row 3,661 characters). Docs hold 33 MB with 282
  images (`design/audit` 8.5 MB, `redesign-2026-10` 11 MB).
- Stale: `CLAUDE.md` and ADR-0033 still say "read-only compact edition" (EDN-7 made the phone
  editable); ADR-0034 (editions), promised by EDN-1, was never written.
- GLS-20 leftovers: `src/` is clean; one e2e check (`e2e/compact-top-split.spec.ts:477`); DSN-37
  and DSN-40 statuses.
- Code: 37 exports never referenced; `clamp` ×10, `nextFrame` ×5, `lerp` ×4 copies;
  `CompactReader.tsx` 1,023 lines; 35 `ResizeObserver` sites (one per tiled page and per
  Segmented); 327 `addEventListener` against 305 `removeEventListener`.
- Tests: 302 unit files, 81 e2e specs; 733 bare `toBeVisible()` against 30 `settled()`; 44
  sleeps or `waitForTimeout` (16 in `input-rules.spec.ts`).

### Work packages (lanes without shared files)

| Lane | WP | Scope | Gain | Owner? |
|---|---|---|---|---|
| D docs | D1 | Archive superseded process docs, ROADMAP/DISCUSSION, unreferenced proposals to `docs/archive/`, fix links | clarity | no |
| | D2 | `decisions.md` becomes an index (id, one line, status, link); full rows in `decisions/<area>.md`, ids unchanged; build notes to specs; superseded rows archived | agents read ~145 KB less | told |
| | D3 | `CLAUDE.md` (phone editable, compact/mark/glass-gpu paths), agent-workflow clean-up rule, ADR-0034, ADR-0033 title | correctness | no |
| | D4 | Archive superseded audit screenshots | −10–15 MB | no |
| B bundle | B1 | Update toast and session store load only when the update toast shows | first paint ~119.8 → ~78 KB | no |
| | B2 | Icons split into a compact set and the full set | compact ~−10 KB | no |
| | B3 | Re-record the baseline; per-chunk breakdown in `bundle-budget.ts` | visibility | no |
| C compact | C1 | Delete losing variants: `?top=capsule`, one of ToolList / ToolDrawer | ~30–40 KB source | yes (drawer) |
| | C2 | Build C-11 | consistency | yes |
| | C3 | Split `CompactReader.tsx` and `CompactChrome.tsx` menus, no behaviour change | maintainability | no |
| | C4 | Stale `data-edge-tone` check; superseded statuses | tidy | no |
| T tests | T1 | This week's flaky specs onto `settled()` or the animation clock (PRC-14) | fewer reruns | no |
| | T2 | The 44 sleeps, worst first; fake timers for clock-reading unit tests | stability | no |
| | T3 | JSON reporter, slowest specs, split `a11y`, `motion`, `jobs` specs across shards | CI time | no |
| After | X1 | Shared `clamp`/`lerp`/`nextFrame`; delete unused exports | tidy | no |
| | X2 | Shared `ResizeObserver`; listener leak check with a heap snapshot | memory | no |
| | X3 | GPU glass texture eviction and slow-frame fallback, with C-5's profile | perf | no |

Order: B1, D1, T1 first; C1 and C2 after the owner's C-11 answer and the motion lane.
