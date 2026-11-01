/**
 * The intent bar's parser (PRD-39, spec §2.2). Pure and synchronous: the typed text and the
 * document's facts go in, up to two readings (or a partial understanding, or nothing) come out.
 * Nothing here runs a command; every step carries the pages it resolved against the document as
 * it is, so the preview can show them before anything happens.
 *
 * text -> normalise -> tokenise -> clauses -> a sense per clause (lexicon, slots, suffix chains)
 * -> chains in run order with their problems -> score -> the top one or two.
 */
import {
  actionWords,
  chain,
  knownWord,
  plan,
  readClause,
  splitClauseOptions,
  type ClauseRead,
  type Sense,
} from './grammar';
import { COMPILED, DISPLAY, type Compiled } from './lexicon';
import { pick, type Scored } from './score';
import { readPages } from './ranges';
import { tokenise, type Tok } from './tokenise';
import { isLocativeAdjective, isNegator, oneStepApart } from './turkish';
import type { Action, IntentContext, ParseResult, Reading } from './types';

export type { IntentContext, ParseResult } from './types';

const MAX_COMBOS = 16;
const TYPO_WEIGHT = 0.75;
const MIN_TYPO_LENGTH = 5;

/** Actions that destroy something: a word of one is never reached by correcting a typo. */
const DESTRUCTIVE: ReadonlySet<Action> = new Set(['delete', 'redactFind', 'split']);
const wordsOf = (c: Compiled): string[] =>
  c.patterns.flatMap((p) => p.flatMap((u) => u.alts.map((a) => a.w)));
const DESTRUCTIVE_WORDS: ReadonlySet<string> = new Set(
  COMPILED.filter((c) => DESTRUCTIVE.has(c.entry.action)).flatMap(wordsOf),
);

/**
 * Plain action words of five letters or more (verb stems bare), for typo correction. Words of
 * a destructive action are left out: "remote 3" is not "remove 3", and a wrong guess there
 * costs pages (spec §2.5).
 */
const TYPO_WORDS: readonly string[] = [...new Set(COMPILED.flatMap(wordsOf))].filter(
  (w) => w.length >= MIN_TYPO_LENGTH && !w.startsWith('<') && !DESTRUCTIVE_WORDS.has(w),
);

/** A past tense or a plural is a statement, not an order: "döndü", "rotated", "turns". */
const PAST_TR = /(?:[dt][iu]|m[iu]s)(?:m|n|k|niz|ler|lar|im|sin|iz|siniz)?$/;
function inflected(typed: string, target: string): boolean {
  const ends = (suffix: string): boolean => typed.endsWith(suffix) && !target.endsWith(suffix);
  return ends('ed') || ends('ing') || ends('s') || (PAST_TR.test(typed) && !PAST_TR.test(target));
}

interface Interpreted {
  readonly result: ParseResult;
}

/** A page expression on its own is a jump: "42", "p 7", "7. sayfa", "last page". */
function bareJump(toks: readonly Tok[], ctx: IntentContext): Sense | null {
  const read = readPages(toks, ctx, true);
  const hasPageWord = toks.some(
    (t) => t.kind === 'word' && /^(?:p|pg|pgs|page|pages|sayfa)/.test(t.text),
  );
  if (read.kind !== 'ok' || !read.explicit || read.problem?.kind === 'ambiguous-count') return null;
  if (
    !(toks.length === 1 || hasPageWord) ||
    !toks.some((t) => t.kind === 'number' || t.kind === 'word')
  )
    return null;
  if (read.named !== 'list' && read.named !== 'edge') return null;
  if (read.pages.length > 1 || (read.pages.length === 0 && !read.problem)) return null;
  const page = read.pages[0] ?? read.problem?.page ?? 0;
  const first = toks[0] as Tok;
  const last = toks.at(-1) as Tok;
  return {
    action: 'goto',
    step: { action: 'goto', page },
    weight: 1,
    fit: 1,
    alwaysAsk: false,
    problem: read.problem,
    pagesFrom: 'none',
    span: [first.start, last.end],
  };
}

