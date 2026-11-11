# One lane, end to end: the engine scheduling lane (#193)

How a piece of work travels from the owner's yes to a merged pull request and a decision row,
told through one real lane: R33's engine scheduling experiment, merged as
[#193](https://github.com/ErenDenizK/recto/pull/193) on 2026-11-11. Every step links to the
record it left. The rules each step follows are in [`agent-workflow.md`](agent-workflow.md),
[`model-routing.md`](model-routing.md) and the [charter](../company/charter.md); this page only
shows them at work.

## The cast

| Who | Role in this lane | Where the role is defined |
|---|---|---|
| The owner | the board: approved the experiment from the performance audit | [charter](../company/charter.md), "Who decides" |
| The lead session | chief executive: wrote the brief, read the results, decided what to keep, merged | [charter](../company/charter.md), "The organisation" |
| Builder agents | built the brief, one commit per step, and every fix round | [`model-routing.md`](model-routing.md), routing matrix |
| A review | judge role: read the branch before the pull request opened | [`model-routing.md`](model-routing.md), Guards |
| CI | three browser engines, a tablet, a phone in both orientations, size gates | [`ci.yml`](../../.github/workflows/ci.yml) |

## 1. The question

R33's performance audit measured that PDFium renders a page in 18 to 48 ms while the app waited
270 to 470 ms for it. The time went to queueing in one serial worker, not to computing: the
sidebar of a 300-page document made 302 `listAnnotations` calls, and a scratch document's open
stood in the same queue ahead of the renders. The audit proposed three remedies (start the
engine early and let visible renders go first; native compression; a second, read-only PDFium
worker). The owner approved the experiment; PF-24 to PF-26 name that approval as their
source.

## 2. The brief

The lead wrote the brief in the shape of [`brief-template.md`](brief-template.md): the
objective and its done condition, the role and effort chosen from the routing matrix, the files
the lane owns and the files it must not touch, the decision rows to cite, the commands that
verify it, and the standing rules every brief carries, such as running heavy commands through
the shared lock and leaving no background process behind. Briefs are working papers of the
session and are not kept in the repository; what they asked for is visible in the pull request
body, which answers them item by item.

## 3. The build

The builder worked on branch `r33/engine-scheduling`, one commit per step, so each idea
can be read, measured and reverted on its own:

| Commit | Step |
|---|---|
| [`b1fbf788`](https://github.com/ErenDenizK/recto/commit/b1fbf7887962d5ef51d7dcd28362e9bad4c9b402) | split `engine-service.ts` (2,054 to 1,390 lines) along its seams, no behaviour change |
| [`049e515c`](https://github.com/ErenDenizK/recto/commit/049e515c0573caad7a616b12bb37e487b0a261d9) | native deflate in the image pass |
| [`cbdbf7dd`](https://github.com/ErenDenizK/recto/commit/cbdbf7dda5519c18cd7ebcea32ce3abd604364df) | pre-warm the worker and let page renders go first |
| [`d8483fd1`](https://github.com/ErenDenizK/recto/commit/d8483fd115fc1e6a70289fb4b12e1c9c5a34c3f4) | trickle reads and hold scratch writes while thumbnails render |
| [`4c26e43f`](https://github.com/ErenDenizK/recto/commit/4c26e43f578245b77852d1b4ba8245689d2923ba) | wrap a replaced renderer method afresh in the call gate |

The second worker was built and measured on a side branch and never merged; its numbers are
in PF-26.

## 4. The review

Before the pull request opened, the branch was reviewed in the judge role, as the routing
guards ask for a risky, multi-file engine lane. Its findings, all fixed in one round
([`e1493509`](https://github.com/ErenDenizK/recto/commit/e14935092651b38f3ab9b68a991d2bfbb152079a)):

- Native deflate could change the Smaller save's output, not only its speed: the image pass
  picks between a palette encoding, a JPEG and the original by size, and native zlib has no
  level setting and was far larger on some data. Taken out; a new test pins the encoders to
  fflate level 9 byte for byte.
- A read at the gate's cap polled a 1 ms timer; it now waits for a read to settle.
- The user's own writes could be held behind thumbnails; only a scratch document's are now.
- Ending a worker sent Comlink a release request that only the dying worker could answer,
  which left one call pending forever. `worker-terminate.test` fails before the fix and passes
  after.

## 5. CI

CI runs on every push to the branch. Three of its gates changed the work:

1. **The size gate.** The review round's push went red: the pre-warm started from `main.tsx`
   added 1.4 KB to the first paint, 1.8 % over the baseline against a 1 % cap
   ([`bundle-budget.ts`](../../tools/qa/bundle-budget.ts)). The gate is never raised to fit a
   change (PRC-11), so the start moved into the full edition's chunk
   ([`c4261bda`](https://github.com/ErenDenizK/recto/commit/c4261bda93ffba75bc438264894841b375c2bce1)),
   at a stated cost: a cold `?sample` link gains only from the gate, not from the early start.
2. **The phone on its side.** The next run passed on Chromium, Firefox, WebKit, the tablet and
   the portrait phone, and failed `phone-land`
   ([job](https://github.com/ErenDenizK/recto/actions/runs/42909131249/job/130165132893)): while a
   page render waited, the gate held or capped the reads, which starved the phone reader's text
   layers as it scrolled. The gate now posts reads behind a waiting render instead
   ([`ba446ec8`](https://github.com/ErenDenizK/recto/commit/ba446ec86e9e823390d4076dbec7ceef4342ade1)).
3. **The full matrix.** On that commit all 46 checks passed
   ([run](https://github.com/ErenDenizK/recto/actions/runs/42946486294)): 7,399 unit and component
   tests, and 1,843 end-to-end tests across Chromium, Firefox, WebKit, Chromium without a GPU,
   the tablet and the phone in both orientations.

## 6. The pull request

[#193](https://github.com/ErenDenizK/recto/pull/193) carries the body PRC-18 sets: **What** (the
four steps, each its own commit), **Why** (the audit's numbers), **How tested** (a table of paired
measurements against `develop`, interleaved builds, "pixels are identical in every build", the
e2e repeats), **After review** (the four findings and their fixes), **Screenshots** (none: no UI
change) and **Decisions added**. It was authored by the owner, as every commit is (PRC-17), and
merged into `develop` with a merge commit,
[`e0684843`](https://github.com/ErenDenizK/recto/commit/e06848434f24ce5408f08d85092654cd1187785a),
once every check was green.

## 7. The decision rows

Three rows in [`decisions/product.md`](decisions/product.md), each with its one-line entry in
the [index](decisions.md), record what was learned, including what was not kept:

| Row | Status | What it records |
|---|---|---|
| PF-24 | In force | the pre-warm and the call gate, the rules of what is held and for how long, and the measurements (300-page thumbnails 2,360 to 1,680 ms in the final run; pixels identical) |
| PF-25 | Tried, taken out | native deflate: faster, but it could change the chosen encoding, so the encoders stay at fflate level 9 |
| PF-26 | Measured, not built | the second read-only worker: identical pixels and 16 ms of zoom for 68 MB more memory; kept as a backlog row |

A later lane that thinks of the same ideas finds the numbers here before it spends a day on
them.

## 8. Afterwards

- The lead adds the lane's row to [`agent-metrics.md`](agent-metrics.md) (role, effort, tokens,
  minutes, first CI result, fix rounds, review findings) once its first CI run is known. The
  ledger's latest rows are R31's; R33's rows are still to be added.
- A failure that taught something becomes a row in [`lessons.md`](lessons.md) and, through
  [`brief-template.md`](brief-template.md), a standing rule of the next brief.
- The cycle's report goes to the owner in the HQ issue
  ([#26](https://github.com/ErenDenizK/recto/issues/26)).
