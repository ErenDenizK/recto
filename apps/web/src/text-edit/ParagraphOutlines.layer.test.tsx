/**
 * The paragraph outlines on the mounted layer (TXT-25): arming Edit text on the tagged Chromium
 * export `word-tagged.pdf` shows one outline per paragraph target once their fade has settled;
 * without the Labs gate there are none. Vitest browser mode, PDFium.
 */
import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import wordTaggedUrl from '../../../../test/fixtures/text-edit-corpus/word-tagged.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { settled } from '../../test/settled';
import { registerAppCommands } from '../commands/app-commands';
import { resetAnnotationStore } from '../annotations/annotation-store';
import { resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { useShortcuts } from '../commands/use-shortcuts';
import { ReadView } from '../stage/ReadView';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { resetToolStore, useToolStore } from '../viewer/tool-store';
import { setParagraphOutlinesForTests } from './paragraph-outlines-flag';
import { useTextEditStore } from './text-edit-store';

function Harness({ doc }: { readonly doc: VirtualDocument }) {
  useShortcuts();
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 800 }}>
      <ReadView doc={doc} />
    </div>
  );
}

async function mount() {
  await useWorkspaceStore.getState().openFiles([await fixtureFile(wordTaggedUrl, 'word.pdf')]);
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;
  const first = doc.pages[0];
  if (first?.ref.kind !== 'source') throw new Error('no source page');
  useUiStore.getState().setZoom(1);
  useViewStore.getState().setCurrentPage(0);
  useUiStore.getState().openMarkup(doc.id);
  const { container } = render(<Harness doc={doc} />);
  await waitFor(
    () => {
      if (!container.querySelector('[data-page-index="0"] canvas[data-state="rendered"]')) {
        throw new Error('page not rendered');
      }
    },
    { timeout: 10_000 },
  );
  return { container, source: first.ref.source };
}

async function armed() {
  const { container } = await mount();
  useToolStore.getState().setMode('edit-text');
  return waitFor(
    () => {
      const l = container.querySelector<HTMLElement>('[data-text-edit-layer="0"]');
      if (!l?.querySelector('[data-text-paragraph]')) throw new Error('no paragraph targets');
      return l;
    },
    { timeout: 20_000 },
  );
}

describe('paragraph outlines (mounted)', () => {
  let disposeCommands: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(() => {
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    useTextEditStore.getState().close();
    useUiStore.setState({ destination: 'document', docUi: {} });
  });
  afterEach(async () => {
    cleanup();
    setParagraphOutlinesForTests(null);
    useTextEditStore.getState().close();
    await whenIdle();
    resetWorkspace();
    resetToolStore();
  });

  it('arming shows one outline per paragraph target', async () => {
    setParagraphOutlinesForTests(true);
    const layer = await armed();
    const boxes = layer.querySelector<HTMLElement>('[data-paragraph-outlines]');
    if (!boxes) throw new Error('no outlines');
    await settled(boxes);
    const targets = layer.querySelectorAll('[data-text-paragraph]').length;
    expect(targets).toBeGreaterThanOrEqual(4);
    expect(boxes.children).toHaveLength(targets);
    expect(getComputedStyle(boxes.children[0]!).pointerEvents).toBe('none');
  });

  it('without the Labs gate there are none', async () => {
    setParagraphOutlinesForTests(false);
    const layer = await armed();
    expect(layer.querySelector('[data-paragraph-outlines]')).toBeNull();
  });
});
