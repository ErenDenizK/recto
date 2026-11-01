/**
 * The phone's scan sheet (EDN-23; big move 1, plan bm-scan-plan §3 "Phones", PRD-34): the scan
 * sheet's camera, review and corner editor (`scan/ScanSheet.tsx`, one store, one camera, one
 * detector) in a full-screen modal that is laid out for one hand.
 *
 * - **Shape.** A full-screen dialog over the Library, clear of the status bar and the home
 *   indicator. Top row: Close at the left, the title, Done at the right once a page exists. The
 *   camera fills the middle; the shutter (72 px, the scan sheet's) stands in the bottom row, in
 *   thumb reach, with Auto / Manual at its left and the stack at its right. Review keeps the
 *   same per-page actions, each a 44 px target on a finger (`IconButton`, `Segmented`).
 * - **Caps.** At most `PHONE_MAX_PAGES` pages, photos kept at `PHONE_PHOTO_SIDE`, pages made at
 *   `PHONE_PAGE_SIDE` (`phone-caps.ts`).
 * - **Done** makes the pages and shows the new document in the reader (`finish-phone.ts`).
 * - **Closing.** Close and Esc ask first when pages would be lost, as the scan sheet does.
 */
import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, useState } from 'react';

import { m } from '../../../i18n';
import { AdjustView, CameraView, usePreviews } from '../../../scan/ScanSheet';
import { ReviewStrip } from '../../../scan/ReviewStrip';
import { useScanOpen } from '../../../scan/scan-flag';
import { beginScan, closeScanSheet, useScanStore } from '../../../scan/scan-store';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { IconButton } from '../../../ui/IconButton';
import { ConfirmHost } from '../../../ui/sheet/Confirm';
import { confirm } from '../../../ui/sheet';
import { toast } from '../../../ui/Toast';
import { finishPhoneScan } from './finish-phone';
import { PHONE_LIMITS } from './phone-caps';
import styles from './PhoneScanSheet.module.css';

export function PhoneScanSheet() {
  const open = useScanOpen();
  const view = useScanStore((s) => s.view);
  const pages = useScanStore((s) => s.pages);
  const selectedId = useScanStore((s) => s.selected);
  const [busy, setBusy] = useState(false);
  usePreviews(open);
  useEffect(() => {
    if (open) beginScan();
  }, [open]);
  const selected = pages.find((p) => p.id === selectedId) ?? pages[pages.length - 1];

  // Close and Esc ask first when pages would be lost.
  const asking = useRef(false);
  const close = async () => {
    const count = useScanStore.getState().pages.length;
    if (busy || asking.current) return;
    if (count > 0) {
      asking.current = true;
      const discard = await confirm({
        title: count === 1 ? m.scan_discard_title_one() : m.scan_discard_title({ count }),
        body: m.scan_discard_body(),
        action: m.scan_discard(),
        danger: true,
      });
      asking.current = false;
      if (!discard) return;
    }
    closeScanSheet();
  };

  const done = async () => {
    setBusy(true);
    try {
      if (await finishPhoneScan(pages)) closeScanSheet();
      else toast.failure(m.scan_finish_failed());
    } catch {
      toast.failure(m.scan_finish_failed());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog.Root
        open={open}
        modal
        onOpenChange={(next) => {
          if (!next) void close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Popup
            className={styles.sheet}
            aria-modal="true"
            data-testid="scan-sheet"
            data-view={view}
          >
            <header className={styles.top}>
              <IconButton
                label={m.common_close()}
                icon={<Icon name="x" />}
                disabled={busy}
                data-testid="scan-close"
                onClick={() => void close()}
              />
              <Dialog.Title className={styles.title}>{m.scan_title()}</Dialog.Title>
              {view !== 'adjust' && pages.length > 0 ? (
                <Button
                  variant="prominent"
                  icon={<Icon name="check" />}
                  busy={busy}
                  busyLabel={m.scan_done_busy()}
                  data-testid="scan-done"
                  onClick={() => void done()}
                >
                  {m.scan_done()}
                </Button>
              ) : (
                <span />
              )}
            </header>
            {open && (
              <div className={styles.body}>
                <CameraView active={view === 'camera'} limits={PHONE_LIMITS} />
                {view === 'review' && <ReviewStrip pages={pages} selected={selected} />}
                {view === 'adjust' && selected && <AdjustView page={selected} />}
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmHost />
    </>
  );
}
