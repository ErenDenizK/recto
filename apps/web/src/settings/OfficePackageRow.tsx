/**
 * The Office conversion package in Settings (PRD-21; ADR-0035 phase 2): a row beside Recents,
 * shown when the package is installed or the `?office=1` flag is on, with its stored size and
 * **Remove**, which asks once, deletes the package and says the app stops being isolated at
 * the next load. The About page's "Conversion package licences" row lives here too: it opens
 * the stored NOTICE.txt (offline, from Cache Storage) or, with no package, the served one.
 *
 * Nothing from `office/` is imported statically: the lock and the download manager are a lazy
 * chunk that loads when the row mounts, so users without the package pay nothing.
 */
import { useEffect, useState } from 'react';

import { formatFileSize } from '../home/home-model';
import { m, useLocale } from '../i18n';
import { announce } from '../shell/announcer';
import { Button } from '../ui/Button';
import { confirm } from '../ui/sheet';
import { Line, NavRow, Row } from './rows';

const loadStore = () => import('../office/package-store');
const loadFlag = () => import('../office/flag');
const loadPackage = () => import('../office/package');

type State =
  | { readonly status: 'checking' }
  | { readonly status: 'hidden' }
  | { readonly status: 'shown'; readonly installed: boolean; readonly bytes: number };

export function OfficePackageRow() {
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: 'checking' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      let next: State = { status: 'hidden' };
      try {
        const [store, flag] = await Promise.all([loadStore(), loadFlag()]);
        const installed = await store.isPackageInstalled();
        if (installed || flag.officeEnabled()) {
          next = {
            status: 'shown',
            installed,
            bytes: installed ? await store.packageStoredBytes() : 0,
          };
        }
      } catch {
        // The chunk could not load: no row.
      }
      if (live) setState(next);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (state.status !== 'shown') return null;

  const remove = async () => {
    const yes = await confirm({
      title: m.settings_office_remove_title(),
      body: m.settings_office_remove_body(),
      action: m.settings_office_remove(),
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    try {
      await (await loadStore()).removePackage();
      setState({ status: 'shown', installed: false, bytes: 0 });
      announce(m.settings_office_removed());
    } catch {
      announce(m.settings_office_remove_failed(), { politeness: 'assertive' });
    }
    setBusy(false);
  };

  return (
    <Row id="officePackage" bar>
      <Line
        label={m.settings_office_package()}
        value={
          state.installed
            ? m.settings_office_package_size({ size: formatFileSize(state.bytes, locale) })
            : m.settings_office_package_removed()
        }
      >
        <Button
          variant="standard"
          busy={busy}
          disabled={!state.installed}
          aria-label={m.settings_office_remove_label()}
          onClick={() => void remove()}
          data-testid="settings-office-remove"
        >
          {m.settings_office_remove()}
        </Button>
      </Line>
    </Row>
  );
}

/** The stored notice as a text blob URL, or the served one when the package is not stored. */
export async function officeNoticeUrl(): Promise<string> {
  const pkg = await loadPackage();
  try {
    const cache = await caches.open(pkg.OFFICE_CACHE);
    const stored = await cache.match(pkg.noticeUrl());
    if (stored !== undefined) {
      const text = await stored.text();
      return URL.createObjectURL(new Blob([text], { type: 'text/plain; charset=utf-8' }));
    }
  } catch {
    // Cache Storage is unavailable: the served copy.
  }
  return pkg.noticeUrl();
}

/** About's "Conversion package licences": opens the notice in a new tab. */
export function OfficeLicencesRow() {
  return (
    <NavRow
      id="aboutOfficeLicences"
      label={m.about_office_licences()}
      onPress={() => {
        // The tab opens in the click's own turn (popup rules), then goes to the notice.
        const tab = window.open('', '_blank');
        if (tab) tab.opener = null;
        void officeNoticeUrl().then((url) => {
          if (tab) tab.location.href = url;
          else window.open(url, '_blank');
        });
      }}
    />
  );
}
