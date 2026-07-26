import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(scriptDir)
const scriptPath = join(scriptDir, 'configure-cloudflare-workers-ai.sh')

function runScript(env) {
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

const temp = await mkdtemp(join(tmpdir(), 'studio-cloudflare-deploy-'))
const bin = join(temp, 'bin')
const calls = join(temp, 'gcloud-calls.log')
await mkdir(bin, { recursive: true })

await writeFile(join(bin, 'gcloud'), `#!/usr/bin/env bash
set -u
printf '%s\\n' "$*" >> "$MOCK_GCLOUD_CALLS"

case "$1 $2 $3" in
  "config get-value project")
    echo "test-project"
    exit 0
    ;;
  "run services describe")
    if printf '%s' "$*" | grep -q 'status.url'; then
      echo "https://dr-api.example.invalid"
    else
      echo "runtime@test-project.iam.gserviceaccount.com"
    fi
    exit 0
    ;;
esac

if [[ "$1 $2" == "run deploy" ]]; then
  exit 0
fi
if [[ "$1 $2" == "secrets describe" ]]; then
  [[ "\${MOCK_SECRET_MODE:-fail}" == "existing" ]]
  exit $?
fi
if [[ "$1 $2" == "secrets create" ]]; then
  cat >/dev/null
  [[ "\${MOCK_SECRET_MODE:-fail}" == "success" ]]
  exit $?
fi
if [[ "$1 $2 $3" == "secrets versions add" ]]; then
  cat >/dev/null
  [[ "\${MOCK_SECRET_MODE:-fail}" == "existing" ]]
  exit $?
fi
if [[ "$1 $2" == "projects describe" ]]; then
  echo "123456789"
  exit 0
fi
if [[ "$1 $2" == "secrets add-iam-policy-binding" ]]; then
  [[ "\${MOCK_SECRET_MODE:-fail}" == "success" || "\${MOCK_SECRET_MODE:-fail}" == "existing" ]]
  exit $?
fi
if [[ "$1 $2 $3" == "run services update" ]]; then
  exit 0
fi

echo "Unexpected gcloud call: $*" >&2
exit 2
`)
await chmod(join(bin, 'gcloud'), 0o755)

await writeFile(join(bin, 'curl'), `#!/usr/bin/env bash
printf '%s\\n' '{"ok":true,"route":"/api/ai/studio-image","configured":true,"service":"dr-api"}'
`)
await chmod(join(bin, 'curl'), 0o755)

const baseEnv = {
  ...process.env,
  PATH: `${bin}:${process.env.PATH}`,
  MOCK_GCLOUD_CALLS: calls,
  GOOGLE_CLOUD_PROJECT: 'test-project',
  CLOUDFLARE_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  CLOUDFLARE_API_TOKEN: 'mock-token-from-github-secret',
  CLOUDFLARE_PREFLIGHT: 'false',
}

try {
  await writeFile(calls, '')
  const fallback = await runScript({ ...baseEnv, MOCK_SECRET_MODE: 'fail' })
  assert.equal(fallback.code, 0, `Fallback deployment failed.\n${fallback.stdout}\n${fallback.stderr}`)
  assert.match(fallback.stdout + fallback.stderr, /Using the GitHub Secret directly/)
  assert.match(fallback.stdout + fallback.stderr, /live and configured/)
  const fallbackCalls = await readFile(calls, 'utf8')
  assert.match(fallbackCalls, /run deploy dr-api/)
  assert.match(fallbackCalls, /CLOUDFLARE_TOKEN_STORAGE=cloud-run-environment/)
  assert.match(fallbackCalls, /CLOUDFLARE_API_TOKEN=mock-token-from-github-secret/)

  await writeFile(calls, '')
  const secretManager = await runScript({ ...baseEnv, MOCK_SECRET_MODE: 'success' })
  assert.equal(secretManager.code, 0, `Secret Manager deployment failed.\n${secretManager.stdout}\n${secretManager.stderr}`)
  assert.match(secretManager.stdout + secretManager.stderr, /connected through Google Secret Manager/)
  const secretCalls = await readFile(calls, 'utf8')
  assert.match(secretCalls, /secrets create cloudflare-workers-ai-token/)
  assert.match(secretCalls, /CLOUDFLARE_TOKEN_STORAGE=secret-manager/)
  assert.match(secretCalls, /--update-secrets=CLOUDFLARE_API_TOKEN=cloudflare-workers-ai-token:latest/)
  assert.doesNotMatch(secretCalls, /CLOUDFLARE_API_TOKEN=mock-token-from-github-secret/)

  await writeFile(calls, '')
  const strict = await runScript({
    ...baseEnv,
    MOCK_SECRET_MODE: 'fail',
    ALLOW_DIRECT_CLOUD_RUN_TOKEN_FALLBACK: 'false',
  })
  assert.notEqual(strict.code, 0, 'Strict mode must fail when Secret Manager is unavailable.')

  console.log('Cloudflare deploy IAM fallback self-test passed.')
} finally {
  await rm(temp, { recursive: true, force: true })
}
