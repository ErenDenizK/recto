/**
 * "On this device" (DSN-92; Colophon plan L2): the Home strip's privacy status, a lock glyph
 * and 12 px tertiary text. It is the privacy popover's trigger (`PrivacyShield`, `status`
 * form); once the monitor counts an external request it turns to the warning state, a
 * shield-warning with the count.
 */
import { PrivacyShield } from '../../privacy/PrivacyShield';

export function LocalStatus() {
  return <PrivacyShield form="status" />;
}
