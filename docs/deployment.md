# Dedicated deployment

Project `configurator-360`, region `europe-central2`.

| Resource | Decorio value |
| --- | --- |
| Cloud Run | `configurator-decorio` |
| Artifact Registry | `europe-central2-docker.pkg.dev/configurator-360/decorio/web` |
| Runtime identity | `decorio-runtime@configurator-360.iam.gserviceaccount.com` |
| Deployment identity | `decorio-deployer@configurator-360.iam.gserviceaccount.com` |
| WIF pool / provider | `decorio-github` / `decorio` |
| Serverless NEG | `configurator-decorio-neg` |
| Backend service | `configurator-decorio-backend` |

The runtime service account has no project roles. The deployment account can update the Decorio Cloud Run service, push to the Decorio repository, and act as the Decorio runtime identity. It has no permission to update the shared backend, Firebase rules, other Cloud Run services, load balancer or certificates.

OIDC trust is restricted to GitHub repository ID `1401293739`, owner ID `50717663`, branch `main`. The manual-only workflow has an additional repository/ref guard. Actions remain disabled until the fork's main branch contains the cleaned implementation. Do not enable Actions while inherited workflows remain on main.

Cloud Run has `internal-and-cloud-load-balancing` ingress, no default URL, and public invocation only through the allowed load-balancer path. Nginx accepts the three Decorio hostnames; .com and .de redirect to .ro with the request URI, allowing browser fragment inheritance. All responses have `X-Robots-Tag`; the page also has a robots meta tag. No SEO helper overrides it.

Existing wildcard certificate entries are ACTIVE in `configurators-cert-map`; no certificate or wildcard DNS change is needed. The live URL map is `configurators-web-map`. Routing changes must add exact Decorio hosts and preserve all existing entries. A pre-change map was exported locally to `/tmp/decorio-urlmap-before.yaml`. Exact Decorio routing is active. Existing default service, host rules and path matchers were compared after the update and remained unchanged. Standard and AKS fence pages still return their original app.

## Live release — 2026-10-02

- Code: `82aed12f879ddfbdc8737144decb6ee222ae50fa`.
- Cloud Build: `f203486f-7e0c-4979-9459-74bb03517ba4` (SUCCESS).
- Image: `europe-central2-docker.pkg.dev/configurator-360/decorio/web@sha256:c9a367d51346e3ab9ac40ca50ee66de497db4d03d5776f40c58c6fe639272949`.
- Revision: `configurator-decorio-00007-ztr`, 100% traffic.
- Active tenant: `decorio`, `go_live_now_1`, Fence only, auto-open.
- Public URL: https://decorio.360configurator.ro/configurator-garduri/ .

This release fixes the missing `/shared-3d/` Nginx route. Revision `00006-2lr` lacked that route and is not a rollback target. The replacement container was checked through Nginx for every JavaScript file; all 70 runtime dependencies were subsequently fetched from the production hostname. Google login, save/reload and share-link restoration were verified in the public UI. Default Cloud Run URL remains disabled, ingress remains internal-and-cloud-load-balancing. No global Firebase backend or wildcard routing change was made during this release.

## Rollback

For this release, return to the last working application before the builder update:

```sh
gcloud run services update-traffic configurator-decorio --project=configurator-360 --region=europe-central2 --to-revisions=configurator-decorio-00005-bc4=100
```

Never use a standard application revision/image or a wildcard-host edit for Decorio rollback. If removing the demo route, remove only the exact Decorio host rule/matcher after comparing a fresh URL-map export; do not blindly import an old map over newer changes.
