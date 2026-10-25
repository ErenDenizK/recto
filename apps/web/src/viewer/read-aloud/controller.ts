/**
 * Read aloud, the controller (R29 big move BM-2; PRD-34, behind `?read=1`): speaks the page in
 * view with the browser's `speechSynthesis`, one sentence per utterance (so Previous and Next
 * are a sentence each and a long page never hits an engine's utterance limit), rings the word
 * the voice reports (`boundary` events) and moves on to the next page, keeping it in view.
 *
 * The text is the engine's text of the page in reading order (`getPageText`, as Find and the
 * text layer take it). Only on-device voices speak (`voices.ts`). A prototype: the highlight is
 * the Find mark's style, drawn by `ReadAloudHighlight`.
 */
import { getActiveDocument, type PageId, type Rect } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { getEngineService } from '../../engine/engine-service';
import { getLocale, m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { useWorkspaceStore } from '../../state/workspace-store';
import { goToPageIndex, navigationBase } from '../navigation';
import { type PageSpeech, pageSpeech, type Span, sentences, wordAt, wordRects } from './chunk';
import {
  availableVoices,
  readingLanguage,
  type VoiceAvailability,
  type VoiceChoice,
} from './voices';

export const RATES = [0.8, 1, 1.25, 1.5] as const;

export type ReadStatus = 'idle' | 'playing' | 'paused';

interface ReadAloudState {
  readonly open: boolean;
  readonly status: ReadStatus;
  /** `null` while the browser has not listed its voices yet. */
  readonly availability: VoiceAvailability | null;
  readonly voiceUri: string | null;
  readonly rate: number;
  readonly pageIndex: number;
  readonly pageId: PageId | null;
  /** The page has nothing to read (an image, a blank). */
  readonly pageEmpty: boolean;
  /** Boxes of the word being spoken, user space of `pageId`. */
  readonly word: readonly Rect[];
}

const INITIAL: ReadAloudState = {
  open: false,
  status: 'idle',
  availability: null,
  voiceUri: null,
  rate: 1,
  pageIndex: -1,
  pageId: null,
  pageEmpty: false,
  word: [],
};

export const useReadAloudStore = create<ReadAloudState>()(() => INITIAL);

const set = useReadAloudStore.setState;
const get = useReadAloudStore.getState;

// What is being read. `run` changes whenever speech is cancelled, so a late event from a
// cancelled utterance is ignored.
let run = 0;
let speech: PageSpeech | null = null;
let spans: Span[] = [];
let sentence = 0;
// Kept so the engine cannot collect it before it ends (Chrome stops firing events then).
let utterance: SpeechSynthesisUtterance | null = null;
let voices: readonly SpeechSynthesisVoice[] = [];

const synth = () => window.speechSynthesis;
const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);

function documentLanguage(): string {
  return readingLanguage(activeDocument()?.metadata.language, getLocale());
}

function refreshVoices(): void {
  voices = synth().getVoices();
  const availability = voices.length === 0 ? null : availableVoices(voices, documentLanguage());
  const choices = availability?.kind === 'ready' ? availability.voices : [];
  const kept = choices.find((c) => c.uri === get().voiceUri);
  set({ availability, voiceUri: kept?.uri ?? choices[0]?.uri ?? null });
}

/** The voices to list in the picker. */
export function voiceChoices(availability: VoiceAvailability | null): readonly VoiceChoice[] {
  return availability?.kind === 'ready' ? availability.voices : [];
}

function cancelSpeech(): void {
  run += 1;
  if (utterance) utterance.onend = null;
  utterance = null;
  synth().cancel();
}

/** Reads page `index` into memory, scrolls it into view; false when the document has no such page. */
async function loadPage(index: number): Promise<boolean> {
  const doc = activeDocument();
  const page = doc?.pages[index];
  if (!doc || !page) return false;
  const mine = run;
  goToPageIndex(index, doc, 'step');
  speech = null;
  spans = [];
  sentence = 0;
  set({ pageIndex: index, pageId: page.id, pageEmpty: false, word: [] });
  if (page.ref.kind === 'source') {
    const result = await getEngineService().getPageText(page.ref.source, page.ref.index);
    if (mine !== run) return true;
    if (result.ok) {
      speech = pageSpeech(result.value);
      spans = sentences(speech.text, documentLanguage());
    }
  }
  set({ pageEmpty: spans.length === 0 });
  announce(m.read_aloud_page({ page: index + 1, count: doc.pages.length }));
  return true;
}

