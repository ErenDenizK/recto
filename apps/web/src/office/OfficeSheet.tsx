/**
 * Convert to PDF (ADR-0035 §5): the consent and progress sheet for Office files, a task sheet
 * on the one Sheet primitive (components/07-sheets.md S0).
 *
 * - **Consent**, only when the package is not on the device: "A one-time conversion package
 *   (~79 MB) is needed. Download it?", what that means (kept on the device, offline after,
 *   the file never uploaded), the licence and its notices; Download or Cancel.
 * - **Downloading**: one bar for the whole package, "12.0 MB of 78.5 MB", and Cancel download
 *   under it (the footer holds a primary only). Esc, ✕ and the scrim cancel it too: closing
 *   never leaves a download running unseen.
 * - **Preparing** (the one reload into isolation) and **Converting report.docx…**: the sheet
 *   is busy; nothing to press, and it closes by itself when the PDF opens.
 * - **Failed**: why, in one sentence, with Try again where trying again can help.
 */
import { useEffect } from 'react';

import { formatNumber, formatSize, m } from '../i18n';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { Sheet, type SheetCloseReason, type SheetPrimary, SheetResult } from '../ui/sheet';
import { useRetained } from '../ui/use-retained';
import styles from './Office.module.css';
import type { OfficeFailure } from './office-error';
import { acceptDownload, beginOffice, cancelOffice, retryConversion } from './office-flow';
import { closeOffice, type OfficeStep, useOfficeStore } from './office-store';
import { noticeUrl } from './package';

export const OFFICE_SHEET = 'office-convert';

export default function OfficeSheet() {
  const files = useOfficeStore((s) => s.files);
  const step = useOfficeStore((s) => s.step);
  const [shown] = useRetained(files);
  const open = files !== null;

  // Each opening starts the flow once (a resume opens with no files yet).
  useEffect(() => {
    if (open) void beginOffice();
  }, [open]);

  if (shown === null) return null;
  const busy = step.kind === 'reloading' || step.kind === 'converting' || step.kind === 'checking';

  const onClose = (_reason: SheetCloseReason) => {
    if (busy) return;
    if (step.kind === 'downloading') cancelOffice();
    else closeOffice();
  };

  return (
    <Sheet
      id={OFFICE_SHEET}
      kind="task"
      open={open}
      onClose={onClose}
      title={m.office_title()}
      primary={primaryFor(step)}
      cancel={cancelFor(step, busy)}
      busy={busy}
      initialFocus="primary"
      testId="office-sheet"
    >
      <p className={styles.file} data-testid="office-file">
        {shown.length === 1
          ? (shown[0]?.name ?? '')
          : m.office_files_many({ count: formatNumber(shown.length) })}
      </p>
      <StepBody step={step} />
    </Sheet>
  );
}

function cancelFor(step: OfficeStep, busy: boolean): string | false {
  if (busy || step.kind === 'downloading') return false;
  return step.kind === 'failed' ? m.common_close() : m.common_cancel();
}

function primaryFor(step: OfficeStep): SheetPrimary | undefined {
  if (step.kind === 'consent') {
    return {
      label: m.office_download(),
      onPress: () => void acceptDownload(),
      testId: 'office-download',
    };
  }
  if (step.kind === 'failed' && step.retry !== null) {
    return {
      label: m.office_try_again(),
      onPress: () => void (step.retry === 'download' ? acceptDownload() : retryConversion()),
      testId: 'office-retry',
    };
  }
  return undefined;
}

function StepBody({ step }: { readonly step: OfficeStep }) {
  switch (step.kind) {
    case 'checking':
      return <Progress value={null} label={m.office_checking()} hideValue />;
    case 'consent':
      return (
        <>
          <p className={styles.lead} data-testid="office-consent">
            {m.office_consent({ size: formatSize(step.downloadBytes) })}
          </p>
          <p className={styles.note}>{m.office_consent_detail()}</p>
          <p className={styles.note}>
            {m.office_licence()}{' '}
            <a className={styles.link} href={noticeUrl()} target="_blank" rel="noopener noreferrer">
              {m.office_notices()}
            </a>
          </p>
        </>
      );
    case 'downloading':
      return (
        <>
          <Progress
            value={step.total > 0 ? (step.loaded / step.total) * 100 : null}
            label={m.office_downloading()}
          />
          <p className={styles.amount} data-testid="office-amount">
            {m.office_downloaded_of({
              loaded: formatSize(step.loaded),
              total: formatSize(step.total),
            })}
          </p>
          {/* The footer holds a primary only; the download's one act sits under its bar. */}
          <Button className={styles.cancel} variant="standard" onClick={cancelOffice}>
            {m.office_cancel_download()}
          </Button>
        </>
      );
    case 'reloading':
      return (
        <>
          <Progress value={null} label={m.office_reloading()} hideValue />
          <p className={styles.note}>{m.office_reloading_detail()}</p>
        </>
      );
    case 'converting':
      return (
        <>
          <Progress
            value={step.percent}
            label={
              step.phase === 'starting'
                ? m.office_starting()
                : m.office_converting({ name: step.name })
            }
            hideValue={step.percent === null}
          />
          <p className={styles.note}>{m.office_fidelity()}</p>
        </>
      );
    case 'failed':
      return (
        <SheetResult
          tone="error"
          title={m.office_failed_title()}
          body={failureText(step.reason, step.name ?? '')}
        />
      );
  }
}

function failureText(reason: OfficeFailure, name: string): string {
  switch (reason) {
    case 'missing':
      return m.office_failed_missing();
    case 'network':
      return m.office_failed_network();
    case 'corrupt':
      return m.office_failed_corrupt();
    case 'quota':
      return m.office_failed_quota();
    case 'isolation':
      return m.office_failed_isolation();
    case 'convert':
      return m.office_failed_convert({ name });
    case 'timeout':
      return m.office_failed_timeout({ name });
  }
}
