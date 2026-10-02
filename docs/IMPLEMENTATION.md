# Decorio dedicated demo

Upstream base: `office-360design/configurator-360@83376ec`.
Fork: `MashhuMaximilian/configurator-decorio`, branch `codex/decorio-demo`.
Upstream checkout and its deployment are unchanged. Automatic GitHub Actions remain disabled.

## Local preview

Node >=20. `npm ci`, `npm run check`, `npm run dev`.
Open http://127.0.0.1:4173. Local preview supports JSON/CSV export, not cloud saves.

## Implemented

Romanian noindex app; 2D graph with explicit intersection nodes, free drawing, movement, numeric lengths, snapping, deletion, undo/redo; derived 3D and BOM from the same state; fixed modules retain size, unmatched lengths are gaps; rolls aggregate by SKU; kits count once. Product and catalog versions are mandatory in imported and shared state.

Public product inventory, sources, limitations and coverage are in `catalog/` and `docs/catalog-coverage.md`. The catalog includes both fixed sizes and explicitly published custom dimension ranges. Schematic representations do not certify exact decorative patterns or mounting. Unsupported compatibility is rejected. All BOMs currently remain preliminary; foundations and undocumented mounting components are not inferred.

## Verification still required before final acceptance

Exact product visual fidelity and mounting evidence review across all families; gate operating-space collision checks; accessory selection; Firebase tenant provisioning and real authenticated save/share/restore tests; production origin isolation; desktop/mobile and large-layout acceptance; dedicated cloud routing and rollback verification.

## Isolation

Build copies only an explicit allowlist of Decorio files and six shared Firebase/tenant modules. No other configurator, admin UI, Firebase Functions, rules or deployment workflow is bundled. The HTTP server accepts Decorio hosts, redirects .com/.de preserving the request URI, and adds noindex on all responses. Unknown hosts receive 421.

## Research reproduction

`scripts/inventory.py` captures public category and product pages. `scripts/download-evidence.py` archives public PDF links. Raw copyrighted pages/PDFs are ignored by Git and never deployed. `scripts/build-catalog.py` compiles sourced facts; `npm run catalog:report` updates the coverage report. Do not subscribe an email or bypass a catalog form to retrieve documents.
