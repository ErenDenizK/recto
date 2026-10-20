/**
 * The Convert to PDF sheet (ADR-0035 §5) in a real browser: the one-time question with the
 * package's size and the file's name, the download's bar with its own Cancel, and a failure in
 * one sentence with Try again. The flow's effects are fakes (`setOfficeDeps`).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { useSheetStore } from '../ui/sheet';
import { OfficeError } from './office-error';
import { setOfficeDeps } from './office-flow';
import { closeOffice, openOffice, useOfficeStore } from './office-store';
import { OfficeSheetHost } from './OfficeSheetHost';

const report = () => new File([new Uint8Array([0x50, 0x4b])], 'report.docx');

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(() => {
  setOfficeDeps(undefined);
  closeOffice();
});

describe('OfficeSheet (ADR-0035 §5)', () => {
  it('asks once, with the size and the file, then shows the download with its own Cancel', async () => {
    let finish: () => void = () => undefined;
    setOfficeDeps({
      installed: () => Promise.resolve(false),
      downloadBytes: () => 78_331_874,
      install: ({ onProgress }) =>
        new Promise((resolve) => {
          onProgress?.({ loaded: 39_000_000, total: 78_331_874 });
          finish = resolve;
        }),
      isolated: () => true,
      converter: () => ({
        convert: () => new Promise(() => undefined),
        dispose: () => undefined,
      }),
    });
    render(<OfficeSheetHost />);
    openOffice([report()]);
    const sheet = await settled(await screen.findByTestId('office-sheet'));
    expect((await within(sheet).findByTestId('office-consent')).textContent).toMatch(
      /one-time conversion package \(~74\.7 MB\) is needed\. Download it\?/,
    );
    expect(within(sheet).getByTestId('office-file')).toHaveTextContent('report.docx');
    expect(within(sheet).getByRole('link', { name: 'Notices' })).toHaveAttribute(
      'href',
      expect.stringMatching(/convert\/lo-[^/]+\/NOTICE\.txt$/),
    );

    await userEvent.click(within(sheet).getByTestId('office-download'));
    expect(await within(sheet).findByRole('progressbar')).toBeVisible();
    expect(within(sheet).getByTestId('office-amount')).toHaveTextContent('37.2 MB of 74.7 MB');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel download' }));
    await waitFor(() => expect(useOfficeStore.getState().files).toBeNull());
    finish();
  });

  it('says why it could not, and offers Try again where that helps', async () => {
    setOfficeDeps({
      installed: () => Promise.resolve(false),
      install: () => Promise.reject(new OfficeError('network', 'offline')),
    });
    render(<OfficeSheetHost />);
    openOffice([report()]);
    const sheet = await settled(await screen.findByTestId('office-sheet'));
    await userEvent.click(await within(sheet).findByTestId('office-download'));
    expect(await within(sheet).findByText(/The download stopped/)).toBeVisible();
    expect(within(sheet).getByTestId('office-retry')).toHaveTextContent('Try again');
  });
});
