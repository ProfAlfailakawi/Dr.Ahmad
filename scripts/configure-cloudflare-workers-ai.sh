#!/usr/bin/env bash
set -euo pipefail

SERVICE_ID="${CLOUD_RUN_SERVICE_ID:-dr-api}"
REGION="${CLOUD_RUN_REGION:-europe-west1}"
SECRET_NAME="${CLOUDFLARE_TOKEN_SECRET_NAME:-cloudflare-workers-ai-token}"
MODEL="${CLOUDFLARE_IMAGE_MODEL:-@cf/black-forest-labs/flux-2-klein-4b}"
STEPS="${CLOUDFLARE_IMAGE_STEPS:-4}"
TIMEOUT_MS="${CLOUDFLARE_IMAGE_TIMEOUT_MS:-45000}"
VISION_MODEL="${CLOUDFLARE_VISION_CRITIC_MODEL:-@cf/moondream/moondream3.1-9B-A2B}"
VISION_TIMEOUT_MS="${CLOUDFLARE_VISION_CRITIC_TIMEOUT_MS:-24000}"
ALLOW_DIRECT_FALLBACK="${ALLOW_DIRECT_CLOUD_RUN_TOKEN_FALLBACK:-true}"

: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID before running this script.}"
: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN before running this script.}"

command -v gcloud >/dev/null 2>&1 || { echo "gcloud CLI is required." >&2; exit 1; }

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "Unable to resolve the Google Cloud project." >&2
  exit 1
fi

if [[ "${CLOUDFLARE_PREFLIGHT:-true}" != "false" ]]; then
  echo "Checking Cloudflare Workers AI credentials before touching Cloud Run…"
  node --input-type=module <<'NODE'
const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim()
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim()
const model = String(process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/black-forest-labs/flux-2-klein-4b').trim()
const form = new FormData()
form.append('prompt', 'A restrained charcoal circle on warm ivory paper, museum-grade editorial still life, no text')
form.append('width', '512')
form.append('height', '640')
form.append('seed', '142857')
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  body: form,
})
const bytes = Buffer.from(await response.arrayBuffer())
let payload = null
try { payload = JSON.parse(bytes.toString('utf8')) } catch { /* binary image is valid */ }
const image = payload?.result?.image || payload?.image
const binaryImage = bytes[0] === 0xff || bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
if (!response.ok || (!binaryImage && (typeof image !== 'string' || image.length < 1000))) {
  const detail = payload?.errors?.[0]?.message || payload?.message || payload?.error || `HTTP ${response.status}`
  console.error(`Cloudflare preflight failed: ${detail}`)
  process.exit(1)
}
console.log('Cloudflare preflight passed: the account, token, permissions, and image model are working.')
NODE
fi

# Always deploy the current server first. This guarantees that the new image route exists
# even when Secret Manager permissions are missing on the GitHub deployment identity.
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

