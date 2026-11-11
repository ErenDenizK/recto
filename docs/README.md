# Documentation

This folder has two parts: the product and engineering documents, which describe what Recto is
and how it is built, and a section on how the project is run, which is optional reading.

## The product and how it is built

| Document | What it gives you |
|---|---|
| [`README.md`](../README.md) | What Recto is and does, how to check its privacy claim, how it is built |
| [`VISION.md`](VISION.md) | Thesis, principles, non-goals |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Layering, the document model, the export pipeline, the editions, the workers |
| [`adr/README.md`](adr/README.md) | The architecture decision records |
| [`specs/`](specs/redesign.md) | What each feature does and how it is built; `redesign.md` is the plan of the current interface |
| [`design/redesign-2026-10/`](design/redesign-2026-10/language.md) | `language.md` is the design language (glass, light, motion, type); `quality-bar.md` is the bar every surface meets |
| [`brand/`](brand/) | Name, mark and voice |
| [`qa/`](qa/) | Manual checklists |
| [`research/`](research/) | Dated research snapshots; they describe what was known on their date, not how Recto works now |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Language, setup, commits, pull requests, code standards |

## How we work

Recto is directed by one maintainer who sets the product and the large technical decisions.
A layered team of AI agents builds it, in the open on GitHub. These documents show how that works.
You do not need them to use or contribute to Recto.

| Document | What it gives you |
|---|---|
| [`process/decisions.md`](process/decisions.md) | Every product and technical decision with its source (the index; full rows in `process/decisions/`). When it disagrees with an older document, the decision wins. |
| [`process/`](process/) | The workflow, how agents are briefed and routed, lessons learned and metrics; [one lane walked end to end](process/lane-walkthrough.md) |
| [`company/`](company/charter.md) | The charter, the roadmap and the epics: who decides what, and what comes next |
| [`../CLAUDE.md`](../CLAUDE.md) | The working rules the agents read first |

## Other folders

- `plan/v1/` and `ROADMAP.md`: earlier plans, kept in place because the decisions index cites
  them. Each opens with a "Superseded by" line.
- `family/`: notes on the maintainer's other products.
- `archive/`: finished and superseded documents under the paths they had before. Nothing there
  describes how Recto works today, and nothing new is written there. To retire a document, move
  it with `git mv` so history follows it, fix the links to it, and add a line to
  [`archive/README.md`](archive/README.md).
