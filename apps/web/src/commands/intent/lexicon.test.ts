/**
 * The lexicon's own rules (PRD-39, spec §2.5, §4.2): fillers hold no nouns, every word is
 * already folded, and a word is not two actions unless one of them is a second sense.
 */
import { describe, expect, it } from 'vitest';

import { foldForSearch } from '../fuzzy';
import { PATTERN_IDS } from '../../redaction/patterns';
import { THINGS } from './grammar';
import { COMPILED, FILLERS, LEXICON } from './lexicon';
import { readPatterns, TARGET_VOCAB } from './targets';
import { tokenise } from './tokenise';
import { isNoun } from './turkish';

/** The nouns the grammar knows: lexicon nouns, page words, file types, pattern names, things. */
function nouns(): string[] {
  const lexicon = COMPILED.flatMap((c) => [...c.patterns, ...c.support, ...c.verbs])
    .flat()
    .flatMap((u) => u.alts.filter((a) => a.k === 'n').map((a) => a.w));
  const pageNouns = ['page', 'pages', 'sayfa', 'belge', 'document', 'selection', 'dosya', 'file'];
  return [...new Set([...lexicon, ...TARGET_VOCAB, ...THINGS, ...pageNouns])];
}

describe('fillers', () => {
  it('holds no word that is also a noun the grammar knows', () => {
    const known = nouns();
    for (const filler of FILLERS) {
      const t = tokenise(filler).tokens[0];
      expect(t).toBeDefined();
      const hit = known.find((n) => n === filler || (t && isNoun(t, n)));
      expect(hit, `${filler} is also the noun ${hit}`).toBeUndefined();
    }
  });

  it('is folded already', () => {
    for (const filler of FILLERS) expect(foldForSearch(filler)).toBe(filler);
  });

  it('does not let a thing on a page through', () => {
    // "3. sayfadaki tabloyu sil": nothing here may be swallowed as a filler.
    for (const word of ['tabloyu', 'resmi', 'notu', 'yorumu', 'sayfadaki']) {
      expect(FILLERS.has(word)).toBe(false);
    }
  });
});

describe('entries', () => {
  it('writes every word already folded', () => {
    for (const entry of LEXICON) {
      for (const word of [...entry.words, ...(entry.support ?? []), ...(entry.verbs ?? [])]) {
        const plain = word.replace(/[~+?]/g, '');
        expect(foldForSearch(plain), word).toBe(plain);
      }
    }
  });

  it('keeps a word from meaning two actions unless one is a second sense', () => {
    const owner = new Map<string, (typeof LEXICON)[number]>();
    const navigates = new Set(['goto', 'heading', 'recent', 'find']);
    const clashes: string[] = [];
    for (const entry of LEXICON) {
      for (const word of entry.words) {
        const other = owner.get(word);
        owner.set(word, entry);
        if (!other || other.action === entry.action) continue;
        // A shared word needs a way to tell the senses apart: a second-sense weight, a known
        // two-way word, a slot that must come from the text, or reading the rest as text.
        const apart = (e: typeof entry): boolean =>
          e.weight < 1 ||
          e.alwaysAsk === true ||
          (e.needs?.length ?? 0) > 0 ||
          navigates.has(e.action);
        if (!apart(entry) && !apart(other))
          clashes.push(`${word}: ${other.action} / ${entry.action}`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('marks every second sense below 1 and every primary sense at 1', () => {
    for (const entry of LEXICON) expect([1, 0.8]).toContain(entry.weight);
  });

  it('names the redaction patterns in the finder order, minus nothing', () => {
    const all = readPatterns(tokenise('iban email kart tckn telefon tarih').tokens);
    expect(all?.value).toEqual([...PATTERN_IDS]);
  });
});
