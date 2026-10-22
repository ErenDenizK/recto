/**
 * Bilingual palette keywords (experience-redesign §8, decision 11): every command's
 * `cmd_<id>_keywords` is read in both UI languages and matched without diacritics, and the
 * catalogs carry an English list wherever they carry a Turkish one.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import tr from '../../messages/tr.json';
import { registerDocumentCommands } from '../document/document-commands';
import { setLocale } from '../i18n';
import { registerOutlineCommands } from '../outline/outline-commands';
import { registerSettingsCommands } from '../settings/settings-commands';
import { registerSampleCommands } from '../sample/open-sample';
import { buildSections } from '../shell/CommandPalette';
import { registerSignatureCommands } from '../signatures/signature-commands';
import { registerArrangeCommands } from '../stage/arrange-commands';
import { registerAppCommands } from './app-commands';
import * as keywordMessages from './keyword-messages';
import { catalogKeywords, keywordMessageKey, messageKeywords, splitKeywords } from './keywords';
import { CommandRegistry } from './registry';

const KEYWORD_KEY = /^cmd_.+_keywords$/;

/** Every command the app registers, as `app.tsx` does. */
function allCommands(): CommandRegistry {
  const registry = new CommandRegistry();
  registerAppCommands(registry);
  registerArrangeCommands(registry);
  registerDocumentCommands(registry);
  registerOutlineCommands(registry);
  registerSignatureCommands(registry);
  registerSettingsCommands(registry);
  registerSampleCommands(registry);
  return registry;
}

/** Palette results in order, as the palette lists them for a query. */
function search(registry: CommandRegistry, query: string): string[] {
  return buildSections(query, registry.list(), [], () => true).flatMap((s) =>
    s.rows.map((r) => r.command.id),
  );
}

// The registry loads the catalog keywords after its first registration (registry.ts); once
// loaded, every registry adds them at once.
beforeAll(async () => {
  await allCommands().keywordsLoaded();
});

afterEach(() => {
  setLocale('en');
});

describe('keyword message keys', () => {
  it('derives the message key from the command id', () => {
    expect(keywordMessageKey('tool.ink')).toBe('cmd_tool_ink_keywords');
    expect(keywordMessageKey('tool.text-box')).toBe('cmd_tool_text_box_keywords');
    expect(keywordMessageKey('documents.mergeAll')).toBe('cmd_documents_merge_all_keywords');
    expect(keywordMessageKey('view.show.comments')).toBe('cmd_view_show_comments_keywords');
  });

  it('splits a catalog entry into trimmed keywords', () => {
    expect(splitKeywords(' draw,pencil ,, el yazısı ')).toEqual(['draw', 'pencil', 'el yazısı']);
  });
});

describe('keyword catalogs', () => {
  const enKeys = Object.keys(en).filter((k) => KEYWORD_KEY.test(k));
  const trKeys = Object.keys(tr).filter((k) => KEYWORD_KEY.test(k));
  const enCatalog = en as Record<string, unknown>;
  const trCatalog = tr as Record<string, unknown>;

  it('names every keyword message in keyword-messages.ts', () => {
    expect(Object.keys(keywordMessages).sort()).toEqual([...enKeys].sort());
  });

  it('has an English keyword list for every Turkish one, and the other way round', () => {
    expect(trKeys.length).toBeGreaterThan(0);
    for (const key of trKeys) {
      expect(splitKeywords(String(trCatalog[key])), `tr ${key}`).not.toEqual([]);
      expect(typeof enCatalog[key], `en ${key}`).toBe('string');
      expect(splitKeywords(String(enCatalog[key])), `en ${key}`).not.toEqual([]);
    }
    for (const key of enKeys) expect(typeof trCatalog[key], `tr ${key}`).toBe('string');
  });

  it('names only commands that exist', () => {
    const registry = allCommands();
    const known = new Set(registry.list().map((c) => keywordMessageKey(c.id)));
    expect(enKeys.filter((key) => !known.has(key))).toEqual([]);
  });

  it('carries the minimum sets of the spec', () => {
    const has = (id: string, words: readonly string[]) => {
      const all = messageKeywords(id);
      for (const word of words) expect(all, id).toContain(word);
    };
    has('tool.ink', ['draw', 'pencil', 'handwriting', 'scribble', 'sketch']);
    has('tool.ink', ['kalem', 'çiz', 'çizim', 'el yazısı']);
    has('documents.mergeAll', ['combine', 'join', 'append', 'birleştir']);
    has('section.split', ['separate', 'böl', 'ayır']);
    has('mode.compare', ['diff', 'karşılaştır']);
    has('tool.signature', ['signature', 'imza']);
    has('document.sign', ['digital signature', 'certificate', 'dijital imza', 'sertifika']);
    has('document.ocr', ['OCR', 'scan', 'metin tanı']);
    has('tool.redact', ['black out', 'karart']);
    has('pages.rotateRight', ['döndür']);
    has('pages.rotateLeft', ['döndür']);
  });

  it('reads both languages whatever the UI language', () => {
    expect(catalogKeywords('tool.ink', 'en')).toContain('draw');
    expect(catalogKeywords('tool.ink', 'tr')).toContain('kalem');
    setLocale('tr');
    expect(messageKeywords('tool.ink')).toEqual(
      expect.arrayContaining(['draw', 'pencil', 'kalem', 'çiz']),
    );
    expect(messageKeywords('no.such.command')).toEqual([]);
  });
});