/** Loads page `from` and onwards, until one has text. False when none does. */
async function loadReadablePage(from: number, direction: 1 | -1): Promise<boolean> {
  const mine = run;
  for (let i = from; ; i += direction) {
    if (!(await loadPage(i))) return false;
    if (mine !== run) return true;
    if (spans.length > 0) {
      if (direction < 0) sentence = spans.length - 1;
      return true;
    }
  }
}

function speakSentence(): void {
  const span = spans[sentence];
  const voice = voices.find((v) => v.voiceURI === get().voiceUri);
  if (!speech || !span || !voice) return;
  const text = speech.text.slice(span.start, span.end);
  const mine = ++run;
  synth().cancel();
  const u = new SpeechSynthesisUtterance(text);
  utterance = u;
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = get().rate;
  const ring = (at: number, length?: number) => {
    if (mine !== run || !speech) return;
    const word = wordAt(text, at, length);
    if (word) set({ word: wordRects(speech, span.start + word.start, span.start + word.end) });
  };
  u.onstart = () => ring(0);
  u.onboundary = (event) => {
    if (event.name !== 'sentence') ring(event.charIndex, event.charLength);
  };
  u.onend = () => {
    if (mine === run) void advance(1);
  };
  u.onerror = (event) => {
    if (mine === run && event.error !== 'canceled' && event.error !== 'interrupted')
      closeReadAloud();
  };
  set({ status: 'playing' });
  synth().resume();
  synth().speak(u);
}

/** A sentence on (+1) or back (-1), across pages; the end of the document stops. */
async function advance(direction: 1 | -1): Promise<void> {
  const next = sentence + direction;
  if (next >= 0 && next < spans.length) {
    sentence = next;
  } else {
    cancelSpeech();
    const found = await loadReadablePage(get().pageIndex + direction, direction);
    if (!found) {
      closeReadAloud();
      return;
    }
    if (direction > 0) sentence = 0;
  }
  if (get().open && get().status !== 'idle') speakSentence();
}

/** Opens the player on the page in view and starts reading. */
export async function startReadAloud(): Promise<void> {
  if (get().open) return;
  const mine = ++run;
  set({ ...INITIAL, open: true, rate: get().rate });
  synth().addEventListener('voiceschanged', refreshVoices);
  refreshVoices();
  set({ status: 'playing' });
  const found = await loadReadablePage(navigationBase(), 1);
  if (mine !== run) return;
  if (!found || get().availability?.kind !== 'ready') {
    set({ status: 'idle' });
    return;
  }
  speakSentence();
}

export function togglePlay(): void {
  const { status, availability } = get();
  if (status === 'playing') {
    synth().pause();
    set({ status: 'paused' });
  } else if (status === 'paused') {
    synth().resume();
    set({ status: 'playing' });
  } else if (availability?.kind === 'ready' && spans.length > 0) {
    set({ status: 'playing' });
    speakSentence();
  }
}

export function stepSentence(direction: 1 | -1): void {
  if (!get().open) return;
  set({ status: 'playing' });
  void advance(direction);
}

function restart(): void {
  if (get().status === 'idle') return;
  set({ status: 'playing' });
  speakSentence();
}

export function setRate(rate: number): void {
  set({ rate });
  restart();
}

export function setVoice(voiceUri: string): void {
  set({ voiceUri });
  restart();
}

/** Closes the player and goes quiet. */
export function closeReadAloud(): void {
  cancelSpeech();
  speech = null;
  spans = [];
  synth().removeEventListener('voiceschanged', refreshVoices);
  set({ ...INITIAL, rate: get().rate });
}

/** Closes the player when the person switches to another document. */
export function watchReadAloudDocument(): () => void {
  let was = useWorkspaceStore.getState().workspace.activeDocument;
  return useWorkspaceStore.subscribe((s) => {
    if (s.workspace.activeDocument === was) return;
    was = s.workspace.activeDocument;
    if (get().open) closeReadAloud();
  });
}
