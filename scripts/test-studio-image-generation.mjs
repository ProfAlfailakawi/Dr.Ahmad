import assert from 'node:assert/strict'
import { buildEliteStudioImagePrompt, generateCloudflareStudioImage } from '../server.mjs'

const input = {
  idea: 'كيف نحمي إنسانية التعليم في عصر الذكاء الاصطناعي؟',
  context: 'مقال فكري أكاديمي للجمهور العربي',
  issue: 'إنسانية التعليم في عصر الذكاء الاصطناعي',
  tension: 'الكفاءة التقنية مقابل العلاقة الإنسانية',
  emotion: 'quiet intellectual awe',
  audience: 'educators and decision makers',
  visualReason: 'reveal what disappears when efficiency replaces presence',
  avoid: 'literal robots and glowing brains',
  persona: 'public intellectual',
  lighting: 'dramatic',
  negativeSpace: 'generous',
  orientation: 'portrait',
  clientPrompt: '',
  regenerationId: 'self-test-fresh-1',
  variation: 'Use a restrained visual paradox and a daring asymmetrical crop.',
}

const prompt = buildEliteStudioImagePrompt(input)
assert.ok(prompt.length >= 700, 'The elite prompt must carry a complete art direction.')
assert.ok(prompt.length <= 2048, 'The prompt must respect the Cloudflare model limit.')
assert.match(prompt, /visual metaphor/i)
assert.match(prompt, /Arabic typography/i)
assert.match(prompt, /Fresh-generation mandate/i)
assert.doesNotMatch(prompt, /watermark\s*$/i)

const differentPrompt = buildEliteStudioImagePrompt({ ...input, regenerationId: 'self-test-fresh-2', variation: 'Use a quiet human trace inside monumental negative space.' })
assert.notEqual(prompt, differentPrompt, 'Fresh regeneration must alter the art direction instead of replaying the same prompt.')

const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID
const previousToken = process.env.CLOUDFLARE_API_TOKEN
process.env.CLOUDFLARE_ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
process.env.CLOUDFLARE_API_TOKEN = 'self-test-token-not-real'

const jpegBytes = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(1_500, 1),
  Buffer.from([0xff, 0xd9]),
])
const fakeImage = jpegBytes.toString('base64')

async function runCase(responseFactory) {
  let calledUrl = ''
  const result = await generateCloudflareStudioImage(input, async (url, options) => {
    calledUrl = String(url)
    const body = JSON.parse(options.body)
    assert.equal(body.steps, 8)
    assert.ok(body.prompt.length <= 2048)
    assert.match(String(options.headers.authorization), /^Bearer /)
    return responseFactory()
  })
  assert.match(calledUrl, /\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/)
  assert.equal(result.imageBase64, fakeImage)
  assert.equal(result.mimeType, 'image/jpeg')
  assert.equal(result.imageBytes, jpegBytes.length)
  assert.equal(result.model, '@cf/black-forest-labs/flux-1-schnell')
  assert.equal(result.requestId, input.regenerationId)
  assert.ok(Number.isInteger(result.seed))
}

try {
  await runCase(() => new Response(JSON.stringify({ result: { image: fakeImage } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))

  await runCase(() => new Response(JSON.stringify({ result: { image: `data:image/jpeg;base64,${fakeImage}` } }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  }))

  await runCase(() => new Response(jpegBytes, {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  }))

  console.log('Studio image generation response-normalization self-test passed.')
} finally {
  if (previousAccount == null) delete process.env.CLOUDFLARE_ACCOUNT_ID
  else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount
  if (previousToken == null) delete process.env.CLOUDFLARE_API_TOKEN
  else process.env.CLOUDFLARE_API_TOKEN = previousToken
}