describe('palette keyword search', () => {
  it('adds catalog keywords to registered commands, after their own', () => {
    const registry = new CommandRegistry();
    registry.register({
      id: 'tool.ink',
      title: 'Pen tool',
      group: 'Tools',
      act: null,
      keywords: ['annotate'],
      run: () => undefined,
    });
    const keywords = registry.get('tool.ink')?.keywords ?? [];
    expect(keywords[0]).toBe('annotate');
    expect(keywords).toEqual(expect.arrayContaining(['draw', 'kalem', 'çiz']));
  });

  it('finds Pen with English and Turkish words, with or without diacritics', () => {
    const registry = allCommands();
    for (const query of ['draw', 'pencil', 'kalem', 'çiz', 'ciz', 'cizim', 'el yazisi']) {
      expect(search(registry, query)[0], query).toBe('tool.ink');
    }
  });

  it('finds Merge with combine, join and birleştir typed either way', () => {
    const registry = allCommands();
    for (const query of ['combine', 'join', 'birleştir', 'birlestir', 'BIRLESTIR']) {
      expect(['documents.mergeAll'], query).toContain(search(registry, query)[0]);
    }
  });

  it('finds the other renamed and keyworded commands', () => {
    const registry = allCommands();
    expect(search(registry, 'karart')[0]).toBe('tool.redact');
    expect(search(registry, 'karsilastir')[0]).toBe('mode.compare');
    expect(search(registry, 'sertifika')[0]).toBe('document.sign');
    expect(search(registry, 'imza')).toEqual(
      expect.arrayContaining(['tool.signature', 'document.sign']),
    );
    expect(search(registry, 'metin tani')[0]).toBe('document.ocr');
    expect(search(registry, 'bol')[0]).toBe('section.split');
  });

  it('matches Turkish keywords in the Turkish UI too, and English ones', () => {
    setLocale('tr');
    const registry = allCommands();
    expect(search(registry, 'kalem')[0]).toBe('tool.ink');
    expect(search(registry, 'draw')[0]).toBe('tool.ink');
    expect(['documents.mergeAll']).toContain(search(registry, 'combine')[0]);
  });
});

describe('conversion names (R23-8)', () => {
  const cases: [string, string][] = [
    ['images to pdf', 'section.insertImages'],
    ['resimden pdf', 'section.insertImages'],
    ['pdf to jpg', 'document.exportImages'],
    ["pdf'ten png", 'document.exportImages'],
    ['pdf to markdown', 'document.exportMarkdown'],
    ['pdf to text', 'document.exportMarkdown'],
    ["pdf'ten markdown", 'document.exportMarkdown'],
    ["pdf'ten metin", 'document.exportMarkdown'],
    ['text to pdf', 'file.textToPdf'],
    ['metinden pdf', 'file.textToPdf'],
    ['txt to pdf', 'file.textToPdf'],
  ];
  it.each(['en', 'tr'] as const)('finds each conversion in the %s UI', (locale) => {
    setLocale(locale);
    const registry = allCommands();
    for (const [query, id] of cases) expect(search(registry, query)[0], query).toBe(id);
  });
});

/**
 * The command half of the Epic 4 corpus (R12 E10; the intent half is `query.test.ts`): everyday
 * words in English and Turkish, typed any way, land on the command that does the job, and a
 * word with no command lands on nothing (the score floor, `isMeaningfulMatch`).
 */
