/**
 * "N more ▾" (`components/01-frame.md` F4 §2, §5; spec 01.Q1): the open documents that do not
 * fit the strip at their minimum width, as an M4 menu in document order. A capsule after the
 * last visible tab, 32 / 44 px high, growing with its label (A-21: "3 daha ▾" in Turkish).
 * Choosing a document activates it, which brings it into the strip (`splitTabs` keeps the
 * active tab visible) and moves focus to its tab.
 */
import { Menu } from '@base-ui/react/menu';
import type { DocumentId } from '@pdf-editor/document-model';
import { ChevronDown } from 'lucide-react';

import { showTab } from '../../home/home-actions';
import { m } from '../../i18n';
import type { TabItem } from '../../state/workspace-store';
import menuStyles from '../../ui/Menu.module.css';
import { tabDomId } from './ids';
import styles from './TopStrip.module.css';

export function TabOverflow({
  tabs,
  edited,
}: {
  readonly tabs: readonly TabItem[];
  /** Documents whose changes are not yet in their file (● in the row). */
  readonly edited: ReadonlySet<DocumentId>;
}) {
  if (tabs.length === 0) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        className={styles.overflow}
        aria-label={m.frame_tab_overflow_name({ count: tabs.length })}
        data-testid="tab-overflow"
      >
        <span>{m.frame_tab_overflow({ count: tabs.length })}</span>
        <ChevronDown aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            {tabs.map((tab) => (
              <Menu.Item
                key={tab.id}
                className={menuStyles.item}
                onClick={() => {
                  showTab(tab.id);
                  requestAnimationFrame(() => document.getElementById(tabDomId(tab.id))?.focus());
                }}
              >
                <span className={styles.menuTag} data-tag={tab.colorIndex} aria-hidden="true" />
                <span className={menuStyles.label}>{tab.title}</span>
                {edited.has(tab.id) ? (
                  <span className={styles.menuEdited} aria-label={m.frame_edited()} />
                ) : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
