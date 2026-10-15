/**
 * Whether "Try the sample" can work now (`02-library` L10 §4): always online; offline only when
 * the sample in the UI's language, in the edition's cut (MOB-12), is already in the browser's
 * caches (the service worker precaches all four files, 02.14). Offline before that, the entry is dimmed with "The sample needs to load
 * once with a connection" rather than failing on a press. Follows the `online` and `offline`
 * events; the cache is asked again on each change.
 */
import { useEffect, useState } from 'react';

import { useLocale } from '../i18n';
import { sampleUrl } from '../sample/sample-file';
import type { Edition } from '../shell/frame/edition';

/** Whether the sample file for `locale` and `edition` is in any of this origin's caches. */
export async function sampleCached(
  locale: 'en' | 'tr',
  edition: Edition = 'full',
): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    // Workbox stores precached files with a revision query; the path alone is the match.
    return (await caches.match(sampleUrl(locale, edition), { ignoreSearch: true })) !== undefined;
  } catch {
    return false;
  }
}

export function useSampleAvailable(edition: Edition = 'full'): boolean {
  const locale = useLocale() === 'tr' ? 'tr' : 'en';
  const [online, setOnline] = useState(() => globalThis.navigator?.onLine ?? true);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (online) return undefined;
    let current = true;
    void sampleCached(locale, edition).then((found) => {
      if (current) setCached(found);
    });
    return () => {
      current = false;
    };
  }, [online, locale, edition]);

  return online || cached;
}
