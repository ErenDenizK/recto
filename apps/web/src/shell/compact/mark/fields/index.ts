/**
 * Phone form filling's chunk (MOB-1; research phone-2026-10/forms.md §2): loaded by the edit
 * chunk (`../index.ts`) as soon as that arrives, so the fields of a page take a tap in
 * reading within moments of opening, never on the static compact path. Puts the field layer
 * into the page overlay slot for reading and editing alike.
 */
import { registerCompactOverlay } from '../../mark-host';
import { FieldLayer } from './FieldLayer';

registerCompactOverlay(FieldLayer, { reading: true });
