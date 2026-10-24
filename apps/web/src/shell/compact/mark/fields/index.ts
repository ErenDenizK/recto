/**
 * Phone form filling's chunk (MOB-1; research phone-2026-10/forms.md §2): loaded by
 * `../../mark-host.ts` (`loadFields`) when a page with form fields comes near the view, and by the
 * edit chunk (`../index.ts`) as that arrives, so the fields of a page take a tap in reading
 * without the editing code (EDN-21), never on the static compact path. Puts the field layer into
 * the page overlay slot for reading and editing alike, after the editing layers (order 30).
 * Nothing here may import the edit chunk's modules (`eslint.config.js` fences it).
 */
import { registerCompactOverlay } from '../../mark-host';
import { FieldLayer } from './FieldLayer';

registerCompactOverlay(FieldLayer, { reading: true, order: 30 });
