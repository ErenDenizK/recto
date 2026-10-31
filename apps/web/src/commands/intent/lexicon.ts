/**
 * The intent bar's lexicon as data (PRD-39, spec §2.5): one array, both languages, always active
 * whatever the UI language (as catalog keywords are). It is grammar data, not display copy, so it
 * is not in the message catalogs.
 *
 * A pattern is folded words separated by spaces; a unit may end in `~` (a Turkish noun: stem plus
 * an allowed suffix chain), `+` (a Turkish verb: stem plus a verb ending, negation rejected) or
 * `?` (optional), and `a|b` offers alternatives. `<img>`, `<txt>`, `<off>` and `<size>` match a
 * file type or a size on its own. An entry reads a clause when one of its patterns matches and
 * every other word is a filler or something its slots take; all its pattern words in the clause
 * are the action word.
 */
import type { Action } from './types';
import { formatOf } from './targets';
import type { Tok } from './tokenise';
import { isNoun, verbOf, type VerbMatch } from './turkish';

export type Slot =
  | 'pages'
  | 'page'
  | 'degrees'
  | 'direction'
  | 'relation'
  | 'size'
  | 'format'
  | 'patterns'
  | 'text'
  | 'every'
  | 'parts'
  | 'language';

export interface LexEntry {
  readonly action: Action;
  readonly lang: 'en' | 'tr';
  /** Folded patterns (see above); phrases match before single words. */
  readonly words: readonly string[];
  /** Words that go with the action and mean nothing alone ("ile imzala" after "e-imza"). */
  readonly support?: readonly string[];
  /**
   * Turkish puts the verb last with the pages between ("imzamı 2. sayfaya koy"): when set, the
   * entry reads only if one of these verbs is in the clause as well as one of its `words`.
   */
  readonly verbs?: readonly string[];
  /** 1 for the primary sense; 0.8 for a second sense of a shared word (çıkar -> extract). */
  readonly weight: number;
  /** Slots the action takes; any other token rejects this sense. */
  readonly slots: readonly Slot[];
  /** At least one of these slots must come from the text (a bare "çevir" is nothing). */
  readonly needs?: readonly Slot[];
  /** Accepts object words (`pdf'i`, `dosyayı`, `the file`). */
  readonly object?: boolean;
  /** What the action does with no pages named. */
  readonly pagesDefault?: 'selection-or-current' | 'selection-or-none' | 'current' | 'all' | 'none';
  /** Show the second reading even when its score is far below (a known two-way word). */
  readonly alwaysAsk?: boolean;
  /** A folk phrase: scores 0.95. */
  readonly folk?: boolean;
  /** Fixed by the words themselves ("ters çevir" is a half turn; "sayfalara ayır" is every 1). */
  readonly fix?: { readonly turns?: 2; readonly every?: number };
}

type Extra = Omit<LexEntry, 'action' | 'lang' | 'words' | 'weight' | 'slots'> & {
  readonly weight?: number;
  readonly slots?: readonly Slot[];
};
const e = (
  action: Action,
  lang: 'en' | 'tr',
  words: readonly string[],
  extra: Extra = {},
): LexEntry => ({
  action,
  lang,
  words,
  weight: 1,
  slots: [],
  ...extra,
});
/** The same action in both languages with the same slots: an English and a Turkish entry. */
const both = (
  action: Action,
  en: readonly string[],
  tr: readonly string[],
  extra: Extra = {},
): LexEntry[] => [e(action, 'en', en, extra), e(action, 'tr', tr, extra)];

/** Verbs that mean "save it as ..." (a format or a conversion needs one, or stands alone). */
const CONVERT_EN = ['save', 'export', 'convert', 'download', 'save a copy'];
const CONVERT_TR = ['kaydet+|kayded+', 'cevir+', 'donustur+', 'yap+', 'indir+'];
const SELECT = 'selection-or-current' as const;
const OR_NONE = 'selection-or-none' as const;
const TURN: Extra = { slots: ['pages', 'degrees', 'direction'], pagesDefault: SELECT };
const FORMAT: Extra = { slots: ['format'], needs: ['format'], object: true };
const EVERY_PAGE: Extra = { object: true, folk: true, fix: { every: 1 } };