function interpret(tokens: readonly Tok[], original: string, ctx: IntentContext): Interpreted {
  const none: Interpreted = { result: { kind: 'none' } };
  if (tokens.some(isLocativeAdjective)) return none;
  const { idx, negated } = actionWords(tokens);
  if (negated || (idx.size > 0 && tokens.some(isNegator))) return none;
  const options = splitClauseOptions(tokens, idx).map((cuts) =>
    cuts.map((c) => readClause(c, original, ctx)),
  );
  if (options.some((clauses) => clauses.some((c) => c.negated))) return none;
  const viable = options.filter((clauses) => clauses.every((c) => c.senses.length > 0));
  if (viable.length === 0) {
    const clauses = options[0] as ClauseRead[];
    const failed = clauses.find((c) => c.senses.length === 0) as ClauseRead;
    if (clauses.length === 1) {
      const jump = bareJump(tokens, ctx);
      if (jump) return combine([[[jump]]], ctx);
    }
    const p = failed.partial;
    return p
      ? { result: { kind: 'partial', action: p.action, unknown: p.unknown.map((t) => t.raw) } }
      : none;
  }
  // The cut that gives the earlier clause the pages in front comes second from the grammar, and
  // reads first here: "rotate 3 and 5 delete 7" is rotate 3,5 first, then rotate 3 / delete 5,7.
  return combine(
    [...viable].reverse().map((clauses) => clauses.map((c) => c.senses)),
    ctx,
  );
}

/** Joins the clauses' senses into readings; with several ways to cut, all of them compete. */
function combine(
  ways: readonly (readonly (readonly Sense[])[])[],
  ctx: IntentContext,
): Interpreted {
  const scored: Scored[] = [];
  const seen = new Set<string>();
  for (const senses of ways) {
    let combos: Sense[][] = [[]];
    for (const choices of senses) {
      const next = combos.flatMap((c) => choices.map((s) => [...c, s]));
      combos = next
        .map((c) => ({ c, score: c.reduce((n, s) => n * s.weight * s.fit, 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_COMBOS)
        .map((x) => x.c);
    }
    for (const picks of combos) {
      const chained = chain(picks);
      const planned = chained && plan(chained, ctx);
      if (!chained || !planned) continue;
      const key = JSON.stringify(planned.steps);
      if (seen.has(key)) continue;
      seen.add(key);
      const reading: Reading = {
        steps: planned.steps,
        score: chained.score,
        problem: planned.problem,
        spans: planned.spans,
      };
      scored.push({ reading, ask: chained.ask });
    }
  }
  const readings = pick(scored);
  return { result: readings ? { kind: 'readings', readings } : { kind: 'none' } };
}

/** Words of five letters or more one step from an action word, swapped for it (spec §2.5). */
function correctTypos(
  tokens: readonly Tok[],
): { tokens: Tok[]; corrected: NonNullable<Reading['corrected']>[number][] } | null {
  const corrected: NonNullable<Reading['corrected']>[number][] = [];
  const out = tokens.map((t): Tok => {
    const f = t.text + t.suf;
    if (t.kind !== 'word' || f.length < MIN_TYPO_LENGTH || knownWord(t)) return t;
    const near = TYPO_WORDS.filter((w) => oneStepApart(f, w));
    if (near.length !== 1 || inflected(f, near[0] as string)) return t;
    const read = near[0] as string;
    corrected.push({ typed: t.raw, read, display: DISPLAY[read] ?? read });
    return { ...t, text: read, suf: '' };
  });
  return corrected.length > 0 ? { tokens: out, corrected } : null;
}

/** Reads a typed sentence against the open document (spec §2.2). */
export function parseIntent(text: string, ctx: IntentContext): ParseResult {
  const { tokens, original } = tokenise(text);
  if (tokens.length === 0) return { kind: 'none' };
  const first = interpret(tokens, original, ctx).result;
  if (first.kind !== 'none') return first;
  const fixed = correctTypos(tokens);
  if (!fixed) return first;
  const second = interpret(fixed.tokens, original, ctx).result;
  if (second.kind !== 'readings') return first;
  const factor = TYPO_WEIGHT ** fixed.corrected.length;
  const scale = (r: Reading): Reading => ({
    ...r,
    score: r.score * factor,
    corrected: fixed.corrected,
  });
  const [a, b] = second.readings;
  return { kind: 'readings', readings: b ? [scale(a), scale(b)] : [scale(a)] };
}
