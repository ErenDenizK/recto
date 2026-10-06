/**
 * The privacy shield ◎ (`components/01-frame.md` F8; ARCHITECTURE.md §7): keeps the product's
 * promise in sight. A 32 / 44 px circle in the strip with `shield-check`; with external
 * requests, `shield-warning` in the warning colour and a count badge (the count is in the
 * name too, never alone). It opens the privacy popover (`04-context` §17, spec X29): the
 * observed external URLs (expected: none), the CSP in one sentence plus the enforced
 * `connect-src`, the service worker's offline status, Recents with "Clear recents" (craft
 * §3.1), what is kept on this device with Clear (ADR-0032 §2.7), and the app version, which
 * opens Settings → About Recto (ADR-0017 §6; 07-sheets §25). It replaces the status bar's
 * "Local only · No external requests" (15.1.2). The title menu's privacy line opens it too
 * (`openPrivacyShield`).
 */
import { Popover } from '@base-ui/react/popover';
import { useRef } from 'react';
import { create } from 'zustand';

import { commandRegistry } from '../commands/registry';
import { formatNumber, m } from '../i18n';
import { usePwaStore } from '../pwa/register';
import { serviceWorkerLabel } from '../pwa/service-worker-label';
import { BUILD_INFO } from '../shell/about/build-info';
import { KeptOnDevice } from '../session/KeptOnDevice';
import { openSettings } from '../settings/open-settings';
import { PopoverBody, PopoverHeader, PopoverPopup } from '../ui/Popover';
import { Tooltip } from '../ui/Tooltip';
import { documentCsp, parseCsp } from './csp';
import { useExternalRequests } from './external-requests';
import styles from './PrivacyShield.module.css';
import { Icon } from '../ui/Icon';

/** The enforced `connect-src`, read from the page itself rather than restated. */
function connectSrc(): string | undefined {
  const policy = documentCsp();
  const sources = policy === undefined ? undefined : parseCsp(policy).get('connect-src');
  return sources === undefined ? undefined : `connect-src ${sources.join(' ')}`;
}

const usePrivacyOpen = create<{ open: boolean }>()(() => ({ open: false }));

/** Opens the shield's popover (the title menu's privacy line, F5). */
export function openPrivacyShield(): void {
  usePrivacyOpen.setState({ open: true });
}

export function PrivacyShield({ className }: { readonly className?: string }) {
  const { count, urls } = useExternalRequests();
  const swStatus = usePwaStore((s) => s.status);
  const updateAvailable = usePwaStore((s) => s.updateAvailable);
  const open = usePrivacyOpen((s) => s.open);
  const clean = count === 0;
  const directive = connectSrc();
  const name = clean ? m.frame_privacy_clean() : m.frame_privacy_external({ count });
  // Settings returns focus here: the version button closes with the popover.
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={(next) => usePrivacyOpen.setState({ open: next })}>
      <Tooltip label={name}>
        <Popover.Trigger
          ref={triggerRef}
          className={[styles.trigger, className].filter(Boolean).join(' ')}
          aria-label={name}
          aria-haspopup="dialog"
          data-state={clean ? 'clean' : 'external'}
          data-testid="privacy-indicator"
        >
          {clean ? (
            <Icon name="shield-check" aria-hidden="true" />
          ) : (
            <Icon name="shield-warning" aria-hidden="true" />
          )}
          {clean ? null : (
            <span className={styles.badge} aria-hidden="true">
              {formatNumber(count)}
            </span>
          )}
        </Popover.Trigger>
      </Tooltip>
      <PopoverPopup
        side="bottom"
        align="end"
        className={styles.popup}
        positionerClassName={styles.positioner}
      >
        <PopoverHeader title={clean ? m.privacy_title_clean() : m.privacy_title_external()} />
        <PopoverBody>{m.privacy_body()}</PopoverBody>

        {/* Recents are kept on this device only and can always be cleared (craft §3.1). */}
        <p className={`${styles.value} ${styles.recents}`} data-testid="privacy-recents">
          <span>
            {m.privacy_recents()}{' '}
            <Popover.Close
              className={styles.inlineLink}
              onClick={() => void commandRegistry.execute('file.clearRecents')}
            >
              {m.recents_clear()}
            </Popover.Close>
          </span>
        </p>

        {/* Snapshots of open and closed documents, with Clear (ADR-0032 §2.7). */}
        <KeptOnDevice />

        <section className={styles.section} aria-label={m.privacy_requests_heading()}>
          <h3 className={styles.heading}>{m.privacy_requests_heading()}</h3>
          {urls.length > 0 ? (
            <ul className={styles.urls} data-testid="external-urls">
              {urls.map((url) => (
                <li key={url} title={url}>
                  {url}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.value}>{m.privacy_requests_none()}</p>
          )}
        </section>

        <section className={styles.section} aria-label={m.privacy_csp_heading()}>
          <h3 className={styles.heading}>{m.privacy_csp_heading()}</h3>
          <p className={styles.value}>{m.privacy_csp_body()}</p>
          {directive ? <code className={styles.code}>{directive}</code> : null}
        </section>

        <section className={styles.section} aria-label={m.privacy_offline_heading()}>
          <h3 className={styles.heading}>{m.privacy_offline_heading()}</h3>
          <p className={styles.value} data-testid="sw-status" data-status={swStatus}>
            <span className={styles.swMark} data-status={swStatus} aria-hidden="true" />
            {serviceWorkerLabel(swStatus, updateAvailable)}
          </p>
        </section>

        <section className={styles.section}>
          <Popover.Close
            className={styles.version}
            aria-haspopup="dialog"
            data-testid="privacy-version"
            onClick={() => openSettings({ row: 'about' }, { returnTo: triggerRef.current })}
          >
            {m.about_version_line({ version: BUILD_INFO.version })}
          </Popover.Close>
        </section>
      </PopoverPopup>
    </Popover.Root>
  );
}
