/**
 * Status-bar privacy indicator (ARCHITECTURE.md §7): the live external-request count, and a
 * popover with the observed external URLs (expected: none), the CSP in one sentence plus
 * the enforced `connect-src`, the service worker's offline status, and the app version,
 * which opens Settings → About Recto (ADR-0017 §6; 07-sheets §25). One line says Recents stay on this device, with
 * "Clear recents" (craft §3.1), and what is kept on this device with Clear (ADR-0032 §2.7).
 */
import { Popover } from '@base-ui/react/popover';
import { useRef } from 'react';

import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { usePwaStore } from '../pwa/register';
import { serviceWorkerLabel } from '../pwa/service-worker-label';
import { BUILD_INFO } from '../shell/about/build-info';
import { KeptOnDevice } from '../session/KeptOnDevice';
import { openSettings } from '../settings/open-settings';
import { PopoverBody, PopoverHeader, PopoverPopup } from '../ui/Popover';
import { documentCsp, parseCsp } from './csp';
import { useExternalRequests } from './external-requests';
import styles from './PrivacyIndicator.module.css';

/** The enforced `connect-src`, read from the page itself rather than restated. */
function connectSrc(): string | undefined {
  const policy = documentCsp();
  const sources = policy === undefined ? undefined : parseCsp(policy).get('connect-src');
  return sources === undefined ? undefined : `connect-src ${sources.join(' ')}`;
}

export function PrivacyIndicator({
  className,
  variant = 'status',
}: {
  readonly className?: string | undefined;
  /**
   * `status`: the status bar's line. `chip`: the Library footer's chip (`02-library` L12),
   * "Nothing is uploaded", or "1 external request" once the monitor counts one; the same
   * popover either way.
   */
  readonly variant?: 'status' | 'chip';
}) {
  const { count, urls } = useExternalRequests();
  const swStatus = usePwaStore((s) => s.status);
  const updateAvailable = usePwaStore((s) => s.updateAvailable);
  const clean = count === 0;
  const directive = connectSrc();
  // Settings returns focus here: the version button closes with the popover.
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Popover.Root>
      <Popover.Trigger
        ref={triggerRef}
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        data-state={clean ? 'clean' : 'external'}
        data-testid={variant === 'chip' ? 'library-privacy' : 'privacy-indicator'}
      >
        <span className={styles.mark} aria-hidden="true" />
        {variant === 'chip' ? (
          <span className={styles.numeric}>
            {clean ? m.library_nothing_uploaded() : m.library_external_requests({ count })}
          </span>
        ) : (
          <>
            <span>{m.privacy_local_only()}</span>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <span className={styles.numeric}>{m.privacy_external_requests({ count })}</span>
          </>
        )}
      </Popover.Trigger>
      <PopoverPopup
        side="top"
        align="start"
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
