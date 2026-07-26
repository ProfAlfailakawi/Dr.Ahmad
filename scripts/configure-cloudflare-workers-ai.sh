#!/usr/bin/env bash
set -euo pipefail

SERVICE_ID="${CLOUD_RUN_SERVICE_ID:-dr-api}"
REGION="${CLOUD_RUN_REGION:-europe-west1}"
SECRET_NAME="${CLOUDFLARE_TOKEN_SECRET_NAME:-cloudflare-workers-ai-token}"
MODEL="${CLOUDFLARE_IMAGE_MODEL:-@cf/black-forest-labs/flux-1-schnell}"
STEPS="${CLOUDFLARE_IMAGE_STEPS:-8}"
TIMEOUT_MS="${CLOUDFLARE_IMAGE_TIMEOUT_MS:-45000}"

: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID before running this script.}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN before running this script.}"

command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI is required." >&2; exit 1; }

if [[ "${CLOUDFLARE_PREFLIGHT:-true}" != "false" ]]; then
  echo "Checking Cloudflare Workers AI credentials before touching Cloud Run…"
  node --input-type=module <<'NODE'
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim()
const model = String(process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell').trim()
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ prompt: 'A restrained charcoal circle on warm ivory paper, museum-grade editorial still life, no text', seed: 142857, steps: 4 }),
})
let payload = null
try { payload = await response.json() } catch { /* handled below */ }
const image = payload?.result?.image || payload?.image
if (!response.ok || typeof image !== 'string' || image.length < 1000) {
  const detail = payload?.errors?.[0]?.message || payload?.message || payload?.error || `HTTP ${response.status}`
  console.error(`Cloudflare preflight failed: ${detail}`)
  process.exit(1)
}
console.log('Cloudflare preflight passed: the account, token, permissions, and image model are working.')
NODE
fi

if gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  printf '%s' "$CLOUDFLARE_API_TOKEN" | gcloud secrets versions add "$SECRET_NAME" --data-file=- >/dev/null
else
  printf '%s' "$CLOUDFLARE_API_TOKEN" | gcloud secrets create "$SECRET_NAME" --data-file=- --replication-policy=automatic >/dev/null
fi

PROJECT_NUMBER="$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')"
SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role='roles/secretmanager.secretAccessor' >/dev/null

gcloud run services update "$SERVICE_ID" \
  --region="$REGION" \
  --set-env-vars="CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID},CLOUDFLARE_IMAGE_MODEL=${MODEL},CLOUDFLARE_IMAGE_STEPS=${STEPS},CLOUDFLARE_IMAGE_TIMEOUT_MS=${TIMEOUT_MS}" \
  --set-secrets="CLOUDFLARE_API_TOKEN=${SECRET_NAME}:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE_ID" --region="$REGION" --format='value(status.url)')"
echo "Cloudflare Workers AI is securely connected to ${SERVICE_ID} in ${REGION}."
echo "Cloud Run service: ${SERVICE_URL}"
