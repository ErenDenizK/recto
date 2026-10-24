/**
 * A probe that fails must not hide the form fields: the chunk loads for the page (EDN-21).
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEngineService } from '../../engine/engine-service';
import { useLoadMarkForForms } from './mark-host';

const chunk = vi.hoisted(() => ({ loads: 0 }));

vi.mock('./mark', () => {
  chunk.loads += 1;
  return {};
});

const doc = {
  pages: [{ ref: { kind: 'source', source: 'src-1', index: 0 } }],
} as unknown as VirtualDocument;

function Probe() {
  useLoadMarkForForms(doc);
  return null;
}

describe('the form probe fails', () => {
  beforeEach(() => {
    vi.spyOn(getEngineService(), 'ensureOpen').mockResolvedValue({ ok: true, value: undefined });
    vi.spyOn(getEngineService(), 'editor').mockRejectedValue(new Error('no engine'));
  });

  it('loads the chunk anyway', async () => {
    render(<Probe />);
    await waitFor(() => expect(chunk.loads).toBe(1));
  });
});
