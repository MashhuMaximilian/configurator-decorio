# Acceptance evidence — 2026-10-02

This is an implementation draft, not final acceptance of the entire Decorio plan.

## Passed

- 21 automated tests: fixed modules/remainders; shared corner and branch posts; explicit crossings; overlaps; node movement/deletion; unsupported mixed systems; gate/panel space and swing/fence collision; corrupt/unknown/old states; JSON roundtrip; all published configurable variants; roll aggregation; kit non-duplication; CSV escaping; custom bounds; 100-segment model; build and deployment isolation.
- Desktop browser render and numerical segment editing.
- Mobile layout in a 390 × 844 iframe: document width equals viewport width, no horizontal overflow; corrected camera framing. This checks layout, not physical-device touch behavior.
- Browser imported `output/acceptance-project.json`. Browser-exported JSON matched the original parsed state exactly. Browser-downloaded CSV matched `output/acceptance-components.csv` byte-for-byte.
- Two ready Cloud Run revisions provide a Decorio-only rollback target. Additional revisions retain the same isolation controls.
- Live URL map comparison: original default service, host rules and path matchers unchanged; only three exact Decorio hosts and one matcher added.
- Live Decorio assets return the dedicated app; .com/.de redirects preserve the query; noindex header returned; unrelated configurator paths return 404. Standard and AKS fence pages return 200 and the original application.
- Upstream repository remains clean at `83376ec`. All implementation changes are on the dedicated fork's `codex/decorio-demo` branch. Draft PR #1. Actions disabled.

## Not yet passed

- Tenant provisioning: anonymous read of `tenantPublic/decorio` returns 404. Production correctly blocks access. A Firebase tenant-administrator login is needed; gcloud login does not sign in to the website.
- Google sign-in and real private saves, restoration, cross-tenant private access checks, public share creation/restoration and App Check on Decorio.
- End-to-end manual GitHub workflow: intentionally disabled until the cleaned implementation is on the fork's main branch; GCP identity is restricted to that branch and repository numeric IDs.
- Full catalogue acceptance: 1077 product pages inventoried, plus 8 industrial models from PDFs. 267 products/models have 391 dimension variants. Most BOMs lack a verified full mounting set. Catalogue coverage is documented per product; exact decorative geometry, all gates and accessory-selection coverage remain incomplete. A schematic shape is not an exact product model.
- Physical mobile/touch testing and large-scene GPU performance.
- Gate-to-gate swept-area collision, double-leaf/bifold/sliding gate implementation where documented, and additional mounting/gate catalog evidence review.

Local screenshots and generated JSON/CSV evidence are in ignored `output/`. Production route observations are in `output/production-routing-checks.json`. Do not promote this draft to a completed demo based solely on passing unit tests.
