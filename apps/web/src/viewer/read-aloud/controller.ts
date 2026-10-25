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
  waitForVoices,
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
  /** Boxes of the sentence being spoken: the mark that stays when a voice sends no word events. */
  readonly sentence: readonly Rect[];
  /** The page follows the voice; off once the person scrolls by hand, on at Play or a step. */
  readonly following: boolean;
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
  sentence: [],
  following: true,
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
// A page turn is loading: Previous and Next wait for it.
let loading = false;
// The document ended: Play starts again from the first page.
let ended = false;

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
  if (get().following) goToPageIndex(index, doc, 'step');
  speech = null;
  spans = [];
  sentence = 0;
  set({ pageIndex: index, pageId: page.id, pageEmpty: false, word: [], sentence: [] });
  if (page.ref.kind === 'source') {
    const result = await getEngineService().getPageText(page.ref.source, page.ref.index);
    if (mine !== run) return true;
    if (result.ok) {
      speech = pageSpeech(result.value);
      spans = sentences(speech.text, documentLanguage());
    }
  }
  set({ pageEmpty: spans.length === 0 });
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
  set({ sentence: wordRects(speech, span.start, span.end), word: [] });
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

/** A sentence on (+1) or back (-1), across pages; the end of the document leaves the player idle. */
async function advance(direction: 1 | -1): Promise<void> {
  const next = sentence + direction;
  if (next >= 0 && next < spans.length) {
    sentence = next;
  } else {
    cancelSpeech();
    loading = true;
    const found = await loadReadablePage(get().pageIndex + direction, direction);
    loading = false;
    if (!get().open) return;
    if (!found && direction < 0) {
      // Before the first sentence: stay at the start.
      loading = true;
      await loadReadablePage(0, 1);
      loading = false;
      if (!get().open) return;
    } else if (!found) {
      // Past the last page: quiet, and Play begins again.
      ended = true;
      set({ status: 'idle', word: [], sentence: [] });
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
  ended = false;
  loading = false;
  set({ ...INITIAL, open: true, rate: get().rate });
  synth().addEventListener('voiceschanged', refreshVoices);
  set({ status: 'playing' });
  // Some browsers list no voices until `voiceschanged`; wait for them rather than give up.
  await waitForVoices(synth());
  if (mine !== run) return;
  refreshVoices();
  const found = await loadReadablePage(navigationBase(), 1);
  if (mine !== run) return;
  if (!found || get().availability?.kind !== 'ready') {
    set({ status: 'idle' });
    return;
  }
  announce(
    m.read_aloud_page({ page: get().pageIndex + 1, count: activeDocument()?.pages.length ?? 0 }),
  );
  speakSentence();
}

/** Reads from the first page again, after the document ended. */
async function startOver(): Promise<void> {
  const mine = ++run;
  ended = false;
  loading = true;
  set({ status: 'playing', following: true });
  const found = await loadReadablePage(0, 1);
  loading = false;
  if (mine !== run || !get().open) return;
  if (found) speakSentence();
  else set({ status: 'idle' });
}

export function togglePlay(): void {
  if (loading) return;
  const { status, availability } = get();
  if (status === 'playing') {
    synth().pause();
    set({ status: 'paused' });
  } else if (status === 'paused') {
    synth().resume();
    set({ status: 'playing', following: true });
  } else if (availability?.kind === 'ready' && ended) {
    void startOver();
  } else if (availability?.kind === 'ready' && spans.length > 0) {
    set({ status: 'playing', following: true });
    speakSentence();
  }
}

export function stepSentence(direction: 1 | -1): void {
  if (!get().open || loading) return;
  if (ended) {
    void startOver();
    return;
  }
  set({ status: 'playing', following: true });
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
  loading = false;
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

/** The person scrolled by hand: the page stops following the voice until Play or a step. */
export function stopFollowing(): void {
  if (get().open && get().following) set({ following: false });
}
