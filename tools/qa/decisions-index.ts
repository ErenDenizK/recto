/**
 * Keeps the decisions index and its area files in step (brief C-9, plan item D2).
 * `docs/process/decisions.md` lists every decision once, as `| [ID](decisions/<area>.md) | … |`;
 * the full rows live in `docs/process/decisions/<area>.md` as `| ID | … |`. Fails when an id is
 * in one place and not the other, when an id appears twice, or when an index entry points at
 * the wrong area file.
 *
 *   node --experimental-strip-types tools/qa/decisions-index.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../docs/process/', import.meta.url));
const problems: string[] = [];
/** Id to the file it was first found in, across all files, for messages. */
const placed = new Map<string, string>();

/** Collects id to area file; a repeat is a problem. Group 1 is the id, group 2 the area file. */
function collect(file: string, pattern: RegExp, into: Map<string, string>): void {
  const seen = new Map<string, string>();
  for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
    const match = pattern.exec(line);
    if (!match) continue;
    const id = match[1] ?? '';
    if (seen.has(id)) problems.push(`${id} appears twice in ${file}`);
    else if (into.has(id)) problems.push(`${id} appears twice (${placed.get(id)} and ${file})`);
    else into.set(id, match[2] ?? file);
    seen.set(id, file);
    placed.set(id, file);
  }
}

const index = new Map<string, string>();
collect('decisions.md', /^\| \[([A-Z]+-\d+[a-z]?)\]\(decisions\/([\w-]+\.md)\) \|/, index);

const rows = new Map<string, string>();
for (const file of readdirSync(join(dir, 'decisions')).filter((f) => f.endsWith('.md'))) {
  collect(`decisions/${file}`, /^\| ([A-Z]+-\d+[a-z]?) \|/, rows);
}

for (const [id, file] of rows) {
  const entry = index.get(id);
  if (entry === undefined) problems.push(`${id} is in ${file} but not in the index`);
  else if (`decisions/${entry}` !== file) {
    problems.push(`${id}: the index points at ${entry}, the row is in ${file}`);
  }
}
for (const id of index.keys()) {
  if (!rows.has(id)) problems.push(`${id} is in the index but in no area file`);
}

if (problems.length > 0) {
  console.error(`decisions index: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`decisions index: ${rows.size} rows, all indexed once`);
