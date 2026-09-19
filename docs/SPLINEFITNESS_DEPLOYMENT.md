# Archived: SplineFitness integration and deployment

## Current decision — September 19, 2026

The owner cancelled moving Anatomy into `~/devl/SplineFitness` and is not pursuing public hosting. Keep the repositories separate. Anatomy retains its complete local Movement Lab functionality, SplineFitness branding and citations. The fitness-app card, rewrites and manifest change were reverted locally; they were never pushed or deployed. Anatomy’s links to the fitness app were removed, and the integration preview container was stopped. The normal Vite/Python local app remains available via `npm run dev`.

The remaining sections describe the abandoned integration and its earlier validation. They are historical records, not instructions to deploy, link a billing account or resume integration. Earlier deployment/risk acceptance does not authorize doing that now. Container packaging remains in the repository but is not required for normal local use.

## Home and routing

The existing Next.js app in `~/devl/SplineFitness` retains its home screen, Frontier Cards, workout cards, calendar, exercise library and blog. Movement Lab is an additional card, implemented as a document link to `/movement-lab`. The lab’s logo and **Workout cards** link return to `/`.

```text
splinefitness.com
  /                         existing Next.js workout cards, hosted by Vercel
  /movement-lab             lab document from the native service
  /movement-lab/*            namespaced JavaScript, CSS, models and credits
  /api/biomechanics/*        native calculation endpoints
  /manifest.json            existing shared SplineFitness PWA manifest
```

