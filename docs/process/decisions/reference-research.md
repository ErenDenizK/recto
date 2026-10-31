# Decisions: Reference research

How Recto studies other products and open-source projects (research 25 on). Ids ART-n belong to this area.

| # | Decision | Date | Source | Status |
|---|---|---|---|---|
| ART-1 | **Reference research learns ideas, never copies.** Other products are studied only through legitimately available material: open-source code under its licence, the product's own public documents, papers and articles. No reverse engineering of closed products (no decompiling, no EULA-violating analysis), no copying of their code, layout, names or trade dress into Recto; a permissive licence does not change this. External code is cloned into a new empty folder outside the repository and read; it is built or run only when that installs no unknown software, otherwise only with the owner's approval. Every report separates generic engineering (fine to adopt, rebuilt from Recto's own specs) from product-specific design (avoid). | 2026-10-26 | Owner, conversation (research brief for the PdfCraft study); `docs/research/25-artcraft-pdf.md` | In force |
