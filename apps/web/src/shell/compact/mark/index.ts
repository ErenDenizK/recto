/**
 * Phone editing's lazy chunk (`design/phone-2026-10/README.md`; code-audit §4c), loaded by
 * `../mark-host.ts`: the edit island, the tool drawer, the bridge to the editing gate, the tool
 * registry and the page layers. Loading it registers the built-in tools and puts the dry ink
 * and annotation layers into the page overlay slot that `CompactPage` renders while editing (`AnnotationLayer` is imported directly, never `annotations/index.ts`, whose imports
 * bring redaction, image objects and signatures).
 *
 * Lanes: register a tool with `registerCompactTool` (`registry.ts`), and a page layer with
 * `registerCompactOverlay`, from a module this file imports, or a lazier one your tool's `arm`
 * loads.
 *
 * Form filling (MOB-1) is a chunk of its own, `./fields/`, fetched as this one arrives.
 *
 * `SelectionHost` (`../selection-host.tsx`, static, mounted by `CompactChrome`) watches for a
 * page text selection and loads the selection bar, which brings this chunk, on the first one.
 */
import { AnnotationLayer } from '../../../annotations/AnnotationLayer';
import { DryInkLayer } from '../../../annotations/pen/DryInkLayer';
import { registerCompactOverlay } from '../mark-host';
import './tools';
import './text-tool';
// Lane D: Sign over its stub, and the phone's touch selection chrome.
import './sign';
import './touch-chrome';
// WP5: Edit text; its editors load as the tool arms.
import './edit-text';

// The dry ink under the annotation layer, whose wet canvas sits above it (as in Read mode).
registerCompactOverlay(DryInkLayer);
registerCompactOverlay(AnnotationLayer);

// MOB-1: the form field layer, its own chunk, fetched now; it mounts in reading too.
void import('./fields').catch(() => undefined);

export { enterEditing, exitEditing } from './bridge';
export { registerCompactOverlay } from '../mark-host';
export { morphCapsule } from './capsule-morph';
export { EditIsland } from './EditIsland';
export { type CompactToolSpec, registerCompactTool } from './registry';
export { SignHost } from './sign';
export { ToolDrawer } from './ToolDrawer';
