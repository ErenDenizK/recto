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
 */
import { AnnotationLayer } from '../../../annotations/AnnotationLayer';
import { DryInkLayer } from '../../../annotations/pen/DryInkLayer';
import { registerCompactOverlay } from '../mark-host';
import './tools';
// Lane D: Sign over its stub, and the phone's touch selection chrome.
import './sign';
import './touch-chrome';

// The dry ink under the annotation layer, whose wet canvas sits above it (as in Read mode).
registerCompactOverlay(DryInkLayer);
registerCompactOverlay(AnnotationLayer);

export { enterEditing, exitEditing } from './bridge';
export { registerCompactOverlay } from '../mark-host';
export { morphCapsule } from './capsule-morph';
export { EditIsland } from './EditIsland';
export { type CompactToolSpec, registerCompactTool } from './registry';
export { SignHost } from './sign';
export { ToolDrawer } from './ToolDrawer';
