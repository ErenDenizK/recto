# Print check list: the sample on each engine

The owner's hand check for Print… (PRD-25; memo `docs/research/print-2026-10.md`). The e2e test
stubs the print dialog, so only real browsers show what the dialog gets. It takes about 10
minutes per device.

**Set up.** Open the live site and choose the sample. Draw one pen stroke on page 1 and fill one
form field.

**Record.** Device, browser and version, date. Mark each step Pass or Fail; for a failure write
what you saw and take a screenshot.

| #   | Step                                                                                                                                                    | Pass / Fail | What happened |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------- |
| 1   | **Print the sample on the iPad** (Safari, iPadOS 17 or later): ⋯ title menu → Print…. The print sheet shows every page, the stroke and the field value. |             |               |
| 2   | On the iPad, cancel the print sheet, then print again. The second print shows the pages too, not a blank page or the app.                               |             |               |
| 3   | Safari on a Mac: ⌘P. The dialog's preview shows the pages (not the app), with the stroke and the field value.                                           |             |               |
| 4   | Chrome on a desktop: ⌘P / Ctrl+P. Chrome's PDF print preview opens with every page.                                                                     |             |               |
| 5   | Firefox on a desktop: Ctrl+P. A print preview with every page opens (from Firefox's PDF viewer, or the rendered pages).                                 |             |               |
| 6   | During a long document's "Preparing to print…", press Cancel. Nothing prints and no error shows.                                                        |             |               |
