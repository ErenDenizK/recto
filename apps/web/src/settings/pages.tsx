/**
 * The pages the Settings sheet pushes (components/07-sheets.md S3 §2, §6; the S0 page stack):
 *
 * - **Kept documents** (ADR-0032 §2.7; D0-7's snapshots): open documents first, then closed
 *   ones kept for Recents, each with its size, the total, the honesty lines of FB9, and
 *   **Clear all…**, which asks once (S1, a danger action that cannot be undone) and then
 *   deletes every snapshot on this device. Per-row Clear waits for a per-snapshot delete in
 *   the session module.
 * - **Privacy:** what never leaves the device, the live count of requests to other sites with
 *   their addresses, the enforced `connect-src`, and the offline status.
 * - **About Recto** (the About dialog's facts, ADR-0017 §6, 07 §25): name and release state,
 *   "Files never leave your device.", version, build commit and date, licence, release notes,
 *   source, storage in use, offline status, and the About page beside the app (F§2.1). Nothing
 *   here makes a network request: the links are plain anchors and storage use comes from
 *   `navigator.storage.estimate()`.
 *
 * D0-11 adds the Saved signatures page here (see `search-index.ts`).
 */
import { useEffect, useState } from 'react';

import { formatFileSize } from '../home/home-model';
import { formatBytes } from '../files/file-filters';
import { getLocale, m, useLocale } from '../i18n';
import { documentCsp, parseCsp } from '../privacy/csp';
import { useExternalRequests } from '../privacy/external-requests';
import { usePwaStore } from '../pwa/register';
import { serviceWorkerLabel } from '../pwa/service-worker-label';
import { clearKeptChanges } from '../session/session';
import { useSessionStore } from '../session/session-store';
import { AppGlyph } from '../shell/AppGlyph';
import { announce } from '../shell/announcer';
import {
  BUILD_INFO,
  type BuildInfo,
  LICENSE_ID,
  PRODUCT_NAME,
  REPOSITORY_URL,
} from '../shell/about/build-info';
import { Button } from '../ui/Button';
import { confirm } from '../ui/sheet';
import { Line, NavRow, Row, Section } from './rows';
import styles from './Settings.module.css';

/** iPhone and iPad (iPadOS reports a Mac with touch). */
function isAppleMobile(nav: Navigator = navigator): boolean {
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.userAgent.includes('Macintosh') && nav.maxTouchPoints > 1)
  );
}

