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
}

const prompt = buildEliteStudioImagePrompt(input)
assert.ok(prompt.length >= 700, 'The elite prompt must carry a complete art direction.')
assert.ok(prompt.length <= 2048, 'The prompt must respect the Cloudflare model limit.')
assert.match(prompt, /visual metaphor/i)
assert.match(prompt, /Arabic typography/i)
assert.doesNotMatch(prompt, /watermark\s*$/i)

const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID
const previousToken = process.env.CLOUDFLARE_API_TOKEN
process.env.CLOUDFLARE_ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
process.env.CLOUDFLARE_API_TOKEN = 'self-test-token-not-real'

try {
  const fakeImage = Buffer.alloc(1200, 1).toString('base64')
  let calledUrl = ''
  const result = await generateCloudflareStudioImage(input, async (url, options) => {
    calledUrl = String(url)
    const body = JSON.parse(options.body)
    assert.equal(body.steps, 8)
    assert.ok(body.prompt.length <= 2048)
    assert.match(String(options.headers.authorization), /^Bearer /)
    return new Response(JSON.stringify({ result: { image: fakeImage } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  assert.match(calledUrl, /\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/)
  assert.match(result.imageUrl, /^data:image\/jpeg;base64,/)
  assert.equal(result.model, '@cf/black-forest-labs/flux-1-schnell')
  console.log('Studio image generation self-test passed.')
} finally {
  if (previousAccount == null) delete process.env.CLOUDFLARE_ACCOUNT_ID
  else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount
  if (previousToken == null) delete process.env.CLOUDFLARE_API_TOKEN
  else process.env.CLOUDFLARE_API_TOKEN = previousToken
}
