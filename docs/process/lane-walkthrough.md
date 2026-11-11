# One lane, end to end (#193)

How work travels from the owner's yes to a merged pull request and a decision row, shown on one
real lane: the engine scheduling experiment, merged as
[#193](https://github.com/ErenDenizK/recto/pull/193) on 2026-11-11. The rules behind each step
are in [`agent-workflow.md`](agent-workflow.md), [`model-routing.md`](model-routing.md) and the
[charter](../company/charter.md).

## 1. The question

A performance audit found that PDFium renders a page in 18 to 48 ms, yet the app waited 270 to
470 ms for it: the time went to queueing in one worker, not to computing. The audit proposed
three remedies, and the owner approved the experiment.

## 2. The brief

The lead wrote a brief from [`brief-template.md`](brief-template.md): the goal and its done
condition, the role chosen from the routing matrix, the files the lane owns and must not touch,
the decision rows to cite and the commands that verify the work.

## 3. The build

A builder agent worked on `r33/engine-scheduling`, one commit per idea, so each can be measured
and reverted on its own: an engine split with no behaviour change
([`b1fbf788`](https://github.com/ErenDenizK/recto/commit/b1fbf7887962d5ef51d7dcd28362e9bad4c9b402)),
an early worker start with visible renders first
([`cbdbf7dd`](https://github.com/ErenDenizK/recto/commit/cbdbf7dda5519c18cd7ebcea32ce3abd604364df)),
and reads that make way for thumbnails
([`d8483fd1`](https://github.com/ErenDenizK/recto/commit/d8483fd115fc1e6a70289fb4b12e1c9c5a34c3f4)).
A second worker was built on a side branch, measured and not merged.

## 4. The review

A reviewer read the branch before the pull request opened and found four problems, all fixed in
one round ([`e1493509`](https://github.com/ErenDenizK/recto/commit/e14935092651b38f3ab9b68a991d2bfbb152079a)).
The most important: native compression could change which image encoding the Smaller save picks,
so it was taken out and a test now pins the encoders byte for byte.

## 5. CI

Two gates changed the work:

- **Size.** The early start added 1.4 KB to the first paint, over the 1 % cap. The gate is never
  raised to fit a change (PRC-11), so the start moved into a later chunk
  ([`c4261bda`](https://github.com/ErenDenizK/recto/commit/c4261bda93ffba75bc438264894841b375c2bce1)).
- **The phone on its side.** The landscape phone job failed: held reads starved the phone
  reader's text layers. The gate now queues reads behind a waiting render instead
  ([`ba446ec8`](https://github.com/ErenDenizK/recto/commit/ba446ec86e9e823390d4076dbec7ceef4342ade1)).

The next run passed all 46 checks
([run](https://github.com/ErenDenizK/recto/actions/runs/42946486294)): 7,399 unit and component
tests and 1,843 end-to-end tests on Chromium, Firefox, WebKit, a tablet and a phone.

## 6. The pull request

[#193](https://github.com/ErenDenizK/recto/pull/193) carries the body PRC-18 sets: What, Why,
How tested (paired measurements against `develop`, identical pixels), the review findings and
the decisions added. It was merged into `develop` with a merge commit
([`e0684843`](https://github.com/ErenDenizK/recto/commit/e06848434f24ce5408f08d85092654cd1187785a)).

## 7. The decision rows

Three rows in [`decisions/product.md`](decisions/product.md), indexed in
[`decisions.md`](decisions.md), record what was learned, including what was not kept:

| Row | Status | What it records |
|---|---|---|
| PF-24 | In force | the early start and the call gate; 300-page thumbnails from 2,360 to 1,680 ms |
| PF-25 | Tried, taken out | native compression: faster, but it could change the chosen encoding |
| PF-26 | Measured, not built | a second worker: 16 ms of zoom for 68 MB more memory |

A later lane with the same idea finds the numbers here before it spends a day on it. The lane's
cost and outcome go into [`agent-metrics.md`](agent-metrics.md), and anything it taught becomes
a row in [`lessons.md`](lessons.md) and a standing rule of the next brief.