const synonyms: readonly (readonly [string, string])[] = [
  ['make smaller', 'document.compress'],
  ['make it smaller', 'document.compress'],
  ['shrink', 'document.compress'],
  ['shrink file', 'document.compress'],
  ['compress', 'document.compress'],
  ['reduce file size', 'document.compress'],
  ['file too big', 'document.compress'],
  ['küçült', 'document.compress'],
  ['KÜÇÜLT', 'document.compress'],
  ['kucult', 'document.compress'],
  ['dosyayı küçült', 'document.compress'],
  ['boyutu küçült', 'document.compress'],
  ['sıkıştır', 'document.compress'],
  ['SIKIŞTIR', 'document.compress'],
  ['sikistir', 'document.compress'],
  ['hafiflet', 'document.compress'],
  ['save as', 'file.export'],
  ['farklı kaydet', 'file.export'],
  ['farkli kaydet', 'file.export'],
  ['download', 'file.export'],
  ['indir', 'file.export'],
  ['save', 'file.save'],
  ['kaydet', 'file.save'],
  ['KAYDET', 'file.save'],
  ['password protect', 'document.setPassword'],
  ['add password', 'document.setPassword'],
  ['encrypt', 'document.setPassword'],
  ['şifre koy', 'document.setPassword'],
  ['sifre', 'document.setPassword'],
  ['parola', 'document.setPassword'],
  ['şifreyi kaldır', 'document.removePassword'],
  ['unlock', 'document.removePassword'],
  ['anonymize', 'document.stripMetadata'],
  ['remove personal info', 'document.stripMetadata'],
  ['anonimleştir', 'document.stripMetadata'],
  ['gizlilik', 'document.stripMetadata'],
  ['rotate right', 'pages.rotateRight'],
  ['turn right', 'pages.rotateRight'],
  ['clockwise', 'pages.rotateRight'],
  ['sağa çevir', 'pages.rotateRight'],
  ['sola çevir', 'pages.rotateLeft'],
  ['rotate left', 'pages.rotateLeft'],
  ['counterclockwise', 'pages.rotateLeft'],
  ['döndür', 'pages.rotateRight'],
  ['sayfaları sil', 'pages.delete'],
  ['sayfayı sil', 'pages.delete'],
  ['delete page', 'pages.delete'],
  ['remove page', 'pages.delete'],
  ['duplicate', 'pages.duplicate'],
  ['çoğalt', 'pages.duplicate'],
  ['cogalt', 'pages.duplicate'],
  ['ÇOĞALT', 'pages.duplicate'],
  ['extract', 'pages.extract'],
  ['sayfaları ayır', 'pages.extract'],
  ['dark mode', 'settings.appearance'],
  ['karanlık mod', 'settings.appearance'],
  ['karanlik mod', 'settings.appearance'],
  ['gece modu', 'settings.appearance'],
  ['theme', 'settings.appearance'],
  ['tema', 'settings.appearance'],
  ['find', 'search.open'],
  ['search', 'search.open'],
  ['ara', 'search.open'],
  ['ARA', 'search.open'],
  ['belgede ara', 'search.open'],
  ['ocr', 'document.ocr'],
  ['make searchable', 'document.ocr'],
  ['scanned pdf', 'document.ocr'],
  ['taranmış pdf', 'document.ocr'],
  ['aranabilir yap', 'document.ocr'],
  ['merge', 'documents.mergeAll'],
  ['combine', 'documents.mergeAll'],
  ['pdf birleştir', 'documents.mergeAll'],
  ['split', 'section.split'],
  ['split pdf', 'section.split'],
  ['pdf böl', 'section.split'],
  ['böl', 'section.split'],
  ['revert', 'file.revert'],
  ['start over', 'file.revert'],
  ['baştan başla', 'file.revert'],
  ['page count', 'document.info'],
  ['how many pages', 'document.info'],
  ['kaç sayfa', 'document.info'],
  ['sayfa sayısı', 'document.info'],
  ['dosya boyutu', 'document.info'],
  ['sign here', 'tool.signature'],
  ['imza', 'tool.signature'],
  ['İMZA', 'tool.signature'],
  ['imzala', 'tool.signature'],
  ['watermark', 'document.watermark'],
  ['filigran', 'document.watermark'],
  ['FİLİGRAN', 'document.watermark'],
  ['open pdf', 'file.open'],
  ['browse files', 'file.open'],
  ['dosya aç', 'file.open'],
  ['pdf aç', 'file.open'],
  ['undo', 'edit.undo'],
  ['geri al', 'edit.undo'],
  ['redo', 'edit.redo'],
  ['yinele', 'edit.redo'],
  ['highlight', 'tool.highlight'],
  ['vurgula', 'tool.highlight'],
  ['fosforlu', 'tool.highlight'],
  ['underline', 'tool.underline'],
  ['alt çizgi', 'tool.underline'],
  ['strikethrough', 'tool.strikeout'],
  ['üstünü çiz', 'tool.strikeout'],
  ['censor', 'tool.redact'],
  ['black out', 'tool.redact'],
  ['hide text', 'tool.redact'],
  ['sansürle', 'tool.redact'],
  ['erase', 'tool.eraser'],
  ['silgi', 'tool.eraser'],
  ['stamp', 'tool.stamp'],
  ['damga', 'tool.stamp'],
  ['sticky note', 'tool.note'],
  ['yapışkan not', 'tool.note'],
  ['circle', 'tool.ellipse'],
  ['daire', 'tool.ellipse'],
  ['arrow', 'tool.arrow'],
  ['compare', 'mode.compare'],
  ['karşılaştır', 'mode.compare'],
  ['crop', 'pages.crop'],
  ['kırp', 'pages.crop'],
  ['kirp', 'pages.crop'],
  ['resize', 'pages.resize'],
  ['sayfa boyutu', 'pages.resize'],
  ['blank page', 'pages.insertBlank'],
  ['boş sayfa', 'pages.insertBlank'],
  ['bates', 'document.bates'],
  ['header', 'document.headerFooter'],
  ['üst bilgi', 'document.headerFooter'],
  ['page numbers', 'document.pageNumbers'],
  ['sayfa numarası', 'document.pageNumbers'],
  ['bookmark', 'outline.addBookmark'],
  ['sample', 'file.sample'],
  ['örnek', 'file.sample'],
  ['settings', 'settings.open'],
  ['ayarlar', 'settings.open'],
  ['AYARLAR', 'settings.open'],
  ['shortcuts', 'help.shortcuts'],
  ['zoom in', 'zoom.in'],
  ['zoom out', 'zoom.out'],
  ['fit page', 'zoom.fitPage'],
  ['home', 'view.home'],
  ['ana ekran', 'view.home'],
  ['certificate', 'document.sign'],
  ['e-imza', 'document.sign'],
  ['pdf to jpg', 'document.exportImages'],
  ['images to pdf', 'section.insertImages'],
  ['batch', 'document.batch'],
  ['toplu işlem', 'document.batch'],
];

