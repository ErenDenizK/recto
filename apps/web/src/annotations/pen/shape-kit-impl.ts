/**
 * The lazily loaded half of `shape-kit.ts`: one chunk for the recogniser (`shapes.ts`) and the
 * morph (`shape-hold.ts`), which import nothing of the editor but the motion core.
 */
export { MORPH_POINTS, morphTarget, ShapeHold } from './shape-hold';
export { recognizeShape, resample } from './shapes';
