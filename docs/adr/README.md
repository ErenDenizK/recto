# Architecture Decision Records

Each significant, hard-to-reverse decision gets one file: `NNNN-short-title.md`.
Format: Context → Decision → Consequences → Alternatives considered. Status is one of
`proposed`, `accepted`, `superseded by NNNN`, `deprecated`. A proposed ADR becomes accepted
only after discussion with the project owner; the discussion summary is appended.

| # | Title | Status |
|---|---|---|
| [0001](0001-license.md) | Project license | accepted, amended by 0035 |
| [0002](0002-engine-stack.md) | PDF engine stack | accepted |
| [0003](0003-frontend-stack.md) | Frontend stack | accepted |
| [0004](0004-hosting-and-isolation.md) | Static hosting, workers and no cross-origin isolation | accepted, amended by 0035 |
| [0005](0005-virtual-document-model.md) | Virtual document model and history | accepted |
| [0006](0006-branching-and-versioning.md) | Branching, versioning and commit conventions | accepted |
| [0007](0007-delivery-targets.md) | Delivery targets: web first, desktop as escalation path | accepted, amended by 0034 |
| [0008](0008-qpdf-deferred.md) | qpdf integration deferred to M3 and built from source | accepted |
| [0009](0009-headless-primitives.md) | Headless accessibility primitives: Base UI | accepted |
| [0010](0010-i18n-and-pwa.md) | i18n with Paraglide JS and offline PWA with vite-plugin-pwa | accepted |
| [0011](0011-engine-hosting-for-content-editing.md) | Engine hosting for content editing: own PDFium worker, raw access | accepted |
| [0012](0012-ocr-hosting-and-language-packs.md) | OCR engine hosting and language packs | accepted |
| [0013](0013-signature-validation-and-signing.md) | Signature validation semantics and PAdES-B signing | accepted |
| [0014](0014-recipe-format.md) | Batch recipe file format | accepted |
| [0015](0015-product-name.md) | Product name: Recto | accepted |
| [0016](0016-addresses-and-migration.md) | Addresses: portfolio root, project paths, custom domain and migration | accepted (GitHub Pages only for now) |
| [0017](0017-versioning-and-releases.md) | Versioning and public releases: `1.0.0-beta.N` first | accepted |
| [0018](0018-variable-width-ink.md) | Variable-width ink as a standard Ink annotation with our appearance | accepted |
| [0019](0019-document-modes.md) | Home as a view, documents in Read or Edit, Arrange as a view | accepted |
| [0020](0020-paragraph-text-editing.md) | Paragraph text editing: Tier B now, Tier C later, no cross-page reflow | accepted |
| [0021](0021-one-highlighter-lasso-palette.md) | One Highlighter, a lasso for every kind, one ink palette | accepted |
| [0022](0022-recto-glass-design-language.md) | Recto Glass: content solid, controls glass, light beneath | accepted |
| [0023](0023-colour-roles-one-lime.md) | Colour roles: one lime for interaction, a blue for selection on the page | accepted |
| [0024](0024-glass-materials-and-setting.md) | Glass materials: five densities, lit glass, a coverage rule and one setting | accepted |
| [0025](0025-light-aurora.md) | Light: an in-house aurora that answers events | accepted |
| [0026](0026-motion-springs-no-library.md) | Motion: springs on platform routes, no animation library | accepted |
| [0027](0027-type-and-icons.md) | Type and icons: an Inter Recto subset and Phosphor built at compile time | accepted |
| [0028](0028-accessibility-gates-expressive-ui.md) | Accessibility gates for an expressive interface | accepted |
| [0029](0029-viewing-markup-and-lock.md) | Viewing with targeted acts, one Markup state, Lock, and the Pages grid | accepted |
| [0030](0030-can-change-guard.md) | One change guard, `canChange(id, act)`, with Lock enforced in `commit()` | accepted |
| [0031](0031-size-class-shell.md) | The size-class shell: top strip, dock, sidebar, sheets, page pill, Library | accepted |
| [0032](0032-saving-restore-history.md) | Saving, restore and history: Save in place, snapshots on the device, visible Undo | accepted |
| [0033](0033-compact-edition.md) | Two editions: the full app on desktops and tablets, a compact edition on phones (read-only until ADR-0034) | accepted, amended by 0034 |
| [0034](0034-editions.md) | Editions: the full app on desktops and tablets, an editable phone edition, desktop later | accepted |
| [0035](0035-on-device-office-conversion.md) | On-device Office to PDF with LibreOffice, downloaded on consent | accepted |
