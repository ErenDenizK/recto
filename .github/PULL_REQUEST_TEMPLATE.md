<!--
Title: a Conventional Commit, e.g. `feat(light-table): move pages across documents`.
Target branch: `develop` (milestone merges into `main` are done by maintainers).
-->

## What

<!-- The change in one or two sentences. Link the issue: "Closes #123". -->

## Why

<!-- The problem this solves: the owner brief item and the decision ids (docs/process/decisions.md). -->

## How tested

<!-- Unit, browser-mode, golden-file or end-to-end tests added or run; manual steps and
browsers used. -->

## Screenshots

<!-- Required for UI changes: before and after, keyboard focus states where relevant. -->

## Architecture

<!-- Link the ADR for any architectural change (docs/adr/), or write "None". -->

## Decisions

<!-- Rows added or superseded in docs/process/decisions/<area>.md (with their index line in decisions.md), or "None". -->

## Checklist

<!-- Delete the rows that do not apply (PRC-18). -->

- [ ] A Changeset is included (`pnpm changeset`), or this change is not user-visible.
- [ ] Format, lint, typecheck and the covering tests pass locally; CI runs the full matrix.
- [ ] Tests cover the changed behavior.
- [ ] Keyboard path, focus management and ARIA are handled for new controls.
