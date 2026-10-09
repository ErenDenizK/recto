/**
 * The sidebar's Pages section (`components/06-navigation.md` N1 §2, N2, N3): Thumbnails ·
 * Contents (spec X27). The section switch above is the segmented control; this second level is
 * a smaller row of text tabs (system-audit-2026-10 I-29, §4 Frame), footnote labels with the
 * chosen one in the primary ink at 600 over a 2 px rule, so the two levels never read as one
 * control twice. A radio group (Base UI `RadioGroup`: arrows move and choose). The choice is
 * remembered (`pagesView`, `ui:v3`). The section switch above already says "Pages", so the
 * view control names the two views only (no second "Pages").
 *
 * N1's ⊞ "Show all pages" is not in this row: beside the two views it left no room for the
 * Turkish labels at 280 px (the control fell back to a Select) nor for coarse pointers. The
 * Pages grid stays one press away: the dock's Pages, `3`, a pinch, and "Show in Pages grid"
 * in the thumbnail menu.
 *
 * In the Pages grid only Contents is offered (06.1): the grid is the thumbnails.
 */
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';

import { m } from '../../i18n';
import { type PagesView, useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument } from '../../state/workspace-store';
import { EmptyNote } from '../../ui/EmptyNote';
import { OutlinePanel } from '../OutlinePanel';
import styles from './PagesSection.module.css';
import { ThumbnailList } from './ThumbnailList';

const VIEWS: readonly { readonly value: PagesView; readonly label: () => string }[] = [
  { value: 'thumbnails', label: m.nav_pages_thumbnails },
  { value: 'bookmarks', label: m.nav_pages_bookmarks },
];

export function PagesSection() {
  const view = useUiStore((s) => s.pagesView);
  const setView = useUiStore((s) => s.setPagesView);
  const inGrid = useStageView() === 'grid';
  const shown = inGrid ? 'bookmarks' : view;
  return (
    <div className={styles.section} data-pages-view={shown}>
      {inGrid ? null : (
        <div className={styles.header}>
          <RadioGroup
            aria-label={m.nav_pages_view_label()}
            value={view}
            onValueChange={setView}
            className={styles.views}
          >
            {VIEWS.map((option) => (
              <Radio.Root key={option.value} value={option.value} className={styles.view}>
                {option.label()}
              </Radio.Root>
            ))}
          </RadioGroup>
        </div>
      )}
      <div className={styles.body}>{shown === 'bookmarks' ? <OutlinePanel /> : <Thumbnails />}</div>
    </div>
  );
}

function Thumbnails() {
  const doc = useActiveDocument();
  if (!doc) {
    return (
      <div className={styles.empty}>
        <EmptyNote title={m.no_document_title()} body={m.pages_empty_body()} />
      </div>
    );
  }
  if (doc.pages.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyNote title={m.pages_none_title()} body={m.pages_none_body()} />
      </div>
    );
  }
  return <ThumbnailList doc={doc} />;
}
