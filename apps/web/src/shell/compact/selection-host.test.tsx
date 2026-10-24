/**
 * The first page text selection brings the editing chunk with the selection bar (EDN-21): the
 * bar's actions enter editing, whose island lives in the chunk.
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TEXT_LAYER_ATTR } from '../../viewer/text-model';
import { SelectionHost } from './selection-host';

const host = vi.hoisted(() => ({ loadMark: vi.fn(() => Promise.resolve({})) }));

vi.mock('./mark-host', () => host);
vi.mock('./mark/selection-bar', () => ({ default: () => null }));

afterEach(() => {
  document.body.replaceChildren();
  globalThis.getSelection()?.removeAllRanges();
});

describe('the selection host', () => {
  it('loads the editing chunk on the first selection, not before', async () => {
    const layer = document.body.appendChild(document.createElement('div'));
    layer.setAttribute(TEXT_LAYER_ATTR, '0');
    layer.innerHTML = '<span>Hello page</span>';
    render(<SelectionHost />);
    expect(host.loadMark).not.toHaveBeenCalled();
    const range = document.createRange();
    range.selectNodeContents(layer);
    globalThis.getSelection()?.addRange(range);
    await waitFor(() => expect(host.loadMark).toHaveBeenCalledTimes(1));
  });
});
