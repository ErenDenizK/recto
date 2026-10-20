# Presentability sweep before the first user tests (2026-10-20)

The design director walked `develop` at `b962464` (render override) at 1440×900, 1180×820 touch and
390×844 touch, in light and dark, with a Turkish pass at 390 px (browser locale). The yardstick is
the quality bar (Q-1…Q-14) and brief B-16. Overall: the glass reads as one standard in both themes,
the sample is fully translated, and nothing overflows at 390 px.

| # | Screen | Size / theme | Problem | Severity | Likely fix |
|---|---|---|---|---|---|
| 1 | Phone edit island, tool chip | 390 | After a tool change the old and new icons stay stacked (the old one keeps `.in`), still 3 s later | send back | `shell/compact/mark/EditIsland.tsx` (~150–163), `.in`/`.out` in `EditIsland.module.css` |
| 2 | Combine with one document open | 1440 | The name is prefilled "Combined – Recto sample +" | send back | `combinedTitle` in `home/home-model.ts` for fewer than two titles |
| 3 | Command palette | all | "About Recto" and "About this app" are listed side by side | send back | `commands/app-commands.ts` (`help.about`, `help.aboutPage`) |
| 4 | Library | 1440 | "Try the sample" is still offered while the sample is open, right under its card | send back | `home/` |
| 5 | Phone Document info, sample | 390 | Producer reads "@cantoo/pdf-lib 2.11.1" | send back | the sample's Producer becomes Recto |
| 6 | Phone tool drawer, Turkish | 390 TR | "Metni düzenle" wraps to two lines and its icon rises out of the row (Q-8) | send back | `ToolDrawer.module.css` |
| 7 | Tablet palette | 1180 | A bare "6" between arrows; desktop says "6 fields" | polish | palette fields stepper |
| 8 | Review filters | all | "All 6 · Comments 1 · Marks 0": the 5 form fields have no chip | polish | Review chips |
| 9 | Combine | 1440 light | An empty grey block under Name; the reason line sits far away at the foot | polish | combine sheet layout |
| 10 | Phone Settings | 390 TR | Reduce motion is a dropdown in Turkish, a segmented control in English | polish | compact settings |
| 11 | Top strip | all | "Saved" shows on an untouched sample while the title menu says "No changes" | polish | save-state pill |
| 12 | Page pill menu | 1440 | "1 of 8" in the menu against "1 / 8" on the pill | polish | pill menu |
| 13 | Phone title menu | 390 | The header repeats name, size and pages; the next row is Document info (DSN-52) | polish | compact file menu |
| 14 | Title menu | 1180 touch | Keyboard shortcuts and "Hold to peek" shown on touch | polish | `ui/Menu` |
| 15 | New signature | 1440, 390 | A large gap under Undo stroke / Clear | polish | `signatures/new-signature-form.tsx` |
| 16 | Find | all | The sample always shows "No text on 1 page · Recognize text…" | polish (taste) | sample or Find section |
| 17 | Edit island | 390 dark | The black ink dot reads as a stray dot on the pen icon | polish | EditIsland badge |
| 18 | Phone Library | 390 | Pen / Highlight / Text / Sign labels look like buttons | polish | compact Library |
| 19 | Settings | 1440 | "Follow the browser (English)" is twice as wide as the other segments | polish | language row |
| 20 | Settings | 1440 | Kept documents says 106 KB; elsewhere the same file is 100 KB | polish | storage row |
| 21 | Go to page | 390 | The hint is indented past the field's edge | polish | compact go-to sheet |
| 22 | Pen preset | 1440 | Its width slider differs from the ink strip's | polish | `annotations/pen/PresetEditor` |
| 23 | Sidebar and dock | all | The sidebar's "Pages" tab and the dock's "Pages" are two different views | polish (taste) | labels |
| 24 | More tools | 1440 | "Certificate…" is vague; the palette says "Sign with certificate…" | polish | palette More menu |
| 25 | Title menu | 1440 | Disabled rows give no reason | polish | `ui/Menu` (DSN-52) |

Items 1–6 are fixed before the user tests (R23 cycle 3). The polish items are ranked into the
roadmap; items 16 and 23 are taste calls for the lead.
