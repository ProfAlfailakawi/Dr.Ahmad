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

PROJECT_ID="$(gcloud config get-value project)"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
EXISTING_SERVICE_ACCOUNT="$(gcloud run services describe "$SERVICE_ID" --project="$PROJECT_ID" --region="$REGION" --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-${EXISTING_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}}"
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role='roles/secretmanager.secretAccessor' >/dev/null

# انشر كود dr-api الحالي أولاً؛ كان السكربت سابقاً يربط السر بخدمة قديمة،
# فتظل الواجهة ترى HTTP 404 رغم صحة Cloudflare.
gcloud run deploy "$SERVICE_ID" \
  --source=. \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --allow-unauthenticated \
  --port=8080 \
  --timeout=60 \
  --memory=1Gi \
  --max-instances=3 \
  --quiet

gcloud run services update "$SERVICE_ID" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --update-env-vars="CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID},CLOUDFLARE_IMAGE_MODEL=${MODEL},CLOUDFLARE_IMAGE_STEPS=${STEPS},CLOUDFLARE_IMAGE_TIMEOUT_MS=${TIMEOUT_MS}" \
  --update-secrets="CLOUDFLARE_API_TOKEN=${SECRET_NAME}:latest"

SERVICE_URL="$(gcloud run services describe "$SERVICE_ID" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
HEALTH="$(curl --fail --silent --show-error --max-time 15 "${SERVICE_URL}/api/ai/studio-image/health")"
node -e 'const value=JSON.parse(process.argv[1]); if(!value.ok || value.route!=="/api/ai/studio-image" || !value.configured) process.exit(1)' "$HEALTH"
echo "Cloudflare Workers AI is securely connected to ${SERVICE_ID} in ${REGION}."
echo "Cloud Run service: ${SERVICE_URL}"
echo "Studio image route: live and configured."
