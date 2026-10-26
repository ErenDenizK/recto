# Documentation

Start here. `docs/process/decisions.md` wins over every older document: when two documents
disagree, the decisions index is right and the other one is stale.

## Read these first

| Document | What it gives you |
|---|---|
| [`README.md`](../README.md) | What Recto is, what it does not do, how to check its privacy claims |
| [`CLAUDE.md`](../CLAUDE.md) | The map of the code and the working rules |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Language, setup, commits, pull requests, code standards |
| [`docs/process/decisions.md`](process/decisions.md) | Every owner and lead decision with its source (the index; full rows in `process/decisions/`) |
| [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | Layering, the document model, the export pipeline, the editions, the workers |
| [`docs/VISION.md`](VISION.md) | Thesis, principles, non-goals |
| [`docs/specs/redesign.md`](specs/redesign.md) | The build plan of the current interface |
| [`docs/design/redesign-2026-10/`](design/redesign-2026-10/language.md) | `language.md` is the design language (glass, light, motion, type); `quality-bar.md` is the bar Q-1 to Q-14 every surface meets |
| [`docs/company/roadmap.md`](company/roadmap.md) | The live plan |
| [`docs/adr/README.md`](adr/README.md) | The architecture decision records |

## The folders

- `adr/`: architecture decisions. `specs/`: what each feature does and how it is built.
- `design/`: the redesign, component specs and the sample document. `brand/`: name, mark and voice.
- `company/`: charter, roadmap and epics. `process/`: workflow, model routing, metrics, decisions.
- `qa/`: manual checklists. `research/`: dated research snapshots; they describe what was known
  on their date, not how Recto works now. `family/`: the owner's other products.
- `plan/v1/` and `ROADMAP.md`: earlier plans, kept in place because the decisions index cites them.
  Each opens with a "Superseded by" line.

## The archive

`archive/` holds finished and superseded documents under the same paths they had before. Nothing
there describes how Recto works today, and nothing new is written there. To retire a document, move it
with `git mv` so history follows it, fix the links to it, and add a line to
[`archive/README.md`](archive/README.md).