configure_with_secret_manager() {
  local project_number existing_service_account service_account

  echo "Trying the preferred Secret Manager connection…"

  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    if ! printf '%s' "$CLOUDFLARE_API_TOKEN" | \
      gcloud secrets versions add "$SECRET_NAME" --project="$PROJECT_ID" --data-file=- >/dev/null; then
      echo "::warning::The GitHub Google service account cannot add a Secret Manager version. Falling back without stopping deployment."
      return 1
    fi
  else
    if ! printf '%s' "$CLOUDFLARE_API_TOKEN" | \
      gcloud secrets create "$SECRET_NAME" --project="$PROJECT_ID" --data-file=- --replication-policy=automatic >/dev/null; then
      echo "::warning::The GitHub Google service account cannot create Secret Manager resources. Falling back without stopping deployment."
      return 1
    fi
  fi

  project_number="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  existing_service_account="$(gcloud run services describe "$SERVICE_ID" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  service_account="${CLOUD_RUN_SERVICE_ACCOUNT:-${existing_service_account:-${project_number}-compute@developer.gserviceaccount.com}}"

  if ! gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${service_account}" \
    --role='roles/secretmanager.secretAccessor' >/dev/null; then
    echo "::warning::Secret Manager exists, but the deploy identity cannot grant the Cloud Run runtime access. Falling back without stopping deployment."
    return 1
  fi

  # Remove a possible older direct environment value while atomically replacing it with
  # a Secret Manager reference. Non-secret variables remain normal Cloud Run config.
  gcloud run services update "$SERVICE_ID" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --remove-env-vars=CLOUDFLARE_API_TOKEN \
    --update-env-vars="^|^CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}|CLOUDFLARE_IMAGE_MODEL=${MODEL}|CLOUDFLARE_IMAGE_STEPS=${STEPS}|CLOUDFLARE_IMAGE_TIMEOUT_MS=${TIMEOUT_MS}|CLOUDFLARE_VISION_CRITIC_MODEL=${VISION_MODEL}|CLOUDFLARE_VISION_CRITIC_TIMEOUT_MS=${VISION_TIMEOUT_MS}|STUDIO_IMAGE_REQUIRE_VISION_CRITIC=true|CLOUDFLARE_TOKEN_STORAGE=secret-manager" \
    --update-secrets="CLOUDFLARE_API_TOKEN=${SECRET_NAME}:latest" \
    --quiet

  echo "::notice::Cloudflare token connected through Google Secret Manager."
  return 0
}

configure_with_direct_runtime_environment() {
  if [[ "$ALLOW_DIRECT_FALLBACK" != "true" ]]; then
    echo "Secret Manager could not be configured and direct fallback is disabled." >&2
    return 1
  fi

  # The value still originates only from GitHub Secrets and is never committed or written
  # to the repository. GitHub masks it in job output. This operational fallback stores the
  # token as a Cloud Run environment value until Secret Manager IAM is granted.
  echo "::warning::Using the GitHub Secret directly as a Cloud Run runtime environment value because Secret Manager IAM is unavailable."
  echo "::warning::Grant roles/secretmanager.admin to the GitHub deployment service account later; the next run will migrate automatically to Secret Manager."

  gcloud run services update "$SERVICE_ID" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --remove-secrets=CLOUDFLARE_API_TOKEN \
    --update-env-vars="^|^CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}|CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}|CLOUDFLARE_IMAGE_MODEL=${MODEL}|CLOUDFLARE_IMAGE_STEPS=${STEPS}|CLOUDFLARE_IMAGE_TIMEOUT_MS=${TIMEOUT_MS}|CLOUDFLARE_VISION_CRITIC_MODEL=${VISION_MODEL}|CLOUDFLARE_VISION_CRITIC_TIMEOUT_MS=${VISION_TIMEOUT_MS}|STUDIO_IMAGE_REQUIRE_VISION_CRITIC=true|CLOUDFLARE_TOKEN_STORAGE=cloud-run-environment" \
    --quiet

  echo "::notice::Cloudflare token connected from GitHub Secrets through the Cloud Run revision."
}

if ! configure_with_secret_manager; then
  configure_with_direct_runtime_environment
fi

SERVICE_URL="$(gcloud run services describe "$SERVICE_ID" --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')"
test -n "$SERVICE_URL"

HEALTH=''
for attempt in {1..12}; do
  if HEALTH="$(curl --fail --silent --show-error --max-time 15 "${SERVICE_URL}/api/ai/studio-image/health")"; then
    break
  fi
  if [[ "$attempt" -eq 12 ]]; then
    echo "Cloud Run deployed, but the studio image health route did not become reachable." >&2
    exit 1
  fi
  sleep 5
done

node -e 'const value=JSON.parse(process.argv[1]); if(!value.ok || value.route!=="/api/ai/studio-image" || !value.configured) process.exit(1)' "$HEALTH"
echo "Cloudflare Workers AI is connected to ${SERVICE_ID} in ${REGION}."
echo "Cloud Run service: ${SERVICE_URL}"
echo "Studio image route: live and configured."
