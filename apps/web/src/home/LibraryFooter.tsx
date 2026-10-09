/**
 * The Library footer (`02-library` L12): two pieces at the window's bottom corners, on the
 * strip's inset and height (system-audit-2026-10 §3.1, §3.3: a piece holds M controls, it never
 * makes them taller). Leading, "● Nothing is uploaded", which opens the privacy popover (and
 * reads "1 external request" with the warning colour if the monitor ever counts one); trailing,
 * the visible language switch
 * "English · Türkçe", each name in its own language (FL-R10, INV-20), which switches at once,
 * saves per device and is announced in the new language (the palette's Language commands).
 */
import { commandRegistry } from '../commands/registry';
import { m, useLocale } from '../i18n';
import { type Locale, LOCALE_NAMES, locales } from '../i18n/locale';
import { PrivacyShield } from '../privacy/PrivacyShield';
import { Segmented } from '../ui/Segmented';
import styles from './LibraryFooter.module.css';

export function LibraryFooter() {
  const locale = useLocale();
  return (
    <footer className={styles.footer} data-testid="library-footer">
      <PrivacyShield variant="chip" className={styles.privacy} />
      <div className={styles.piece}>
        <Segmented<Locale>
          value={locale}
          label={m.library_language()}
          className={styles.language}
          options={locales.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
          onValueChange={(value) => void commandRegistry.execute(`language.${value}`)}
        />
      </div>
    </footer>
  );
}
