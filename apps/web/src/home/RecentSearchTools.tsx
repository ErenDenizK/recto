/**
 * The search field and the sort of Recents (Epic 3, 3d, `?home=search`). Loaded on demand by
 * `RecentList` (only when the flag is on and Recents lists six files or more), so the default
 * card carries none of it. It owns the query and the sort and reports what they leave.
 */
import { useEffect, useMemo, useState } from 'react';

import type { RecentEntry } from '../files/recents';
import { m } from '../i18n';
import { SearchField } from '../ui/SearchField';
import { Segmented } from '../ui/Segmented';
import { type RecentSort, searchSortRecents } from './recent-search';
import styles from './RecentList.module.css';

export interface RecentSearchView {
  readonly found: readonly RecentEntry[];
  readonly query: string;
  readonly sort: RecentSort;
}

export default function RecentSearchTools({
  listed,
  onView,
}: {
  readonly listed: readonly RecentEntry[];
  readonly onView: (view: RecentSearchView) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RecentSort>('recent');
  const found = useMemo(() => searchSortRecents(listed, query, sort), [listed, query, sort]);
  useEffect(() => onView({ found, query, sort }), [found, query, sort, onView]);

  return (
    <div className={styles.tools} data-testid="recent-tools">
      <SearchField
        className={styles.search}
        value={query}
        onValueChange={setQuery}
        label={m.recents_search_label()}
        placeholder={m.recents_search_placeholder()}
        data-testid="recent-search"
      />
      <Segmented
        frameClassName={styles.sort}
        label={m.recents_sort_label()}
        value={sort}
        onValueChange={setSort}
        options={[
          { value: 'recent', label: m.recents_sort_recent() },
          { value: 'name', label: m.recents_sort_name() },
          { value: 'size', label: m.recents_sort_size() },
        ]}
      />
    </div>
  );
}
