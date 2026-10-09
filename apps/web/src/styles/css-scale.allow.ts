/**
 * The scale gate's ratchet (`css-scale.test.ts`; system-audit-2026-10 §3.11 gate 1): each
 * style sheet's literals off the token scales, counted per kind, as they stood when the gate
 * arrived. It may only shrink: when a lane moves a file onto the tokens, it lowers or deletes
 * that file's line. One line per file, so lanes rebasing onto each other touch separate lines.
 */
import type { ScaleKind } from './css-scale';

export const CSS_SCALE_ALLOW: Readonly<Record<string, Partial<Record<ScaleKind, number>>>> = {
  'annotations/lasso/Lasso.module.css': { radius: 1, duration: 1, stroke: 5 },
  'annotations/pen/PenWell.module.css': { radius: 2 },
  'batch/Batch.module.css': { 'font-size': 1, icon: 2 },
  'document/DocumentTools.module.css': { weight: 1, icon: 2, spacing: 1 },
  'export/ExportDialog.module.css': { radius: 1, uppercase: 1, spacing: 1 },
  'forms/FormLayer.module.css': { icon: 2, spacing: 2 },
  'forms/create/CreatedFields.module.css': { icon: 4 },
  'image-objects/ImageObjects.module.css': { icon: 2 },
  'markup/InkStrip.module.css': { 'font-size': 1 },
  'markup/MarkupPalette.module.css': { uppercase: 1, spacing: 1 },
  'redaction/ApplySheet.module.css': { weight: 1 },
  'redaction/RedactionLayer.module.css': { stroke: 4 },
  'shell/CommandPalette.module.css': { stroke: 1 },
  'shell/frame/SaveButton.module.css': { duration: 4, spacing: 1 },
  'shell/frame/TopStrip.module.css': { stroke: 1 },
  'signatures/SignaturePlate.module.css': { spacing: 1 },
  'signatures/Signatures.module.css': { weight: 2, icon: 4, spacing: 1 },
  'tools/ToolDialog.module.css': { radius: 1, spacing: 1 },
  'ui/Avatar.module.css': { icon: 2 },
  'ui/Badge.module.css': { spacing: 1 },
  'ui/Chip.module.css': { stroke: 1 },
  'ui/Field.module.css': { radius: 1 },
  'ui/Keycaps.module.css': { spacing: 2 },
  'ui/Notice.module.css': { weight: 1 },
  'ui/NumberField.module.css': { radius: 1, icon: 2, spacing: 1 },
  'ui/ScrollArea.module.css': { radius: 1 },
  'ui/Switch.module.css': { icon: 2 },
  'ui/Toast/Toast.module.css': { spacing: 1 },
  'ui/colour/ColourGrid.module.css': { spacing: 1 },
};
