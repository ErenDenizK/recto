/**
 * Copy check (docs/specs/presentation.md §1.3 and §8 "Links"; the brand plan's voice and tone,
 * docs/brand/README.md §7; docs/specs/redesign.md D0-13): the public copy and the app's
 * message catalogs must not use the banned words, phrases or structures, exclamation marks or
 * emoji, and the web app's source must not use the drawing and control shortcuts the M9
 * quality bar bans. Prints `file:line:column: problem` for every hit and exits 1 when there is
 * one.
 *
 *   node --experimental-strip-types tools/copy-check/check.ts [file or folder …]
 *
 * Without arguments it checks:
 *
 * - **Public copy:** README.md, the about page (`apps/web/about/**\/*.html`) and the
 *   release-notes template (`.github/release-notes.md`); a default input that does not exist
 *   yet is skipped. English pages get the English lists; a page under a `tr/` folder (the
 *   Turkish about page, brand plan §7) gets the Turkish ones. Only words a reader sees are
 *   checked: fenced code blocks (Mermaid diagrams excepted), inline code, HTML comments, URLs,
 *   tags, scripts and styles are blanked first, keeping the reader-facing attributes `alt`,
 *   `title`, `aria-label`, `content` and `placeholder`. The structures of brand plan §7 apply
 *   here: chains of em dashes, "It's not X, it's Y", three-word slogans, question headlines.
 * - **The message catalogs** (`apps/web/messages/en.json` and `tr.json`, "Copy-check clean in
 *   EN and TR"): every string a message can render, in its language's lists, with
 *   `{placeholders}` and code samples blanked. The palette's `*_keywords` messages are search
 *   synonyms nobody reads, so they are skipped; the few literal uses of a banned word are listed
 *   in CATALOG_EXEMPTIONS with the reason.
 * - **Source bans** under `apps/web/src/`: no `data:image/png` and no `url(…png)` in CSS
 *   (quality-bar.md Q-12: drawing is code), and no native `type="color"` or `type="range"`
 *   input outside `apps/web/src/ui/` (components/10-ink.md §7: one slider and one colour panel).
 *   D0-3 ported the last native colour inputs, so NATIVE_INPUTS_PENDING is empty: a new one
 *   fails, and so would a listed file that no longer had one.
 *
 * Matching is case-insensitive and on whole words, so "justify" and "insecure" pass. "secure"
 * passes only before a noun from SECURE_NOUNS, where it names a technical term ("secure
 * context") rather than making a claim.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/** Copy checked when no arguments are given, relative to the repository root. */
const DEFAULT_INPUTS = [
  'README.md',
  'apps/web/about',
  '.github/release-notes.md',
  'apps/web/messages/en.json',
  'apps/web/messages/tr.json',
];

/** The web app's source, for the source bans. */
const WEB_SOURCE = 'apps/web/src';
/** Where the native colour and range inputs may live: the primitives (10-ink §7). */
const PRIMITIVES = 'apps/web/src/ui/';

type Language = 'en' | 'tr';

/**
 * Presentation spec §1.3, with the obvious inflections, then brand plan §7: BR-V1 and the words
 * "expensive" invites. Hyphenated entries match as written.
 */
const BANNED_WORDS_EN = [
  // Presentation spec §1.3.
  'powerful',
  'blazing',
  'blazingly',
  'lightning',
  'seamless',
  'seamlessly',
  'effortless',
  'effortlessly',
  'simply',
  'just',
  'magic',
  'magical',
  'magically',
  'best-in-class',
  'enterprise-grade',
  'military-grade',
  'revolutionary',
  // Brand plan §7, BR-V1.
  'robust',
  'frictionless',
  'leverage',
  'leverages',
  'leveraging',
  'unlock',
  'unlocks',
  'unlocking',
  'supercharge',
  'supercharged',
  'supercharges',
  'next-generation',
  'next-gen',
  'cutting-edge',
  'game-changing',
  'game-changer',
  'groundbreaking',
  'innovative',
  'intuitive',
  'intuitively',
  'elegant',
  'elegantly',
  'world-class',
  'state-of-the-art',
  // Brand plan §7, invited by "expensive".
  'premium',
  'luxury',
  'luxurious',
  'sleek',
  'stunning',
  'beautiful',
  'beautifully',
  'gorgeous',
  'delightful',
  'smart',
  'ai-powered',
  'bank-grade',
] as const;