function Note({ children }: { readonly children: string }) {
  return (
    <p className={styles.note} role="note">
      <span className={styles.mark} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function KeptPage() {
  const keeping = useSessionStore((s) => s.keeping);
  const persisted = useSessionStore((s) => s.persisted);
  const items = useSessionStore((s) => s.items);
  const totalBytes = useSessionStore((s) => s.totalBytes);
  const writeFailed = useSessionStore((s) => s.writeFailed);
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (keeping === 'unavailable') {
    return (
      <div className={styles.page} data-page="kept">
        <Note>{m.session_not_kept()}</Note>
      </div>
    );
  }

  const clearAll = async () => {
    const yes = await confirm({
      title: m.settings_kept_confirm_title(),
      body: m.settings_kept_confirm_body(),
      action: m.settings_clear(),
      danger: true,
    });
    if (!yes) return;
    setBusy(true);
    const ok = await clearKeptChanges();
    setBusy(false);
    setFailed(!ok);
    if (ok) announce(m.privacy_kept_cleared());
    else announce(m.privacy_kept_clear_failed(), { politeness: 'assertive' });
  };

  return (
    <div className={styles.page} data-page="kept">
      <p className={styles.statement}>{m.privacy_kept_body()}</p>
      {items.length > 0 ? (
        <Section title={null} label={m.settings_kept_documents()}>
          {items.map((item) => (
            <Row key={`${item.state}:${item.id}`} id={`kept:${item.id}`}>
              <div className={styles.line}>
                <span className={styles.keptName} title={item.title}>
                  {item.title}
                </span>
                <span className={styles.value}>
                  {item.state === 'open' ? m.privacy_kept_open() : m.privacy_kept_closed()}
                  {' · '}
                  {formatFileSize(item.bytes, locale)}
                </span>
              </div>
            </Row>
          ))}
        </Section>
      ) : (
        <p className={styles.empty} data-testid="settings-kept-empty">
          {m.settings_kept_none()}
        </p>
      )}
      {persisted === false || isAppleMobile() ? (
        <Note>{isAppleMobile() ? m.privacy_kept_ios() : m.privacy_kept_not_persistent()}</Note>
      ) : null}
      {writeFailed ? <Note>{m.privacy_kept_write_failed()}</Note> : null}
      {failed ? <Note>{m.privacy_kept_clear_failed()}</Note> : null}
      <div className={styles.actions} data-bar="settings-row">
        <span>{m.privacy_kept_total({ size: formatFileSize(totalBytes, locale) })}</span>
        <Button
          variant="danger"
          busy={busy}
          disabled={totalBytes === 0 && items.length === 0}
          onClick={() => void clearAll()}
          data-testid="settings-kept-clear"
        >
          {m.settings_kept_clear_all()}
        </Button>
      </div>
    </div>
  );
}

/** The enforced `connect-src`, read from the page itself rather than restated. */
function connectSrc(): string | undefined {
  const policy = documentCsp();
  const sources = policy === undefined ? undefined : parseCsp(policy).get('connect-src');
  return sources === undefined ? undefined : `connect-src ${sources.join(' ')}`;
}

export function PrivacyPage() {
  const { count, urls } = useExternalRequests();
  const swStatus = usePwaStore((s) => s.status);
  const updateAvailable = usePwaStore((s) => s.updateAvailable);
  const directive = connectSrc();
  return (
    <div className={styles.page} data-page="privacy">
      <p className={styles.statement}>{m.settings_privacy_statement()}</p>
      <Section title={null} label={m.settings_section_privacy()}>
        <Row id="privacyRequests">
          <Line
            label={m.settings_privacy_requests()}
            value={count === 0 ? m.settings_privacy_none() : String(count)}
          />
          {urls.length > 0 ? (
            <ul className={styles.code} data-testid="settings-external-urls">
              {urls.map((url) => (
                <li key={url} title={url}>
                  {url}
                </li>
              ))}
            </ul>
          ) : null}
        </Row>
        <Row id="privacyOffline">
          <Line
            label={m.privacy_offline_heading()}
            value={serviceWorkerLabel(swStatus, updateAvailable)}
          />
        </Row>
        <Row id="privacyCsp">
          <Line label={m.privacy_csp_heading()} />
          <p className={styles.hint}>{m.privacy_csp_body()}</p>
          {directive ? <code className={styles.code}>{directive}</code> : null}
        </Row>
      </Section>
    </div>
  );
}

type StorageUsage =
  | { readonly status: 'measuring' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ready'; readonly usage: number };

function storageText(storage: StorageUsage): string {
  switch (storage.status) {
    case 'measuring':
      return m.about_storage_measuring();
    case 'unavailable':
      return m.about_storage_unavailable();
    case 'ready':
      return formatBytes(storage.usage);
  }
}

/** `navigator.storage` is missing outside secure contexts and in some older browsers. */
function storageManager(): StorageManager | undefined {
  const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
  return typeof storage?.estimate === 'function' ? storage : undefined;
}

/** This origin's storage use (caches, IndexedDB, OPFS), measured each time the page opens. */
function useStorageUsage(): StorageUsage {
  const [usage, setUsage] = useState<StorageUsage>(() =>
    storageManager() ? { status: 'measuring' } : { status: 'unavailable' },
  );
  useEffect(() => {
    const storage = storageManager();
    if (!storage) return;
    let live = true;
    storage.estimate().then(
      (estimate) => {
        if (!live) return;
        setUsage(
          estimate.usage === undefined
            ? { status: 'unavailable' }
            : { status: 'ready', usage: estimate.usage },
        );
      },
      () => {
        if (live) setUsage({ status: 'unavailable' });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return usage;
}

/** The build date in the UI language, e.g. "1 October 2026" / "1 Ekim 2026". */
function formatBuildDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(date);
}

/** The about page, `about/` under the deployment base (a sibling of the app, F§2.1). */
function aboutPageUrl(): string {
  return new URL('about/', new URL(import.meta.env.BASE_URL, location.href)).href;
}

/** `info` defaults to this build; tests pass their own for release and pre-release versions. */
export function AboutPage({ info = BUILD_INFO }: { readonly info?: BuildInfo }) {
  const storage = useStorageUsage();
  const swStatus = usePwaStore((s) => s.status);
  const updateAvailable = usePwaStore((s) => s.updateAvailable);
  return (
    <div className={styles.page} data-page="about" data-testid="settings-about">
      <div className={styles.aboutHead}>
        <AppGlyph size={20} />
        <span className={styles.aboutName}>{PRODUCT_NAME}</span>
        {info.isPreRelease ? (
          <span className={styles.badge} data-testid="about-prerelease">
            {m.about_public_beta()}
          </span>
        ) : null}
      </div>
      <p className={styles.statement}>{m.about_files_local()}</p>
      <Section title={null} label={m.about_command({ name: PRODUCT_NAME })}>
        <Row id="aboutVersion">
          <Line
            label={m.about_version()}
            value={<span data-testid="about-version">{info.version}</span>}
          />
        </Row>
        <Row id="aboutCommit">
          <Line
            label={m.about_commit()}
            value={
              <span className={styles.mono} data-testid="about-commit">
                {info.commit}
              </span>
            }
          />
        </Row>
        <Row id="aboutBuildDate">
          <Line
            label={m.about_build_date()}
            value={
              <time dateTime={info.buildDate} data-testid="about-build-date">
                {formatBuildDate(info.buildDate)}
              </time>
            }
          />
        </Row>
        <Row id="aboutLicence">
          <Line
            label={m.about_license()}
            value={<span data-testid="about-license">{LICENSE_ID}</span>}
          />
        </Row>
        <Row id="aboutStorage">
          <Line
            label={m.about_storage()}
            value={
              <span data-testid="about-storage" data-status={storage.status}>
                {storageText(storage)}
              </span>
            }
          />
        </Row>
        <Row id="aboutOffline">
          <Line
            label={m.about_offline()}
            value={
              <span data-testid="about-offline" data-status={swStatus}>
                {serviceWorkerLabel(swStatus, updateAvailable)}
              </span>
            }
          />
        </Row>
      </Section>
      <Section title={null} label={m.about_release_notes()}>
        <NavRow
          id="aboutReleaseNotes"
          label={m.about_release_notes()}
          href={info.releaseNotesUrl}
        />
        <NavRow id="aboutSource" label={m.about_source()} href={REPOSITORY_URL} />
        <NavRow id="aboutPage" label={m.menu_about_page()} href={aboutPageUrl()} />
      </Section>
    </div>
  );
}
