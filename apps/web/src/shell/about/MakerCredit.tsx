/**
 * The maker's credits line, the last line of About (family README §4 move 3; the family kit's
 * mark/README.md "The credits line", option A; owner, 2026-10-10): "Made by edk." in Recto's
 * own type at footnote size, the lead-in in secondary ink, the letters in primary ink, and the
 * dot drawn as a circle in the accent (lime on dark, its light-theme line colour on light,
 * `--accent-ring`, so it stays at least 3:1 on either ground). It appears only at exits, the
 * About surfaces, never in working UI. The whole line is one plain link to the maker's
 * portfolio in a new tab; its accessible name starts with the visible words (WCAG 2.5.3).
 */
import { m } from '../../i18n';
import { MAKER_URL } from './build-info';
import styles from './MakerCredit.module.css';

export function MakerCredit({ className }: { readonly className?: string | undefined }) {
  return (
    <p className={className ? `${styles.credit} ${className}` : styles.credit}>
      <a
        className={styles.link}
        href={MAKER_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={m.about_maker_label()}
        data-testid="about-maker"
      >
        {m.about_maker_by()} <span className={styles.mark}>edk</span>
        <span className={styles.dot} aria-hidden="true" />
      </a>
    </p>
  );
}