export const LEXICON: readonly LexEntry[] = [
  // navigate: the rest of the clause is the page, the heading, the file or the text to find
  ...both('goto', ['go to', 'goto', 'jump to', 'go', 'jump', 'show'], ['git+|gid+', 'ac+'], {
    slots: ['page'],
  }),
  ...both('heading', ['go to', 'goto', 'jump to', 'show section'], ['git+|gid+'], {
    slots: ['text'],
  }),
  ...both('recent', ['open'], ['ac+'], { slots: ['text'] }),
  ...both('find', ['find', 'search for', 'search', 'look for'], ['bul+', 'ara+'], {
    slots: ['text'],
  }),
  // document steps
  ...both('rotate', ['rotate'], ['dondur+'], TURN),
  ...both('rotate', ['turn'], ['cevir+'], { ...TURN, needs: ['pages', 'degrees', 'direction'] }),
  e('rotate', 'tr', ['ters cevir+'], {
    weight: 0.8,
    slots: ['pages'],
    pagesDefault: 'all',
    alwaysAsk: true,
    fix: { turns: 2 },
  }),
  ...both('delete', ['delete', 'remove', 'del', 'drop', 'get rid of'], ['sil+', 'kaldir+'], {
    slots: ['pages'],
    pagesDefault: OR_NONE,
  }),
  e('delete', 'tr', ['cikar+'], { slots: ['pages'], pagesDefault: OR_NONE, alwaysAsk: true }),
  ...both('duplicate', ['duplicate', 'copy', 'clone'], ['cogalt+', 'kopyala+'], {
    slots: ['pages'],
    pagesDefault: OR_NONE,
  }),
  ...both('move', ['move', 'put'], ['tasi+', 'koy+'], {
    slots: ['pages', 'relation'],
    needs: ['relation'],
    pagesDefault: OR_NONE,
  }),
  e('reverse', 'en', ['reverse', 'flip order'], {
    support: ['order'],
    slots: ['pages'],
    pagesDefault: 'all',
  }),
  e('reverse', 'tr', ['sira~ ters cevir+', 'ters sirala+', 'tersten sirala+', 'ters cevir+'], {
    slots: ['pages'],
    pagesDefault: 'all',
    alwaysAsk: true,
  }),
  ...both('split', ['split', 'divide', 'break up', 'cut into'], ['bol+', 'ayir+', 'parcala+'], {
    slots: ['every', 'parts'],
    object: true,
  }),
  ...both(
    'split',
    ['split into pages', 'split pdf into pages', 'split every page'],
    ['sayfa~ bol+|ayir+|parcala+'],
    EVERY_PAGE,
  ),
  ...both(
    'pageNumbers',
    [
      'add page numbers',
      'insert page numbers',
      'put page numbers',
      'number the pages',
      'number pages',
      'paginate',
    ],
    ['numarala+'],
    { slots: ['pages'], pagesDefault: 'all' },
  ),
  e('pageNumbers', 'tr', ['numara~'], {
    verbs: ['ekle+', 'koy+', 'ver+', 'at+'],
    slots: ['pages'],
    pagesDefault: 'all',
  }),
  e('watermark', 'en', ['add watermark', 'put watermark', 'insert watermark', 'watermark'], {
    slots: ['text', 'pages'],
    pagesDefault: 'all',
  }),
  e('watermark', 'tr', ['filigran~'], {
    verbs: ['ekle+', 'koy+', 'at+', 'yap+', 'ver+'],
    slots: ['text', 'pages'],
    pagesDefault: 'all',
  }),
  // handoffs
  ...both(
    'extract',
    ['extract', 'pull out'],
    [
      'ayikla+',
      'ayri bir? dosya~ olarak? cikar+|kaydet+|kayded+',
      'yeni bir? belge~|dosya~ cikar+|al+|kaydet+|kayded+',
    ],
    { slots: ['pages'], pagesDefault: OR_NONE },
  ),
  e('extract', 'tr', ['cikar+'], {
    weight: 0.8,
    slots: ['pages'],
    pagesDefault: OR_NONE,
    alwaysAsk: true,
  }),
  e('combine', 'en', ['combine', 'merge', 'join'], { support: ['all', 'open'], object: true }),
  e('combine', 'tr', ['birlestir+'], { support: ['tum~', 'acik'], object: true }),
  e('signPlace', 'en', ['sign', 'put my signature', 'add my signature', 'place my signature'], {
    support: ['here'],
    slots: ['page'],
    pagesDefault: 'current',
    alwaysAsk: true,
    object: true,
  }),
  e('signPlace', 'tr', ['imzala+'], {
    support: ['burada'],
    slots: ['page'],
    pagesDefault: 'current',
    alwaysAsk: true,
    object: true,
  }),
  e('signPlace', 'tr', ['imza~'], {
    verbs: ['at+', 'koy+', 'ekle+', 'yerlestir+', 'bas+'],
    slots: ['page'],
    pagesDefault: 'current',
  }),
  e(
    'certify',
    'en',
    ['digitally sign', 'sign with certificate', 'certificate', 'e-sign', 'esign'],
    { support: ['sign', 'with', 'a', 'my'], object: true },
  ),
  e('certify', 'tr', ['e-imza~', 'dijital imza~', 'elektronik imza~', 'sertifika~'], {
    support: ['imzala+', 'ile', 'imza~'],
    object: true,
  }),
  ...both('certify', ['sign'], ['imzala+'], { weight: 0.8, alwaysAsk: true, object: true }),
  e('redactFind', 'en', ['redact', 'black out', 'censor', 'mask', 'hide'], {
    support: ['information', 'info', 'data', 'details', 'numbers', 'number'],
    slots: ['patterns'],
    needs: ['patterns'],
    object: true,
  }),
  e('redactFind', 'tr', ['karart+', 'sansurle+', 'gizle+', 'maskele+'], {
    support: ['bilgi~', 'veri~', 'numara~'],
    slots: ['patterns'],
    needs: ['patterns'],
    object: true,
  }),
  ...both(
    'ocr',
    ['ocr', 'recognize text', 'recognise text', 'make searchable', 'make it searchable'],
    [
      'ocr~ yap+?',
      'metin~|metn~ tani+',
      'aranabilir yap+',
      'tarama~ metin~|metn~ cevir+',
      'taranmis sayfa~? metin~|metn~ cevir+',
    ],
    { slots: ['pages'], pagesDefault: 'all', object: true },
  ),
  e(
    'password',
    'en',
    [
      'password',
      'add a password',
      'add password',
      'set a password',
      'set password',
      'put a password',
      'password protect',
      'protect with a password',
      'protect with password',
      'lock with a password',
      'lock with password',
      'encrypt',
      'protect',
    ],
    { object: true },
  ),
  e('password', 'tr', ['sifrele+', 'parola ile koru+'], { object: true }),
  e('password', 'tr', ['sifre~|parola~'], {
    verbs: ['koy+', 'ekle+', 'ver+', 'belirle+', 'ayarla+'],
    object: true,
  }),
  ...both(
    'fill',
    ['fill in the form', 'fill the form', 'fill out', 'fill in', 'fill'],
    ['form~ doldur+', 'doldur+'],
    { object: true },
  ),
  // outputs
  e(
    'compress',
    'en',
    [
      'compress',
      'shrink',
      'make smaller',
      'make it smaller',
      'make the file smaller',
      'make pdf smaller',
      'reduce size',
      'reduce file size',
      'reduce',
      'optimize',
      '<size>',
    ],
    { slots: ['size'], object: true },
  ),
  e(
    'compress',
    'tr',
    ['sikistir+', 'kucult+', 'hafiflet+', 'boyut~ azalt+|kucult+|dusur+', 'kucuk yap+', '<size>'],
    { support: ['olsun', 'olacak'], slots: ['size'], object: true },
  ),
  e('exportImages', 'en', ['<img>', ...CONVERT_EN], {
    ...FORMAT,
    slots: ['format', 'pages'],
    pagesDefault: 'all',
  }),
  e('exportImages', 'tr', ['<img>', ...CONVERT_TR], {
    ...FORMAT,
    slots: ['format', 'pages'],
    pagesDefault: 'all',
  }),
  e('exportText', 'en', ['<txt>', ...CONVERT_EN], FORMAT),
  e('exportText', 'tr', ['<txt>', ...CONVERT_TR], FORMAT),
  e('saveCopy', 'en', ['save a copy', 'save copy', 'save as', 'export', 'download'], {
    object: true,
  }),
  e(
    'saveCopy',
    'tr',
    ['kopya~ kaydet+|kayded+', 'farkli kaydet+|kayded+', 'indir+', 'disa aktar+'],
    { object: true },
  ),
  ...both('print', ['print'], ['yazdir+'], { object: true }),
  // conversions Recto does not do, and the one it does behind a flag
  e('unavailable', 'en', ['<off>', ...CONVERT_EN], FORMAT),
  e('unavailable', 'tr', ['<off>', ...CONVERT_TR], FORMAT),
  e('unavailable', 'en', ['translate'], { slots: ['language'], object: true }),
  e('unavailable', 'tr', ['cevir+', 'donustur+', 'tercume~ et+'], {
    slots: ['language'],
    needs: ['language'],
    object: true,
  }),
  e('officeToPdf', 'en', ['<off>', ...CONVERT_EN], { ...FORMAT, weight: 0.8, alwaysAsk: true }),
  e('officeToPdf', 'tr', ['<off>', ...CONVERT_TR], { ...FORMAT, weight: 0.8, alwaysAsk: true }),
];

