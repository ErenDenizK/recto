<div align="center">

<img src="apps/web/public/icons/glyph.svg" width="64" height="64" alt="">

# Recto

**A PDF editor that runs entirely in your browser. Your files never leave your device.**

[**Open Recto**](https://erendenizk.github.io/recto/) · [Run it locally](#run-it-locally) · [How it's built](#how-its-built)

[![CI](https://github.com/ErenDenizK/recto/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/ErenDenizK/recto/actions/workflows/ci.yml)
[![Licence: Apache-2.0](https://img.shields.io/badge/licence-Apache--2.0-blue)](LICENSE)

</div>

<a href="https://erendenizk.github.io/recto/"><img src="docs/media/home.webp" width="100%" alt="Recto's Home: the document to continue, ways to start, and recent files as covers"></a>

## Why Recto

- **Private by design.** There is no server. Every PDF is opened, edited and saved inside the
  browser tab.
- **Many files at once.** Open several PDFs together and work across them in one place.
- **Works offline.** After the first visit Recto keeps working without a connection, on desktop,
  tablet and phone.

## What you can do

### Open many PDFs and arrange their pages

<img src="docs/media/open-many.gif" width="100%" alt="Three PDFs opened from Home and laid out in the Pages grid">

Open several files, then move, rotate, delete or extract pages across all of them on one grid.

### Mark up

<img src="docs/media/markup.gif" width="100%" alt="A sentence highlighted and a phrase underlined with the pen">

Highlight, pen, text, notes, shapes and stamps, saved as standard PDF annotations that open in
any other reader.

### Fill and sign

<img src="docs/media/sign.gif" width="100%" alt="A signed copy is downloaded and its signature reads Intact">

Fill in forms and sign with your own certificate. Recto tells you exactly what it checked.

### Redact

<img src="docs/media/redact.gif" width="100%" alt="Find sensitive data marks an IBAN; after applying, a search for it finds nothing">

Redaction removes the content under each mark instead of covering it, then checks the saved
file to confirm it is gone.

### On your phone

<p align="center"><img src="docs/media/phone.gif" width="280" alt="The phone edition: the sample magazine, a sentence highlighted by touch"></p>

A reader built for touch, with pen, highlight, text, text editing and signature.

### And more

Edit a line of text in its original font · recognise scanned pages (OCR) in nine languages ·
compare two versions · turn pages into Markdown · run saved steps over many files.

## Your files stay yours

Recto has no account, no cookies and no analytics. The page is only allowed to connect to its
own address ([Content Security Policy](apps/web/index.html)), and the privacy button in the app
counts any request to anywhere else. You can confirm it in your browser's network panel.

## Run it locally

You need Node.js 22 (see `.nvmrc`) and pnpm, through Corepack.

```sh
corepack enable
pnpm install
pnpm dev        # http://localhost:5173
```

`pnpm run ci` runs everything CI runs: format, lint, types, tests and the build. To host your
own copy, serve `apps/web/dist` from any static host over HTTPS.

**Built with** React 19, TypeScript and Vite · PDFium compiled to WebAssembly, running in a
Web Worker · WebGL2 for the glass surfaces · Paraglide for English and Turkish.
More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## How it's built

Recto is built by one person working with a team of AI agents. I set the direction and make the
important decisions: what Recto is, how it should feel and what ships. The agents do the
building, through the same GitHub process every time.

```mermaid
flowchart LR
  owner["Owner<br/>direction and decisions"] --> lead["Lead agent<br/>plans and briefs"]
  lead --> build["Builder agents<br/>one branch each"]
  build --> review["Reviewer agents"]
  review --> pr["Pull request"]
  pr --> ci["CI<br/>Chromium, Firefox, WebKit"]
  ci --> merge["Merge and record the decision"]
```

- **One task, one pull request.** Every change starts as a written brief and lands as a pull
  request that says what changed, why, and how it was tested.
- **Every decision is written down.** Each one is a dated row with its source in the
  [decision log](docs/process/decisions.md).
- **Nothing merges on red.** Format, types, unit tests, size limits and the end-to-end suite
  must pass on Chromium, Firefox and WebKit, on a tablet and on a phone.
- **Flaky tests are caught early.** New and changed tests run several times in CI before they
  can merge.

To follow one real change from brief to merge, read
[the lane walkthrough](docs/process/lane-walkthrough.md).

So far: 2,084 commits, 189 merged pull requests, 322 recorded decisions, and 7,399 unit and
1,843 end-to-end tests on every change (as of 11 November 2026).

## Contributing and licence

See [`CONTRIBUTING.md`](CONTRIBUTING.md) to get involved and [`SECURITY.md`](SECURITY.md) to
report a security issue. Recto is released under the [Apache-2.0](LICENSE) licence; bundled
components are listed in [`NOTICE`](NOTICE).
