# Decisions: Product

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| PRD-1 | **Only the owner declares V1 and "beta v1".** V1 = Recto 1.0.0, when the owner says so. Nothing is tagged beta, and no release PR or tag is made, until the owner says the word. | 2026-10-04, restated 2026-10-09 | Spec §14 item 6; PLAN header, V1-R6, P-4; owner, conversation | In force |
| PRD-2 | **Each extra feature is measured** (hours, work packages, necessity, impact, risk) and reported. The owner decides V1 or later for each row. | 2026-10-09 | Sheet; owner, conversation | In force; sheet awaits the owner's marks |
| PRD-3 | **VoiceOver and extra accessibility are not V1 requirements.** E27 and E34 move after V1. V1 rows carry no VoiceOver work. The ADR-0028 CI gates still apply. | 2026-10-09 | Sheet "Owner rules applied"; owner, conversation | In force; PLAN V1-A7 to be amended to match |
| PRD-4 | **The URL stays on github.io.** No custom domain for now (PLAN P-5 stays "later"). | 2026-10-09 | Owner, conversation; PLAN V1-R5, P-5; ADR-0016 | In force |
| PRD-5 | **The name is Recto.** "Recto PDF" is the descriptor. Trademark searches are recommended before a public launch, as the owner's call. | 2026-10-01, 2026-10-04 | ADR-0015; Spec §14 item 4 | In force |
| PRD-6 | **Presentable first.** The new UI/UX (layout, look, motion, core use) is finished before rarely used features, which follow as updates. | 2026-10-05 | `specs/redesign.md` §11, "Reorder of 2026-10-05" | In force |
| PRD-7 | **Documents open unlocked** (`openDocumentsLocked` false). Signed and restricted files still open locked (W1-b). | 2026-10-04 | Spec §14 item 1; ADR-0029 | In force |
| PRD-8 | **Documents are kept on the device.** Open ones with their changes. Closed ones stay in Recents for 30 days or 500 MB, listed and clearable. | 2026-10-04 | Spec §14 item 2; ADR-0032 | In force |
| PRD-9 | **No on-device model dependency for now** (D-1). Revisit after W3 with one opt-in embedder served from Recto's origin. Models belong to desktop (DT-10). | 2026-10-09 | R12 Owner decisions D-1 | In force |
| PRD-10 | **Flashback is on** (D-2): always on in the installed app, and on with a visible storage notice in Safari tabs. Redaction "befores" are never kept without opt-in. | 2026-10-09 | R12 D-2 | Superseded on timing by PRD-15 |
| PRD-11 | **Paragraph text editing:** Tier B is built. Tier C (push later blocks down) and Tier D (reflow across pages) are declined. | 2026-10-03 | ADR-0020 | In force |
| PRD-12 | **Standing promises:** no telemetry, no analytics, no account, in every edition. Web page code keeps `connect-src 'self'`. | 2026-09-26, restated 2026-10-09 | PLAN §1.2; ADR-0004 | In force |
| PRD-13 | PLAN §6 questions O-1 to O-9 (edition split, Must list, spice, ◇ candidates, perf runs, concurrency, phone pilot, desktop questions). | 2026-10-09 | PLAN §6 | Open, except as covered by EDN-1 to EDN-6 and PRC-3 below |
| PRD-15 | **Flashback joins V1 only if it is easy.** The feature sheet sizes S8 at about 36 h with medium risk (Safari eviction, privacy cases), so it is not easy: Flashback moves after V1. A smaller slice may come back to the owner if one proves cheap. D-2's behaviour (on, with the Safari notice) holds whenever it ships. | 2026-10-11 | Owner, conversation; Sheet S8 | In force |
| PRD-16 | **Dictation (voice input) is after V1.** The owner does not see it as a needed feature. | 2026-10-11 | Owner, conversation | In force |
| PRD-17 | **Parked until the owner tests on a large screen:** the sidebar covering a fit-width page (scroll a hit or jump clear of it?), Settings opening from its trigger, and the pill's Contents list on narrow windows (DSN-27). Defaults stay as built. | 2026-10-11 | Owner, conversation | Open |
| PRD-14 | **W0-q findings are assigned to waves:** signed fixture opens locked and saves byte-identical (W1-a/W1-b), `truncated.pdf` repaired (W1-g), press budgets (W1-f, viewer-read, Compare as a place), "go back" after a link (S1-1, W2). | 2026-10-09 | PLAN "W0-q findings" | In force; W1-b and W1-g merged |
