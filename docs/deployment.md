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

Existing wildcard certificate entries are ACTIVE in `configurators-cert-map`; no certificate or wildcard DNS change is needed. The live URL map is `configurators-web-map`. Routing changes must add exact Decorio hosts and preserve all existing entries. A pre-change map was exported locally to `/tmp/decorio-urlmap-before.yaml`. Production routing is not yet activated.

## Rollback

Use the previous revision recorded by the workflow:

```sh
gcloud run services update-traffic configurator-decorio --project=configurator-360 --region=europe-central2 --to-revisions=PREVIOUS_REVISION=100
```

Never use a standard application revision/image or a wildcard-host edit for Decorio rollback. If removing the demo route, remove only the exact Decorio host rule/matcher after comparing a fresh URL-map export; do not blindly import an old map over newer changes.
