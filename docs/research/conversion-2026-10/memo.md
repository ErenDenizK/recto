# File conversion: what to do about "DOCX to PDF" (2026-10-19)

Strategist memo for the CEO (PRC-24), after the first outside tester asked whether Recto converts
DOCX to PDF. Research only.

## What Recto already does

- Images (PNG, JPEG, WebP) to PDF pages, Fit A4 or original size: `apps/web/src/files/images.ts`,
  `files/open-files.ts`, `pages-sheets/InsertImagesSheet.tsx`.
- PDF pages to PNG, JPEG or WebP at a chosen DPI, zipped: `apps/web/src/tools/rasterize.ts`.
- PDF to Markdown or plain text: `engine/src/convert`, `e2e/convert.spec.ts`.
- Combine, extract, interleave: `pages-sheets/`.
- Office conversion is excluded on purpose (README "What it does not do", `docs/VISION.md`,
  `docs/research/04-feature-feasibility.md`: "hard to impossible for fidelity").

Nothing is labelled "convert", so testers do not find what exists.

## DOCX to PDF in the browser

| Option | Size | Fidelity | Licence | Effort | Notes |
|---|---|---|---|---|---|
| LibreOffice as WASM (ZetaOffice; BentoPDF's build) | about 49 MB on first use | high (LibreOffice's) | MPL-2.0 (zetajs MIT) | 2–3 weeks | needs cross-origin isolation (COOP/COEP); GitHub Pages cannot send the headers, so a service-worker shim or another host |
| DOCX parser plus our own layout | 50–150 KB, but a dependency or months of work | low (tables, floats, fields, fonts) | varies | months | |
| HTML then the browser's print | small | low to medium | – | 1–2 weeks | no bytes back to verify; weak UX |

Competitors: Smallpdf, iLovePDF, Acrobat online and PDF24 online upload the file. Stirling PDF
runs LibreOffice on its own server. BentoPDF converts in the browser with LibreOffice WASM (AGPL,
needs COOP/COEP). Preview does not open DOCX. Demand is real: "word to pdf" is about 2.5 M global
searches a month, one of the top three PDF-tool queries. But it is a converter query, well served
by free uploading sites, and a low-fidelity converter would hurt "correctness first" more than
having none.

## Recommendation

1. **Now, no dependency:** surface the conversions we have under the names people search for
   ("Images to PDF", "PDF to JPG / PNG", "PDF to Markdown") on Home and in the command keywords.
2. **Next, no dependency:** Text (.txt) to PDF with the bundled Noto Sans and the paragraph
   line-breaker (3–4 days); then Markdown to PDF with a small built-in parser (1–1.5 weeks).
3. **Board:** LibreOffice WASM loaded only when an Office file is opened (about 50 MB on first
   use, MPL-2.0 unmodified with notices, cross-origin isolation needed). Advice: wait until more
   testers ask.
4. **Not:** server-side conversion, our own DOCX layout engine, raster "conversion".

Sources: Ahrefs (sodapdf.com keywords), allotropia's ZetaOffice announcement (2024-11-08), the
SFSCON 2024 LibreOffice WebWidget slides, zetajs on npm, BentoPDF's self-hosting docs.
