/**
 * The update-ready notice (`register.ts`; `08-feedback` FB4 §2, §5, issue 9): its toast loads
 * on demand (`update-toast.ts`, kept out of the first paint, V1-P1) and still shows once, with
 * Reload and Later, saying whether documents reopen.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../i18n';
import { resetSessionStore, useSessionStore } from '../session/session-store';
import { resetToasts, useToastStore } from '../ui/Toast/toast-store';
import { dismissUpdate, showUpdateReady, usePwaStore } from './register';

afterEach(() => {
  resetToasts();
  resetSessionStore();
  usePwaStore.setState({ updateAvailable: false });
});

describe('showUpdateReady', () => {
  it('shows the system toast with Reload and Later', async () => {
    setLocale('en');
    await showUpdateReady();
    expect(usePwaStore.getState().updateAvailable).toBe(true);
    const [shown] = useToastStore.getState().shown;
    expect(shown).toMatchObject({
      kind: 'system',
      text: 'Update ready',
      detail: 'Reloading closes open documents.',
      testId: 'update-toast',
    });
    expect(shown?.action?.label).toBe('Reload');
    expect(shown?.secondary?.label).toBe('Later');
  });

  it('says documents reopen when the session keeps them, and shows once', async () => {
    setLocale('en');
    useSessionStore.setState({ keeping: 'available' });
    await showUpdateReady();
    await showUpdateReady();
    const { shown } = useToastStore.getState();
    expect(shown).toHaveLength(1);
    expect(shown[0]?.detail).toBe('Your documents reopen where they were.');
  });

  it('Later hides the notice for the session', async () => {
    await showUpdateReady();
    useToastStore.getState().shown[0]?.secondary?.run();
    expect(usePwaStore.getState().updateAvailable).toBe(false);
    dismissUpdate();
    expect(usePwaStore.getState().updateAvailable).toBe(false);
  });
});