describe('synonym corpus (Epic 4)', () => {
  it('has at least 100 command queries', () => {
    expect(synonyms.length).toBeGreaterThanOrEqual(100);
  });

  it.each(['en', 'tr'] as const)(
    'lands each everyday word on its command in the %s UI',
    (locale) => {
      setLocale(locale);
      const registry = allCommands();
      // In the Turkish UI the titles are Turkish, so a command with no catalog keywords is only
      // reached by its own words; the corpus asks for the ones the catalogs carry.
      const misses = synonyms
        .filter(([, id]) => locale === 'en' || messageKeywords(id).length > 0)
        .filter(([query, id]) => !search(registry, query).slice(0, 5).includes(id));
      expect(misses).toEqual([]);
    },
  );

  it('puts Compress first for the headline synonyms', () => {
    const registry = allCommands();
    for (const query of ['make smaller', 'shrink', 'küçült', 'kucult', 'sıkıştır']) {
      expect(search(registry, query)[0], query).toBe('document.compress');
    }
  });
});

describe('score floor (Epic 4)', () => {
  it('never offers an unrelated row for a word with no command', () => {
    const registry = allCommands();
    // Print… (PRD-25) is the only row for print; the junk match was "Toggle pen draws in Edit".
    for (const query of ['print', 'yazdır', 'printer']) {
      expect(search(registry, query), query).toEqual(['file.print']);
    }
    for (const query of ['xyzzy', 'blockchain', 'qwerty', 'kahve']) {
      expect(search(registry, query), query).toEqual([]);
    }
  });

  it('keeps consonant abbreviations on their old top matches', () => {
    const registry = allCommands();
    expect(search(registry, 'wtrmrk')[0]).toBe('document.watermark');
    expect(search(registry, 'mrkdn')[0]).toBe('document.exportMarkdown');
    expect(search(registry, 'dwnld')[0]).toBe('file.export');
    expect(search(registry, 'hl').slice(0, 5)).toContain('tool.highlight');
    expect(search(registry, 'dlt')).toEqual(
      expect.arrayContaining(['pages.delete', 'annotation.delete']),
    );
  });

  it('keeps abbreviations and one-letter slips', () => {
    const registry = allCommands();
    expect(search(registry, 'zi')).toContain('zoom.in');
    expect(search(registry, 'zom in')).toContain('zoom.in');
    expect(search(registry, 'rotat')).toContain('pages.rotateRight');
  });
});