/**
 * Fillers (spec §2.5): a closed list with no nouns, so "3. sayfadaki tabloyu sil" can never lose
 * a word to it. `lexicon.test.ts` holds this line. `olarak`, `as`, `into` (only with a format),
 * `istiyorum`, `rica` and the question particles (only after a verb) are conditional and live
 * in `grammar.ts`.
 */
export const FILLERS: ReadonlySet<string> = new Set(
  'please lutfen nolur the only from in on of a an to for me benim bana sunu su can you could would i want like need hemen simdi now numarali numbered'.split(
    ' ',
  ),
);

// ------------------------------------------------------------------------------- display

/**
 * The properly spelled form of the Turkish action words a typo can be corrected to (the words
 * are folded above: `dondur`). A word that spells the same folded and plain (English, `yazdir`'s
 * neighbours like `kopyala`) is not listed. `Reading.corrected.display` is built from this.
 */
export const DISPLAY: Readonly<Record<string, string>> = {
  dondur: 'döndür',
  cevir: 'çevir',
  cogalt: 'çoğalt',
  sirala: 'sırala',
  ayikla: 'ayıkla',
  birlestir: 'birleştir',
  taranmis: 'taranmış',
  sifrele: 'şifrele',
  sifre: 'şifre',
  sikistir: 'sıkıştır',
  kucult: 'küçült',
  kucuk: 'küçük',
  dusur: 'düşür',
  donustur: 'dönüştür',
  farkli: 'farklı',
  yazdir: 'yazdır',
  tercume: 'tercüme',
};

