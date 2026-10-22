/**
 * The lazy sheet host (PF-21): a chunk that fails to load shows the failure toast, closes the
 * request (a pending image-sizing question resolves as cancelled) and lets the next opening
 * import again.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { CHUNK_LOAD_TIMEOUT } from '../../test/settled';
import {
  askImageSizing,
  closeOperationDialog,
  useOperationDialogStore,
} from '../stage/operation-dialogs-store';
import { createSheetHost } from './sheet-host';
import { hasToast, resetToasts } from './Toast';

afterEach(() => {
  closeOperationDialog();
  resetToasts();
});

describe('createSheetHost', () => {
  it('toasts a failed load, cancels the question and imports again on the next opening', async () => {
    let loads = 0;
    const Host = createSheetHost(
      () => {
        loads += 1;
        return loads === 1
          ? Promise.reject(new Error('chunk'))
          : Promise.resolve({ default: () => <p>sheet</p> });
      },
      () => useOperationDialogStore((s) => s.dialog !== null),
      closeOperationDialog,
    );
    render(<Host />);

    let answer: Awaited<ReturnType<typeof askImageSizing>> | 'pending' = 'pending';
    act(() => {
      void askImageSizing(2, { width: 100, height: 100 }).then((choice) => {
        answer = choice;
      });
    });
    await waitFor(() => expect(hasToast('sheet-load-failed')).toBe(true), {
      timeout: CHUNK_LOAD_TIMEOUT,
    });
    await waitFor(() => expect(answer).toBeUndefined());
    expect(useOperationDialogStore.getState().dialog).toBeNull();

    act(() => {
      void askImageSizing(1, { width: 10, height: 10 });
    });
    expect(
      await screen.findByText('sheet', undefined, { timeout: CHUNK_LOAD_TIMEOUT }),
    ).toBeVisible();
    expect(loads).toBe(2);
  });
});
