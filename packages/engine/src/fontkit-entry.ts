/**
 * The build entry that emits fontkit once (`sharedFontkit` in vite.config.ts, R27 P2): the
 * assembler and analysis workers import it as `./fontkit.js` instead of bundling a copy each.
 */
export { default } from '@cantoo/fontkit';
