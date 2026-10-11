/**
 * The drawer's second row while Sign is armed (`design/phone-2026-10/README.md` §3 row 2: "the
 * saved signatures as tiles, plus New"; MK-12's plates): New first, then the kept signatures
 * newest first (at most five, `SAVED_SIGNATURE_LIMIT`), each a 56 px tile with the signature on
 * its page-white plate, in one row that scrolls sideways when it outgrows the drawer. A saved
 * tile arms that signature for the next tap on a page and closes the drawer; the armed one shows
 * pressed. Where this window keeps nothing, one line says so beside New.
 *
 * Its own chunk (README §7 "signatures are split again"), loaded as Sign arms (`sign.tsx`).
 */
import { useEffect } from 'react';

import { useAnnotationStore } from '../../../annotations/annotation-store';
import { m } from '../../../i18n';
import { receivePulse } from '../../../motion/receive';
import {
  armedSavedSignature,
  armSavedSignature,
  loadSavedSignatures,
  signatureLabel,
  useSavedSignatures,
} from '../../../signatures/saved-signatures';
import { SignaturePlate } from '../../../signatures/SignaturePlate';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { useToolStore } from '../../../viewer/tool-store';
import { setDrawerOpen } from '../compact-store';
import { openNewSignatureSheet } from './sign';
import styles from './sign.module.css';

/** A saved tile's pulse shows this long before the drawer goes back into the chip. */
const ARM_CLOSE_DELAY_MS = 90;

/** Reads the kept signatures (once per session; `sign.tsx` calls it as Sign arms). */
export function loadSignatures(): Promise<void> {
  return loadSavedSignatures();
}

export default function SignOptions() {
  const signatures = useSavedSignatures((s) => s.signatures);
  const status = useSavedSignatures((s) => s.status);
  const mode = useToolStore((s) => s.mode);
  const pending = useAnnotationStore((s) => s.pendingStamp);
  const armed = armedSavedSignature(mode, pending);

  useEffect(() => {
    void loadSavedSignatures();
  }, []);

  const arm = async (id: string, el: HTMLElement) => {
    receivePulse(el);
    if (await armSavedSignature(id)) {
      window.setTimeout(() => setDrawerOpen(false), ARM_CLOSE_DELAY_MS);
    }
  };

  return (
    <div className={styles.row} data-testid="compact-sign-options">
      <div className={styles.tiles} role="group" aria-label={m.compact_sign_saved()}>
        <Button
          variant="quiet"
          className={`${styles.tile} ${styles.new}`}
          data-testid="compact-sign-new"
          onClick={() => void openNewSignatureSheet()}
        >
          <Icon name="plus" />
          {m.compact_sign_new()}
        </Button>
        {signatures.map((signature) => (
          <Button
            key={signature.id}
            variant="quiet"
            className={styles.tile}
            aria-label={signatureLabel(signature)}
            aria-pressed={armed === signature.id}
            data-saved-signature={signature.id}
            onClick={(event) => void arm(signature.id, event.currentTarget)}
          >
            <SignaturePlate ink={signature} className={styles.plate} />
          </Button>
        ))}
      </div>
      {status === 'refused' ? <p className={styles.note}>{m.signature_not_kept()}</p> : null}
    </div>
  );
}
