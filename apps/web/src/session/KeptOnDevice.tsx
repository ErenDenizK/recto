/**
 * "Kept on this device" (ADR-0032 §2.7, §3: "the list, the sizes and Clear are one step from
 * the privacy popover"; spec redesign D0-7): what the snapshots hold, open documents first,
 * then closed ones for Recents, each with its size, the total, and **Clear**, which deletes
 * every snapshot on this device after one inline confirmation. Final: nothing comes back
 * after a reload, and a write already under way finishes before the deletion runs.
 *
 * Honesty lines (FB9): a private window keeps nothing; storage the browser may clear; iPhone
 * and iPad keep it only while the browser does.
 */
import { useId, useState } from 'react';

import { formatFileSize } from '../home/home-model';
import { m, useLocale } from '../i18n';
import { announce } from '../shell/announcer';
import styles from './KeptOnDevice.module.css';
import { clearKeptChanges } from './session';
import { useSessionStore } from './session-store';

/** iPhone and iPad (iPadOS reports a Mac with touch). */
function isAppleMobile(nav: Navigator = navigator): boolean {
  return (
    /iPhone|iPad|iPod/.test(nav.userAgent) ||
    (nav.userAgent.includes('Macintosh') && nav.maxTouchPoints > 1)
  );
}

export function KeptOnDevice() {
  const keeping = useSessionStore((s) => s.keeping);
  const persisted = useSessionStore((s) => s.persisted);
  const items = useSessionStore((s) => s.items);
  const totalBytes = useSessionStore((s) => s.totalBytes);
  const writeFailed = useSessionStore((s) => s.writeFailed);
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingId = useId();

  const clear = async () => {
    setConfirming(false);
    const ok = await clearKeptChanges();
    setFailed(!ok);
    if (ok) announce(m.privacy_kept_cleared());
    else announce(m.privacy_kept_clear_failed(), { politeness: 'assertive' });
  };

  return (
    <section className={styles.section} aria-labelledby={headingId} data-testid="privacy-kept">
      <h3 id={headingId} className={styles.heading}>
        {m.privacy_kept_heading()}
      </h3>
      {keeping === 'unavailable' ? (
        <p className={styles.honesty} role="note">
          <span className={styles.mark} aria-hidden="true" />
          {m.session_not_kept()}
        </p>
      ) : (
        <>
          <p className={styles.value}>{m.privacy_kept_body()}</p>
          {items.length > 0 ? (
            <ul className={styles.list} data-testid="privacy-kept-list">
              {items.map((item) => (
                <li key={`${item.state}:${item.id}`} className={styles.row}>
                  <span className={styles.name} title={item.title}>
                    {item.title}
                  </span>
                  <span className={styles.meta}>
                    {item.state === 'open' ? m.privacy_kept_open() : m.privacy_kept_closed()}
                    {' · '}
                    {formatFileSize(item.bytes, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.value} data-testid="privacy-kept-empty">
              {m.privacy_kept_none()}
            </p>
          )}
          {persisted === false || isAppleMobile() ? (
            <p className={styles.honesty} role="note">
              <span className={styles.mark} aria-hidden="true" />
              {isAppleMobile() ? m.privacy_kept_ios() : m.privacy_kept_not_persistent()}
            </p>
          ) : null}
          {writeFailed ? (
            <p className={styles.honesty} role="note">
              <span className={styles.mark} aria-hidden="true" />
              {m.privacy_kept_write_failed()}
            </p>
          ) : null}
          {failed ? <p className={styles.honesty}>{m.privacy_kept_clear_failed()}</p> : null}
          {confirming ? (
            <div className={styles.confirm} role="group" aria-label={m.privacy_kept_confirm()}>
              <p className={styles.value}>{m.privacy_kept_confirm()}</p>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={styles.button}
                  data-tone="danger"
                  data-testid="privacy-kept-delete"
                  onClick={() => void clear()}
                >
                  {m.privacy_kept_delete()}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setConfirming(false)}
                >
                  {m.common_cancel()}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.footer}>
              <span className={styles.total}>
                {m.privacy_kept_total({ size: formatFileSize(totalBytes, locale) })}
              </span>
              <button
                type="button"
                className={styles.button}
                data-tone="danger"
                data-testid="privacy-kept-clear"
                disabled={totalBytes === 0 && items.length === 0}
                onClick={() => setConfirming(true)}
              >
                {m.privacy_kept_clear()}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