// --------------------------------------------------------------------------- compiled units

interface Alt {
  readonly w: string;
  readonly k: 'x' | 'n' | 'v';
}
export interface Unit {
  readonly alts: readonly Alt[];
  readonly opt: boolean;
}
export interface PatternHit {
  readonly negated: boolean;
  readonly aorist: boolean;
}

function compileUnit(source: string): Unit {
  const opt = source.endsWith('?');
  const alts = (opt ? source.slice(0, -1) : source).split('|').map((a): Alt => {
    const k = a.endsWith('~') ? 'n' : a.endsWith('+') ? 'v' : 'x';
    return { w: k === 'x' ? a : a.slice(0, -1), k };
  });
  return { alts, opt };
}
export const compile = (pattern: string): Unit[] => pattern.split(' ').map(compileUnit);

/** Does one word token fit one unit? */
function unitHit(unit: Unit, t: Tok): { neg: boolean; aor: boolean } | null {
  for (const { w, k } of unit.alts) {
    if (k === 'x' && w.startsWith('<')) {
      const f = t.kind === 'size' ? null : formatOf(t);
      const ok =
        w === '<size>'
          ? t.kind === 'size'
          : w === '<img>'
            ? f?.kind === 'img' && !f.generic
            : w === '<txt>'
              ? f?.kind === 'txt' && !f.generic
              : f?.kind === 'off';
      if (ok) return { neg: false, aor: false };
    } else if (t.kind === 'word') {
      if (k === 'x' && t.text + t.suf === w) return { neg: false, aor: false };
      if (k === 'n' && isNoun(t, w)) return { neg: false, aor: false };
      if (k === 'v') {
        const v: VerbMatch | null = verbOf(t, w);
        if (v) return { neg: v.negated, aor: v.form === 'aor' };
      }
    }
  }
  return null;
}

/** Tries a compiled pattern at `at`: how many tokens it took, or null. */
export function matchPattern(
  units: readonly Unit[],
  toks: readonly Tok[],
  at: number,
): (PatternHit & { len: number }) | null {
  let i = at;
  let negated = false;
  let aorist = false;
  let matched = 0;
  for (const unit of units) {
    const t = toks[i];
    const hit = t ? unitHit(unit, t) : null;
    if (!hit) {
      if (unit.opt) continue;
      return null;
    }
    negated ||= hit.neg;
    aorist ||= hit.aor;
    matched++;
    i++;
  }
  return matched === 0 ? null : { len: i - at, negated, aorist };
}

export interface Compiled {
  readonly entry: LexEntry;
  readonly patterns: readonly (readonly Unit[])[];
  readonly support: readonly (readonly Unit[])[];
  readonly verbs: readonly (readonly Unit[])[];
}
export const COMPILED: readonly Compiled[] = LEXICON.map((entry) => ({
  entry,
  patterns: entry.words.map(compile),
  support: (entry.support ?? []).map(compile),
  verbs: (entry.verbs ?? []).map(compile),
}));
