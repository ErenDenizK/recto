# Agent metrics (template)

One row per agent lane. Tokens are the harness's subagent totals (volume, cache reads included);
first CI is whether the PR's first CI run passed; fix rounds are pushes needed after that; stray is
files changed outside the brief's scope; review is the reviewer's blocking findings (— if none ran).

| Round | Lane | Kind | Model | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|---|
| | | taste / root cause / settled spec / research / read | | medium | | | | | | |

Compare kinds of work, not single lanes: a model keeps a kind of work while its first-CI rate, fix
rounds and stray edits stay at least as good as the baseline for the tokens it saves.
