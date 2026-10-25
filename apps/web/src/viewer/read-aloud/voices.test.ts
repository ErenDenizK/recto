import { describe, expect, it, vi } from 'vitest';

import { availableVoices, readingLanguage, waitForVoices } from './voices';

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

describe('waitForVoices', () => {
  const fake = () => {
    let list: SpeechSynthesisVoice[] = [];
    let listener: (() => void) | undefined;
    return {
      fill: (voices: SpeechSynthesisVoice[]) => {
        list = voices;
        listener?.();
      },
      synth: {
        getVoices: () => list,
        addEventListener: (_: string, l: () => void) => {
          listener = l;
        },
        removeEventListener: () => {
          listener = undefined;
        },
      } as unknown as SpeechSynthesis,
    };
  };

  it('resolves at once when voices are listed', async () => {
    const f = fake();
    f.fill([voice('Ada', 'en-US', true)]);
    expect(await waitForVoices(f.synth)).toHaveLength(1);
  });

  it('waits for voiceschanged when the list is empty at first', async () => {
    const f = fake();
    const pending = waitForVoices(f.synth);
    f.fill([voice('Ada', 'en-US', true)]);
    expect(await pending).toHaveLength(1);
  });

  it('gives up after the timeout with an empty list', async () => {
    vi.useFakeTimers();
    const f = fake();
    const pending = waitForVoices(f.synth, 500);
    vi.advanceTimersByTime(500);
    expect(await pending).toEqual([]);
    vi.useRealTimers();
  });
});
