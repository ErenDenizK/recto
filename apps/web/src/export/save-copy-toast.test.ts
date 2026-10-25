/**
 * DSN-77: a copy that saved clears the earlier "Copy not saved" toast of the same document.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetToasts, useToastStore } from '../ui/Toast/toast-store';
import { showCopyDone, showCopyFailed } from './save-copy-run';

const id = 'doc-1' as DocumentId;

describe('copy toasts', () => {
  beforeEach(resetToasts);

  it('a saved copy replaces the failure of the same document', () => {
    showCopyFailed(id, 'disk full');
    expect(useToastStore.getState().shown.map((t) => t.kind)).toEqual(['failure']);
    showCopyDone(
      id,
      { name: 'a.pdf', size: 1024, verified: true, seconds: null, items: [] },
      'downloaded',
    );
    const { shown } = useToastStore.getState();
    expect(shown.map((t) => t.kind)).toEqual(['success']);
  });
});
