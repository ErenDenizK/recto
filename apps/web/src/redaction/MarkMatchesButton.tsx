/**
 * "Mark all matches for redaction" in the Search panel (redaction spec §1.1): one mark
 * per hit, all in one history entry. Waits for the search to finish so every hit is in.
 * Marks are page edits, so the button shows only while the document is in Edit.
 */
import { useState } from 'react';

import { formatNumber, m } from '../i18n';
import { Icon } from '../ui/Icon';
import { useCanChangeActive } from '../viewer/input-state';
import { useSearchStore } from '../viewer/search';
import styles from './MarkMatchesButton.module.css';
import { markSearchHits } from './review';

export function MarkMatchesButton() {
  const count = useSearchStore((s) => s.hits.length);
  const searching = useSearchStore((s) => s.status === 'searching');
  const [busy, setBusy] = useState(false);
  // Marking the matches is a targeted act (X22): refused only while locked.
  const editable = useCanChangeActive('targeted');
  if (count === 0 || !editable) return null;
  return (
    <button
      type="button"
      className={styles.button}
      disabled={searching || busy}
      data-testid="search-mark-all"
      onClick={() => {
        setBusy(true);
        void markSearchHits().finally(() => setBusy(false));
      }}
    >
      <Icon name="redact" />
      {m.redaction_mark_matches({ count, countText: formatNumber(count) })}
    </button>
  );
}
