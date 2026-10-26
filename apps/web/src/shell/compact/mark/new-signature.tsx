/**
 * New signature on the phone (S7, EDN-14; DSN-53): the full edition's form
 * (`signatures/new-signature-form.tsx`: Draw · Type · Image, Save for next time, the drafts, the
 * flight into the chip) in the phone's one sheet instead of the desktop `ui/sheet` path, so it
 * looks, moves and closes as every other phone sheet. Its open state is still the sheet store's
 * (`openNewSignature`, so Use arms what was drawn the same way); its primary stands under the
 * body with the reason it is disabled (RA-21), the line keeping its room so the sheet keeps its
 * size (Q-7). The pad never starts the sheet's swipe (`data-base-ui-swipe-ignore`); the head
 * does. Loaded on first use by `SignHost` (`sign.tsx`).
 */
import { useEffect } from 'react';

import { m } from '../../../i18n';
import { useNewSignatureForm } from '../../../signatures/new-signature-form';
import { Button } from '../../../ui/Button';
import { announce } from '../../announcer';
import { CompactSheet } from '../CompactSheet';
import styles from './sign.module.css';

/**
 * New opened it from the drawer, which closed: focus goes back to the tool chip's ▾; with the
 * single capsule (EDN-24) there is none, and it goes to the armed tool.
 */
const toolChip = () =>
  document.querySelector<HTMLElement>('[data-testid="compact-tool-more"]') ??
  document.querySelector<HTMLElement>('[data-compact-tool-chip]');

export default function CompactNewSignature() {
  const form = useNewSignatureForm();
  const { primary, open, restored } = form;
  // A draft that came back says so once as the sheet opens (07 §1.1 rule 5), as `Sheet` does.
  useEffect(() => {
    if (open && restored) announce(m.sheet_draft_restored());
  }, [open, restored]);
  const blocked = primary.disabled === true;
  return (
    <CompactSheet
      open={open}
      onClose={() => form.close('close')}
      title={form.title}
      testId="new-signature-sheet"
      initialFocus={form.initialFocus}
      returnFocus={toolChip}
      footer={
        <div className={styles.foot}>
          {/* Seen; the button says it as its description (RA-21). */}
          <p className={styles.reason} aria-hidden="true" data-hidden={blocked ? undefined : ''}>
            {primary.reason}
          </p>
          <Button
            variant="prominent"
            size="lg"
            disabled={blocked}
            reason={blocked ? primary.reason : undefined}
            busy={primary.busy === true}
            onClick={primary.onPress}
          >
            {primary.label}
          </Button>
        </div>
      }
    >
      <div className={styles.form}>{form.body}</div>
    </CompactSheet>
  );
}
