import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 18_000 + Math.floor(Math.random() * 1_000)
const base = `http://127.0.0.1:${port}`
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), CLOUDFLARE_ACCOUNT_ID: '', CLOUDFLARE_API_TOKEN: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let logs = ''
child.stdout.on('data', (chunk) => { logs += String(chunk) })
child.stderr.on('data', (chunk) => { logs += String(chunk) })

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
try {
  let health = null
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/ai/studio-image/health`)
      if (response.ok) { health = await response.json(); break }
    } catch { /* server still starting */ }
    await delay(100)
  }
  assert.ok(health, `Health route did not start. Logs: ${logs}`)
  assert.equal(health.ok, true)
  assert.equal(health.route, '/api/ai/studio-image')
  assert.deepEqual(health.aliases, ['/api/studio-image', '/api/generate-studio-image'])

  for (const route of ['/api/ai/studio-image', '/api/studio-image', '/api/generate-studio-image']) {
    const response = await fetch(`${base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: 'route test' }),
    })
    assert.notEqual(response.status, 404, `${route} regressed to 404`)
    assert.equal(response.status, 401, `${route} must remain protected by admin authentication`)
  }
  console.log('Studio image API route self-test passed.')
} finally {
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    delay(1_500).then(() => child.kill('SIGKILL')),
  ])
}