/** Presentation spec §1.3 and brand plan §7; any whitespace between the words. */
const BANNED_PHRASES_EN = [
  'the only',
  "we're excited",
  'we’re excited',
  'we are excited',
  '100% private',
  'completely secure',
  'your privacy matters to us',
  'trusted by',
] as const;

/**
 * Brand plan §7, Turkish. Turkish inflects with suffixes, so the adverbial forms are listed
 * with their stems; a prefix match would also catch innocent words ("güçlük", difficulty).
 */
const BANNED_WORDS_TR = [
  'güçlü',
  'sorunsuz',
  'sorunsuzca',
  'zahmetsiz',
  'zahmetsizce',
  'sihirli',
  'yenilikçi',
  'sezgisel',
  'kusursuz',
  'kusursuzca',
  'akıllı',
] as const;

const BANNED_PHRASES_TR = [
  'devrim niteliğinde',
  'son teknoloji',
  'en iyi',
  'gizliliğiniz bizim için önemli',
] as const;

const LISTS: Readonly<
  Record<Language, { readonly words: readonly string[]; readonly phrases: readonly string[] }>
> = {
  en: { words: BANNED_WORDS_EN, phrases: BANNED_PHRASES_EN },
  tr: { words: BANNED_WORDS_TR, phrases: BANNED_PHRASES_TR },
};

/** Nouns after which "secure" is a term of art, not a claim. Lower case. */
const SECURE_NOUNS = new Set(['context', 'contexts', 'origin', 'origins', 'hash', 'hashes']);

/**
 * Catalog messages that use a banned word literally, not as a claim. Keyed by catalog file
 * name and message key; each names the word it may use and why.
 */
const CATALOG_EXEMPTIONS: readonly {
  readonly file: string;
  readonly key: string;
  readonly word: string;
  readonly why: string;
}[] = [
  {
    file: 'tr.json',
    key: 'strength_strong',
    word: 'güçlü',
    why: 'the top step of the password strength meter ("strong"), the standard term',
  },
  {
    file: 'tr.json',
    key: 'batch_builtin_web_ready_desc',
    word: 'güçlü',
    why: 'how hard the recipe compresses ("compress strongly"), a setting, not a claim',
  },
  {
    file: 'tr.json',
    key: 'compare_align_best',
    word: 'en iyi',
    why: 'the name of the page-matching method ("Best match"), as in English',
  },
  {
    file: 'en.json',
    key: 'sheet_unlock',
    word: 'unlock',
    why: "the lock banner's action on a locked document (07-sheets §2.4), a verb on a lock, not a claim",
  },
  {
    file: 'en.json',
    key: 'guard_locked',
    word: 'unlock',
    why: 'the reason a dimmed item shows on a locked document, "Locked · unlock first" as 04-context §12 writes it (ADR-0030 §2.3), a verb on a lock, not a claim',
  },
  {
    file: 'en.json',
    key: 'frame_unlock',
    word: 'unlock',
    why: "the title menu's Lock switch action (01-frame F4), a verb on a lock, not a claim",
  },
  {
    file: 'en.json',
    key: 'frame_unlock_anyway',
    word: 'unlock',
    why: "the one-time warning's confirm before unlocking a signed or restricted file (01-frame F4), a verb on a lock, not a claim",
  },
  {
    file: 'en.json',
    key: 'frame_unlock_user_body',
    word: 'unlock',
    why: 'the Unlock popover on a document the user locked says how to undo the lock (D1-4a), a verb on a lock, not a claim',
  },
  {
    file: 'en.json',
    key: 'frame_unlock_default_body',
    word: 'unlock',
    why: 'the Unlock popover on a document opened locked by the setting says how to change it (D1-4a), a verb on a lock, not a claim',
  },
  {
    file: 'en.json',
    key: 'dock_locked_name',
    word: 'unlock',
    why: "the dock's Locked item names its action, Unlock… (01-frame F10), a verb on a lock, not a claim",
  },
  {
    file: 'en.json',
    key: 'pages_bar_unlock',
    word: 'unlock',
    why: "the locked document's reduced Pages bar offers Unlock (X21), a verb on a lock, not a claim",
  },
];

/**
 * Files under apps/web/src that may still render a native colour or range input. D0-3
 * (`ui/colour/`, `ui/Slider`, 10-ink §4 and §7) replaced every one, so the list is empty and
 * stays so; the check fails on a file that is not listed and on a listed file without one.
 */
