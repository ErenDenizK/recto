# iPad check list: converting Office files on the device

The owner's hand check for on-device Office conversion (decisions PRC-26, EDN-20; plan in
`docs/research/conversion-2026-10/office-phase-2.md`). Playwright's WebKit on Linux is not iPad
Safari (memory limits, the system killing background tabs), so only a real iPad answers whether
this works there. It takes about 20 minutes.

**Set up.** An M-series iPad on iPadOS 17 or later, Safari, on Wi-Fi with about 100 MB free. Open
the live site with `?office=1` added to the address. Have a `.docx`, an `.xlsx` and a `.pptx` in
the Files app (a few pages each is enough).

**Record.**

- iPad model:
- iPadOS version:
- Date:

Mark each step Pass or Fail. For a failure write what you saw (and take a screenshot).

| #   | Step                                                                                                                                                   | Pass / Fail | What happened |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------- |
| 1   | Open the live site in Safari. The page opens and the library shows.                                                                                    |             |               |
| 2   | Choose Open files and pick the `.docx` from Files. A sheet asks before downloading the conversion package.                                             |             |               |
| 3   | Agree to the download (on Wi-Fi). It shows progress and finishes.                                                                                      |             |               |
| 4   | The page reloads once by itself, then converts the file.                                                                                               |             |               |
| 5   | The PDF opens as a tab, with the right number of pages and readable text.                                                                              |             |               |
| 6   | Convert the `.xlsx`. No question is asked this time and no reload happens. The PDF opens.                                                              |             |               |
| 7   | Convert the `.pptx`. The PDF opens with one page per slide.                                                                                            |             |               |
| 8   | Convert three files in a row. The tab does not reload and Safari does not say "A problem repeatedly occurred".                                         |             |               |
| 9   | Leave the tab for five minutes (use another app or lock the iPad). Come back and convert a file again. It works without downloading the package again. |             |               |
| 10  | Turn on airplane mode. Convert a file. It works.                                                                                                       |             |               |
| 11  | Open Settings, find Office conversion package, tap Remove…, and confirm. It says the package is removed.                                               |             |               |
| 12  | Reload the page and open a regular PDF. It opens and works as before.                                                                                  |             |               |
| 13  | Add the site to the Home Screen. Open it from there and repeat steps 2 to 5.                                                                           |             |               |

**Overall (Pass or Fail):**

Notes (slow steps, anything odd, how long the conversion took):
