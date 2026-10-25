import { describe, expect, it } from 'vitest';

import { availableVoices, readingLanguage } from './voices';

const voice = (name: string, lang: string, localService: boolean, def = false) =>
  ({ name, lang, localService, default: def, voiceURI: name }) as SpeechSynthesisVoice;

describe('availableVoices', () => {
  const all = [
    voice('Network en', 'en-US', false),
    voice('Zed', 'en-GB', true),
    voice('Ada', 'en_US', true),
    voice('Def', 'en-AU', true, true),
    voice('Ayse', 'tr-TR', true),
  ];

  it('keeps on-device voices of the language, the default first, then by name', () => {
    const result = availableVoices(all, 'en');
    expect(result.kind === 'ready' && result.voices.map((v) => v.name)).toEqual([
      'Def',
      'Ada',
      'Zed',
    ]);
  });

  it('matches the primary subtag of a region tag', () => {
    const result = availableVoices(all, 'tr-TR');
    expect(result.kind === 'ready' && result.voices.map((v) => v.name)).toEqual(['Ayse']);
  });

  it('says so when only network voices exist, and speaks none', () => {
    expect(availableVoices([voice('Net', 'en-US', false)], 'en')).toEqual({
      kind: 'network-only',
    });
  });

  it('says so when no on-device voice fits the language', () => {
    expect(availableVoices(all, 'de')).toEqual({ kind: 'no-language', language: 'de' });
  });
});

describe('readingLanguage', () => {
  it('takes the document language, else the interface language', () => {
    expect(readingLanguage('tr', 'en')).toBe('tr');
    expect(readingLanguage(undefined, 'en')).toBe('en');
    expect(readingLanguage(' ', 'tr')).toBe('tr');
  });
});