const NATIVE_INPUTS_PENDING: readonly string[] = [];

/** Attributes whose values a reader sees (or a link preview shows). */
const VISIBLE_ATTRIBUTES =
  /\b(?:alt|title|aria-label|content|placeholder)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu;

/** Emoji drawn as pictures: presentation-default emoji, or any pictograph forced by U+FE0F. */
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu;

const WORD_CHAR = String.raw`[\p{L}\p{N}_-]`;

interface Problem {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

interface Hit {
  readonly offset: number;
  readonly message: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function wholeWord(source: string): RegExp {
  return new RegExp(`(?<!${WORD_CHAR})${source}(?!${WORD_CHAR})`, 'giu');
}

/** Spaces for every character except line breaks, so offsets and line numbers survive. */
function blank(text: string): string {
  return text.replace(/[^\n]/g, ' ');
}

/** A tag blanked except for the values of its reader-facing attributes. */
function blankTag(tag: string): string {
  let kept = blank(tag);
  for (const match of tag.matchAll(VISIBLE_ATTRIBUTES)) {
    const value = match[1] ?? match[2] ?? '';
    // The value ends just before the closing quote; offsets are UTF-16 code units throughout.
    const start = match.index + match[0].length - value.length - 1;
    kept = kept.slice(0, start) + value + kept.slice(start + value.length);
  }
  return kept;
}

function blankHtml(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, blank)
    .replace(/<[^>]*>/g, blankTag);
}

/** Blanks fenced code blocks, keeping the contents of Mermaid blocks (their labels are copy). */
function blankFences(text: string): string {
  let fence: { readonly marker: string; readonly keep: boolean } | undefined;
  return text
    .split('\n')
    .map((line) => {
      const opening = /^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(line);
      if (fence === undefined) {
        if (!opening) return line;
        fence = { marker: opening[1] ?? '```', keep: opening[2] === 'mermaid' };
        return blank(line);
      }
      const closing = /^\s{0,3}(`{3,}|~{3,})\s*$/.exec(line);
      if (closing && (closing[1] ?? '').startsWith(fence.marker)) {
        fence = undefined;
        return blank(line);
      }
      return fence.keep ? line : blank(line);
    })
    .join('\n');
}

function blankMarkdown(text: string): string {
  const withoutBlocks = blankFences(text.replace(/<!--[\s\S]*?-->/g, blank));
  return blankHtml(withoutBlocks.replace(/(`+)[^`]*?\1/g, blank))
    .replace(/\]\([^)]*\)/g, (target) => `]${blank(target.slice(1))}`)
    .replace(/\bhttps?:\/\/[^\s)\]>]+/g, blank)
    .replace(/!\[/g, ' [');
}

/** A message string as a reader sees it: placeholders, code samples and markup blanked. */
function blankMessage(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<[^>]*>/g, blank)
    .replace(/\{[^{}]*\}/g, blank);
}

function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
}

/** The banned words and phrases of `language`, "secure" alone, "!" and emoji. */
function wordHits(text: string, language: Language): Hit[] {
  const hits: Hit[] = [];
  const { words, phrases } = LISTS[language];
  for (const word of words) {
    for (const match of text.matchAll(wholeWord(escapeRegExp(word)))) {
      hits.push({ offset: match.index, message: `banned word "${match[0]}"` });
    }
  }
  for (const phrase of phrases) {
    const source = phrase.split(' ').map(escapeRegExp).join(String.raw`\s+`);
    for (const match of text.matchAll(wholeWord(source))) {
      hits.push({
        offset: match.index,
        message: `banned phrase "${match[0].replace(/\s+/g, ' ')}"`,
      });
    }
  }
  if (language === 'en') {
    for (const match of text.matchAll(wholeWord('secure'))) {
      const next = /^\s+([\p{L}-]+)/u.exec(text.slice(match.index + match[0].length));
      if (next?.[1] && SECURE_NOUNS.has(next[1].toLowerCase())) continue;
      hits.push({
        offset: match.index,
        message: `"${match[0]}" on its own (allowed before: ${[...SECURE_NOUNS].join(', ')})`,
      });
    }
  }
  for (const match of text.matchAll(/!/g)) {
    hits.push({ offset: match.index, message: 'exclamation mark' });
  }
  for (const match of text.matchAll(EMOJI)) {
    hits.push({ offset: match.index, message: `emoji "${match[0]}"` });
  }
  return hits;
}

/**
 * Brand plan §7's banned structures, in public copy: chains of em dashes (three or more in one
 * sentence; a parenthetical pair is fine), "It's not X, it's Y", three-word slogans ("Fast.
 * Private. Free."). `text` is already blanked.
 */
function structureHits(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const sentence of text.matchAll(/[^.?!\n]+/g)) {
    const dashes = [...sentence[0].matchAll(/—/g)];
    if (dashes.length >= 3) {
      hits.push({ offset: sentence.index, message: `a chain of ${dashes.length} em dashes` });
    }
  }
  const notButIs = /(?<![\p{L}])it[’']?s\s+not\s+[^.;:?\n]{1,80}?,\s*it[’']?s\s/giu;
  for (const match of text.matchAll(notButIs)) {
    hits.push({ offset: match.index, message: `"It's not X, it's Y"` });
  }
  const slogan = /(?<![\p{L}\p{N}])(?:\p{Lu}[\p{L}-]*\.\s+){2}\p{Lu}[\p{L}-]*\./gu;
  for (const match of text.matchAll(slogan)) {
    hits.push({ offset: match.index, message: `three-word slogan "${match[0]}"` });
  }
  return hits;
}

/** Question headlines (brand plan §7), found on the original text: Markdown and HTML headings. */
function headlineHits(original: string, html: boolean): Hit[] {
  const hits: Hit[] = [];
  const pattern = html
    ? /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/giu
    : /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/gmu;
  for (const match of original.matchAll(pattern)) {
    const heading = (match[1] ?? '').replace(/<[^>]*>/g, '').trim();
    if (heading.endsWith('?')) {
      hits.push({ offset: match.index, message: `question as a headline "${heading}"` });
    }
  }
  return hits;
}

/** Turkish for files under a `tr` folder or named `tr.*`; English otherwise. */
function languageOf(file: string): Language {
  const parts = file.split(sep);
  return parts.includes('tr') || basename(file).startsWith('tr.') ? 'tr' : 'en';
}

function toProblems(file: string, text: string, hits: readonly Hit[]): Problem[] {
  return [...hits]
    .sort((a, b) => a.offset - b.offset)
    .map(({ offset, message }) => ({ file, ...position(text, offset), message }));
}

function checkPage(file: string, original: string): Problem[] {
  const html = extname(file) === '.html';
  const text = html ? blankHtml(original) : blankMarkdown(original);
  const hits = [
    ...wordHits(text, languageOf(file)),
    ...structureHits(text),
    ...headlineHits(original, html),
  ];
  return toProblems(file, original, hits);
}

/** Every string a message can render: the value, or each variant of its `match`. */
function messageStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(messageStrings);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) =>
      key === 'declarations' || key === 'selectors' ? [] : messageStrings(inner),
    );
  }
  return [];
}

function checkCatalog(file: string, original: string): Problem[] {
  const language = languageOf(file);
  const name = basename(file);
  const catalog = JSON.parse(original) as Record<string, unknown>;
  const problems: Problem[] = [];
  for (const [key, value] of Object.entries(catalog)) {
    if (key === '$schema' || key.endsWith('_keywords')) continue;
    const at = original.indexOf(`"${key}":`);
    const where = position(original, Math.max(0, at));
    const exempt = CATALOG_EXEMPTIONS.filter((e) => e.file === name && e.key === key).map((e) =>
      e.word.toLowerCase(),
    );
    for (const text of messageStrings(value)) {
      for (const hit of wordHits(blankMessage(text), language)) {
        const word = /"([^"]+)"/.exec(hit.message)?.[1]?.toLowerCase().replace(/\s+/g, ' ');
        if (word !== undefined && exempt.includes(word)) continue;
        problems.push({ file, ...where, message: `${key}: ${hit.message}` });
      }
    }
  }
  for (const exemption of CATALOG_EXEMPTIONS.filter((e) => e.file === name)) {
    const strings = messageStrings(catalog[exemption.key]).join('\n').toLowerCase();
    if (!strings.includes(exemption.word)) {
      problems.push({
        file,
        line: 1,
        column: 1,
        message: `CATALOG_EXEMPTIONS lists ${exemption.key} for "${exemption.word}", which it no longer uses: remove the entry`,
      });
    }
  }
  return problems;
}

function checkFile(file: string, original: string): Problem[] {
  return extname(file) === '.json' ? checkCatalog(file, original) : checkPage(file, original);
}

/** Files under `path` (or `path` itself) with one of `extensions`, sorted. */
function collect(path: string, extensions: readonly string[]): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { recursive: true, encoding: 'utf8' })
    .filter((name) => extensions.includes(extname(name)))
    .filter((name) => !name.split(sep).includes('node_modules'))
    .map((name) => join(path, name))
    .sort();
}

/** `\n`-separated text with CSS comments blanked (offsets kept). */
function blankCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, blank);
}

/** Quality-bar Q-12 and 10-ink §7 over the web app's source. */
function checkSource(): Problem[] {
  const root = resolve(ROOT, WEB_SOURCE);
  if (!existsSync(root)) return [];
  const problems: Problem[] = [];

  for (const file of collect(root, ['.css'])) {
    const shown = relative(ROOT, file);
    const original = readFileSync(file, 'utf8');
    const css = blankCssComments(original);
    const hits: Hit[] = [];
    for (const match of css.matchAll(/data:image\/png/giu)) {
      hits.push({ offset: match.index, message: 'inline PNG (quality-bar Q-12: drawing is code)' });
    }
    for (const match of css.matchAll(/url\(\s*['"]?[^)'"]*\.png\b/giu)) {
      hits.push({
        offset: match.index,
        message: 'PNG background (quality-bar Q-12: drawing is code)',
      });
    }
    problems.push(...toProblems(shown, original, hits));
  }

  const nativeInput =
    /\btype\s*(?:=\s*\{?\s*|:\s*)['"](color|range)['"]|\.type\s*=\s*['"](color|range)['"]/gu;
  const offending = new Set<string>();
  for (const file of collect(root, ['.ts', '.tsx'])) {
    const shown = relative(ROOT, file).split(sep).join('/');
    if (shown.startsWith(PRIMITIVES) || /\.test\.tsx?$/.test(shown)) continue;
    if (shown.includes('/i18n/paraglide/')) continue;
    const original = readFileSync(file, 'utf8');
    const hits: Hit[] = [];
    for (const match of original.matchAll(nativeInput)) {
      const kind = match[1] ?? match[2];
      hits.push({
        offset: match.index,
        message: `native type="${kind}" input outside ${PRIMITIVES} (10-ink §7: use the ui/ primitive)`,
      });
    }
    if (hits.length === 0) continue;
    offending.add(shown);
    if (!NATIVE_INPUTS_PENDING.includes(shown)) problems.push(...toProblems(shown, original, hits));
  }
  for (const listed of NATIVE_INPUTS_PENDING) {
    if (!offending.has(listed)) {
      problems.push({
        file: listed,
        line: 1,
        column: 1,
        message:
          'NATIVE_INPUTS_PENDING lists this file, which has no native colour or range input any more: remove the entry',
      });
    }
  }
  return problems;
}

function main(args: readonly string[]): number {
  const explicit = args.length > 0;
  const inputs = explicit
    ? args.map((arg) => resolve(arg))
    : DEFAULT_INPUTS.map((input) => resolve(ROOT, input));
  const files: string[] = [];
  for (const input of inputs) {
    const shown = relative(ROOT, input);
    if (existsSync(input)) files.push(...collect(input, ['.md', '.html', '.json']));
    else if (explicit) {
      console.error(`${shown}: not found`);
      return 2;
    } else process.stdout.write(`${shown}: not there yet, skipped\n`);
  }

  const problems = [
    ...files.flatMap((file) => checkFile(relative(ROOT, file), readFileSync(file, 'utf8'))),
    // The source bans are a repository rule, not copy: they run with the default inputs.
    ...(explicit ? [] : checkSource()),
  ];
  for (const problem of problems) {
    console.error(`${problem.file}:${problem.line}:${problem.column}: ${problem.message}`);
  }
  if (problems.length > 0) {
    console.error(
      `\n${problems.length} problem(s) (docs/specs/presentation.md §1.3, docs/brand/README.md §7, quality-bar.md Q-12, 10-ink.md §7).`,
    );
    return 1;
  }
  process.stdout.write(
    `Copy check passed: ${files.map((file) => relative(ROOT, file)).join(', ')}${
      explicit ? '' : `; source bans clean in ${WEB_SOURCE}`
    }\n`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
