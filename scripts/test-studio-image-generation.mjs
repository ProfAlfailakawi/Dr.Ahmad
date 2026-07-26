import assert from 'node:assert/strict'
import { buildEliteStudioImagePrompt, generateCloudflareStudioImage } from '../server.mjs'

const input = {
  idea: 'كيف نحمي إنسانية التعليم في عصر الذكاء الاصطناعي؟',
  context: 'مقال فكري أكاديمي للجمهور العربي',
  issue: 'إنسانية التعليم في عصر الذكاء الاصطناعي',
  tension: 'الكفاءة التكنولوجية مقابل العلاقة الإنسانية',
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
assert.ok(prompt.length >= 500, 'The elite prompt must carry a complete art direction.')
assert.ok(prompt.length <= 2048, 'The prompt must respect the Cloudflare model limit.')
assert.match(prompt, /THE SCENE MUST BE EXACTLY THIS/i)
assert.match(prompt, /VISIBLE OBJECTS THAT MUST APPEAR/i)
assert.match(prompt, /Generate image only/i)
assert.match(prompt, /Art direction/i)
assert.match(prompt, /Fresh variation/i)
assert.doesNotMatch(prompt, /watermark\s*$/i)


const manipulationInput = {
  ...input,
  idea: 'التلاعب في التعليم',
  issue: 'التلاعب في التعليم',
  tension: 'التدخل الخفي في المعايير والنتائج',
  visualReason: 'show how hidden influence bends educational standards',
  regenerationId: 'manipulation-semantic-test',
}
const manipulationPrompt = buildEliteStudioImagePrompt(manipulationInput)
assert.match(manipulationPrompt, /contemporary classroom/i)
assert.match(manipulationPrompt, /concealed hand/i)
assert.match(manipulationPrompt, /balanced brass scale/i)
assert.match(manipulationPrompt, /blank exam sheets/i)
assert.match(manipulationPrompt, /Do not include:.*person hiding behind a book/i)

const differentPrompt = buildEliteStudioImagePrompt({ ...input, regenerationId: 'self-test-fresh-2', variation: 'Use a quiet human trace inside monumental negative space.' })
assert.notEqual(prompt, differentPrompt, 'Fresh regeneration must alter the art direction instead of replaying the same prompt.')

const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID
const previousToken = process.env.CLOUDFLARE_API_TOKEN
const previousGemini = process.env.GEMINI_API_KEY
const previousGoogle = process.env.GOOGLE_API_KEY
process.env.CLOUDFLARE_ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
process.env.CLOUDFLARE_API_TOKEN = 'self-test-token-not-real'
delete process.env.GEMINI_API_KEY
delete process.env.GOOGLE_API_KEY

try {
  const fakeJpegBytes = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(1400, 1),
    Buffer.from([0xff, 0xd9]),
  ])
  const fakeImage = fakeJpegBytes.toString('base64')
  let calledUrl = ''
  const result = await generateCloudflareStudioImage(input, async (url, options) => {
    calledUrl = String(url)
    const body = JSON.parse(options.body)
    assert.equal(body.steps, 8)
    assert.ok(body.prompt.length <= 2048)
    assert.match(String(options.headers.authorization), /^Bearer /)
    assert.equal(options.headers.accept, 'application/json')
    return new Response(JSON.stringify({ result: { image: fakeImage } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  assert.match(calledUrl, /\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell$/)
  assert.match(result.imageUrl, /^data:image\/jpeg;base64,/)
  assert.equal(result.imageMime, 'image/jpeg')
  assert.equal(result.imageBytes, fakeJpegBytes.length)
  assert.equal(result.model, '@cf/black-forest-labs/flux-1-schnell')
  assert.equal(result.requestId, input.regenerationId)
  assert.ok(Number.isInteger(result.seed))
  assert.ok(result.visualWorldLabel)
  assert.ok(result.layoutHint)
  assert.ok(result.imageTreatment)
  assert.equal(result.generationAttempts, 1)

  const dataUriResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'data-uri-shape' }, async () => new Response(JSON.stringify({ image: `data:image/jpeg;charset=utf-8;base64,${fakeImage}` }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
  assert.match(dataUriResult.imageUrl, /^data:image\/jpeg;base64,/)

  const binaryResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'binary-shape' }, async () => new Response(fakeJpegBytes, {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  }))
  assert.equal(binaryResult.imageMime, 'image/jpeg')
  assert.equal(binaryResult.imageBytes, fakeJpegBytes.length)

  const fakePngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(1400, 2),
  ])
  const pngResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'png-shape' }, async () => new Response(JSON.stringify({ result: { data: { image_base64: fakePngBytes.toString('base64') } } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
  assert.match(pngResult.imageUrl, /^data:image\/png;base64,/)
  assert.equal(pngResult.imageMime, 'image/png')

  let recoveryCalls = 0
  const recoverySeeds = []
  const recoveredResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'empty-payload-recovery' }, async (_url, options) => {
    recoveryCalls += 1
    recoverySeeds.push(JSON.parse(options.body).seed)
    if (recoveryCalls === 1) {
      return new Response(JSON.stringify({ success: true, result: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cf-ray': 'self-test-ray' },
      })
    }
    return new Response(JSON.stringify({ success: true, result: { image: fakeImage } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  assert.equal(recoveryCalls, 2, 'An empty successful payload must trigger one fresh Cloudflare attempt.')
  assert.notEqual(recoverySeeds[0], recoverySeeds[1], 'The recovery attempt must use a fresh seed.')
  assert.match(recoveredResult.imageUrl, /^data:image\/jpeg;base64,/)
  assert.equal(recoveredResult.generationAttempts, 2)

  console.log('Studio image generation self-test passed for JSON, data URI, binary, PNG, and empty-payload recovery.')

} finally {
  if (previousAccount == null) delete process.env.CLOUDFLARE_ACCOUNT_ID
  else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount
  if (previousToken == null) delete process.env.CLOUDFLARE_API_TOKEN
  else process.env.CLOUDFLARE_API_TOKEN = previousToken
  if (previousGemini == null) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = previousGemini
  if (previousGoogle == null) delete process.env.GOOGLE_API_KEY
  else process.env.GOOGLE_API_KEY = previousGoogle
}