`MOVEMENT_LAB_ORIGIN` in the SplineFitness deployment configures Next.js [external rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites#rewriting-to-an-external-url). The lab is a full-page workspace under the same origin. Asset loaders use Vite’s build prefix through `src/urls.ts`. Production builds set `MOVEMENT_LAB_BASE=/movement-lab/`; the standalone developer view defaults to `/`. `VITE_FITNESS_HOME_URL` optionally overrides the return link for standalone development.

The shared manifest explicitly scopes navigation to `/`. Its start URL stays `/`, so launching the installed fitness app still opens the cards. There is no service worker or offline calculation support. Browser navigation is verified; installation on a physical iOS/Android device is not yet tested.

## Local integrated preview

Build/run the same Linux x86_64 container used in production:

```bash
docker build --platform linux/amd64 -t splinefitness-movement-lab:local .
docker run --rm --name splinefitness-movement-lab-preview \
  --cpus 2 --memory 8g -p 127.0.0.1:8910:8080 \
  splinefitness-movement-lab:local
```

In the SplineFitness repo, run `npm run dev -- --port 3000`. In development the rewrite defaults to `http://127.0.0.1:8910`. Open **http://localhost:3000**, then choose the **Movement Lab** card. Both directions remain on localhost. Port 5173 is the separate Vite development view.

For a container-free service preview, install `biomechanics/requirements-production.txt`, build with `MOVEMENT_LAB_BASE=/movement-lab/ npm run build`, run `node scripts/compress-build.mjs`, then:

```bash
.venv-opensim/bin/gunicorn --chdir biomechanics \
  --bind 127.0.0.1:8910 --workers 1 --threads 4 --timeout 90 service:application
```

From this repository, verify either the local integrated site or a deployment:

```bash
node scripts/check-splinefitness.mjs http://localhost:3000
python3 biomechanics/validate_http.py http://localhost:3000
```

The checks use new guest browser contexts. They verify all nine home cards, native evaluation for all six model configurations, sliders, the atlas/decoder, credits, longest-path search/Undo, the shared manifest, return navigation and Frontier Cards at desktop/mobile sizes. HTTP checks cover request bounds, missing files, cache validation, concurrent pose requests during a search, search completion and per-tab ownership. No signed-in cloud records are modified.

## Production service

The Dockerfile builds the frontend with Node 24 and runs the pinned OpenSim wheel on Ubuntu 24.04 / Python 3.12. It fetches and checksums the same 81 hip display meshes as local setup and verifies every native model and binary before packaging. The image includes the complete public credit bundle, original terms, bibliography and source records. The runtime runs as an unprivileged user.

Gunicorn 26.2.0 uses **one process with four HTTP threads**. Native model access is serialized; three admitted calculation requests bound the waiting work. Model configurations are serialized/gzipped once. Static files are precompressed; versioned build assets have immutable cache headers, while model/reference files revalidate. API results have `Cache-Control: no-store`.

Search capacity is deliberately one running search per service. Other visitors get an explicit busy response and can continue viewing or moving joints. An opaque per-tab header owns each browser search; another tab cannot poll or cancel it. The existing 20-second search budget, 16-result cap and ten-minute expiry remain. Jobs live in memory: a service restart or release can expire a search. Do not add replicas or native worker processes without moving the job registry to shared storage and addressing model concurrency.

Container testing measured about **3.6 GiB at startup** with all six model configurations loaded. The initial configuration allocates two CPUs / 8 GiB for headroom, caps the service at one instance, and allows scaling to zero. Cloud Run must provide CPU between polling requests for the background search thread; `--no-cpu-throttling` selects [instance-based billing](https://docs.cloud.google.com/run/docs/configuring/billing-settings). Idle warm instances can be billed until scaled down. This is resource sizing, not a hosting-price guarantee.

## Release order

1. Verify the lab build, container and browser/native checks. In SplineFitness run `npm run lint` and `npm run build` with `MOVEMENT_LAB_ORIGIN` pointing at the candidate service.
2. Commit the reviewed Anatomy changes. With an authenticated **personal** Google Cloud account and the owner-selected project, run `bash deploy/cloud-run.sh PROJECT_ID [REGION]`. The script creates an Artifact Registry repository and an unprivileged service identity if absent, builds the committed source, deploys Cloud Run and verifies its health endpoint. `.gcloudignore` uses the container source allowlist; environment files, local credentials and caches are excluded.
3. Verify the candidate service, then configure `MOVEMENT_LAB_ORIGIN` for Production and Preview in the existing Vercel `strength-tracker` project. Use the exact HTTPS service URL returned by Cloud Run. Do not point the public site at localhost or a temporary developer tunnel.
4. Rebuild/check SplineFitness against that origin, commit its home card/rewrite/manifest changes, and push its `main` branch. Per that repo’s `AGENTS.md`, this triggers the production deployment. Use Vercel CLI to confirm Ready; do not create a duplicate `vercel --prod` deployment unless the Git-triggered deployment fails.
5. Verify `https://splinefitness.com` returns 200 and run the integrated checks against it. Confirm both the original cards and the new lab before reporting deployment complete.

Do not publish the home card until its backend origin is running and tested. Roll back the Vercel deployment to restore the previous card screen if the integrated release fails; retain a known-working Cloud Run revision when updating the service.

## Purpose, permissions and source terms

The owner describes SplineFitness as a personal experimentation lab, with no revenue or plans to monetize it. This integration is a free, non-commercial public experiment. Revisit the applicable model terms if that purpose changes.

The owner explicitly accepted proceeding with the unresolved hip-mesh redistribution uncertainty and requested thorough citations. Retain the models under that direction, preserve the exact source/terms record and disclose the uncertainty accurately. Neither attribution nor this decision establishes new upstream permission. Do not ask for the same risk confirmation again.

- [MoBL-ARMS terms](../biomechanics/models/arm/LICENSE.txt) include non-commercial research, evaluation and personal use, plus redistribution conditions. The original terms and required publications are preserved in the public credits.
- The [hip display-mesh audit](../biomechanics/README.md#attribution-and-licensing) has not established individual redistribution terms for all 81 meshes. They are fetched from pinned upstream sources and converted for browser display. The owner accepts proceeding; the public credit page retains the unresolved status.
- Atlas share-alike attribution and notices remain intact. The OpenSim software license does not replace the terms of each anatomical model. See [OpenSim’s licensing guidance](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53086437/License+for+OpenSim+4.0+and+Later).

The spline symbol is derived from `SplineFitness/public/spline_logo.svg` at commit `276e4b16e82e5c4a87e2e4ca12c144b775945792`; original SHA-256 `daeed76dd6c4d03e39d341a48b9f8f7e2105f39293543f31373b6807f8594c53`. Its curve/node geometry is unchanged. Native `kinetic` version identifiers and historical browser-storage keys are retained for reproducibility and saved-reference compatibility. Localhost records do not automatically transfer to the production origin.
