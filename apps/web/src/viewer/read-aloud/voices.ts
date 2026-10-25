/**
 * Read aloud, the voices (PRD-34): only voices that run on the device are offered
 * (`localService`), so no text leaves it. Voices of the document's language (/Lang) come first;
 * a document without one falls back to the interface language. Browsers that list only network
 * voices speak nothing, and the player says so.
 */

export interface VoiceChoice {
  readonly uri: string;
  readonly name: string;
  readonly lang: string;
  readonly isDefault: boolean;
}

export type VoiceAvailability =
  | { readonly kind: 'ready'; readonly voices: readonly VoiceChoice[] }
  /** Voices exist, but none runs on the device. */
  | { readonly kind: 'network-only' }
  /** On-device voices exist, none for the language. */
  | { readonly kind: 'no-language'; readonly language: string };

const primary = (tag: string) => tag.toLowerCase().replace('_', '-').split('-')[0] ?? '';

/** The language to read in: the document's /Lang when it has one, else the interface's. */
export function readingLanguage(documentLang: string | undefined, uiLang: string): string {
  return documentLang && documentLang.trim() !== '' ? documentLang : uiLang;
}

/** On-device voices of `language`'s primary subtag, the browser's default first, then by name. */
export function availableVoices(
  voices: readonly SpeechSynthesisVoice[],
  language: string,
): VoiceAvailability {
  const local = voices.filter((voice) => voice.localService);
  if (local.length === 0 && voices.length > 0) return { kind: 'network-only' };
  const wanted = primary(language);
  const mine = local
    .filter((voice) => primary(voice.lang) === wanted)
    .map((voice) => ({
      uri: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      isDefault: voice.default,
    }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  return mine.length === 0 ? { kind: 'no-language', language } : { kind: 'ready', voices: mine };
}
