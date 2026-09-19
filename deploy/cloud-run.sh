#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
LAB_PROJECT=${1:?Usage: deploy/cloud-run.sh GOOGLE_CLOUD_PROJECT [REGION]}
LAB_REGION=${2:-us-central1}
LAB_SERVICE=movement-lab
LAB_ACCOUNT="movement-lab@${LAB_PROJECT}.iam.gserviceaccount.com"
LAB_REVISION=$(git rev-parse --short=12 HEAD)
LAB_IMAGE="${LAB_REGION}-docker.pkg.dev/${LAB_PROJECT}/movement-lab/lab:${LAB_REVISION}"

if [ -n "$(git status --porcelain)" ]; then
  echo 'Commit the reviewed changes before deploying a revision.' >&2
  exit 1
fi
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$LAB_PROJECT"
if ! gcloud artifacts repositories describe movement-lab --location "$LAB_REGION" --project "$LAB_PROJECT" >/dev/null 2>&1; then
  gcloud artifacts repositories create movement-lab --repository-format docker --location "$LAB_REGION" --project "$LAB_PROJECT"
fi
if ! gcloud iam service-accounts describe "$LAB_ACCOUNT" --project "$LAB_PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create movement-lab --display-name 'Movement Lab (no project data access)' --project "$LAB_PROJECT"
fi
gcloud builds submit --project "$LAB_PROJECT" --region "$LAB_REGION" --tag "$LAB_IMAGE" .
# Background searches need CPU between polling requests. Keep one replica so
# all polls reach the process that owns each job. Scale to zero when unused.
gcloud run deploy "$LAB_SERVICE" --project "$LAB_PROJECT" --region "$LAB_REGION" \
  --image "$LAB_IMAGE" --service-account "$LAB_ACCOUNT" \
  --allow-unauthenticated --port 8080 --cpu 2 --memory 8Gi \
  --concurrency 4 --min 0 --max 1 --no-cpu-throttling --timeout 60 \
  --startup-probe 'httpGet.path=/api/biomechanics/health,httpGet.port=8080,initialDelaySeconds=0,periodSeconds=5,timeoutSeconds=5,failureThreshold=24'
LAB_URL=$(gcloud run services describe "$LAB_SERVICE" --project "$LAB_PROJECT" --region "$LAB_REGION" --format='value(status.url)')
curl --fail --silent --show-error "$LAB_URL/api/biomechanics/health"
printf '\nMovement Lab origin: %s\n' "$LAB_URL"
