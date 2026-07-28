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
  targetWidth: 1080,
  targetHeight: 1350,
  generationWidth: 1024,
  generationHeight: 1280,
  textZone: 'right',
  formatId: 'instagram-portrait',
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
assert.match(prompt, /ZERO writing in the pixels/i)
assert.match(prompt, /no Arabic, no English/i)
assert.match(prompt, /Art direction/i)
assert.match(prompt, /Fresh variation/i)
assert.doesNotMatch(prompt, /watermark\s*$/i)

const userSovereigntyPrompt = buildEliteStudioImagePrompt({
  ...input,
  idea: 'معلم وطالب يتحاوران في فصل دراسي مضيء',
  issue: 'نظم التدريس الذكية',
  glossaryConcept: 'intelligent-tutoring-systems',
  glossaryLabel: 'نظم التدريس الذكية',
  glossaryCanonicalEn: 'Intelligent Tutoring Systems',
  glossaryMeaning: 'أنظمة تقدم دعماً وتكييفاً يشبه وظائف المعلم الخصوصي.',
  literalAnchors: ['طالب يتحاوران', 'دراسي مضيء'],
  regenerationId: 'user-wording-sovereignty',
})
assert.match(userSovereigntyPrompt, /معلم وطالب يتحاوران في فصل دراسي مضيء/)
assert.doesNotMatch(userSovereigntyPrompt, /Intelligent Tutoring Systems|أنظمة تقدم دعماً وتكييفاً/i)



const gamificationInput = {
  ...input,
  idea: 'تلعيب',
  issue: 'التلعيب في التعليم',
  tension: 'تحفيز التعلّم من خلال التقدم والتحدي والإنجاز',
  visualReason: 'show learning progress, badges, levels and meaningful challenges without childish clichés',
  regenerationId: 'gamification-semantic-test',
  recentVisualWorlds: [],
}
const gamificationPrompt = buildEliteStudioImagePrompt(gamificationInput)
assert.match(gamificationPrompt, /Gamification/i)
assert.match(gamificationPrompt, /النقاط|المستويات|الشارات|التحديات|شريط تقدم|points|levels|badges|progress|challenges/i)
assert.match(gamificationPrompt, /optimistic|daylight|luminous|alive/i)
assert.doesNotMatch(gamificationPrompt, /concealed hand|bends educational standards|manipulation as deception/i)
assert.match(gamificationPrompt, /ليس التلاعب|الخداع|not manipulation|not deception/i)

const gamificationFreshPrompt = buildEliteStudioImagePrompt({
  ...gamificationInput,
  regenerationId: 'gamification-semantic-test-2',
  recentVisualWorlds: ['playful-systems'],
  variation: 'Choose a completely different visual world and structure.',
})
assert.notEqual(gamificationPrompt, gamificationFreshPrompt, 'Recent visual-world history must force a genuinely different gamification direction.')
assert.match(gamificationFreshPrompt, /Do not make the scene sad, gloomy, lonely, ominous/i)

const differentPrompt = buildEliteStudioImagePrompt({ ...input, regenerationId: 'self-test-fresh-2', variation: 'Use a quiet human trace inside monumental negative space.' })
assert.notEqual(prompt, differentPrompt, 'Fresh regeneration must alter the art direction instead of replaying the same prompt.')

const previousAccount = process.env.CLOUDFLARE_ACCOUNT_ID
const previousToken = process.env.CLOUDFLARE_API_TOKEN
const previousModel = process.env.CLOUDFLARE_IMAGE_MODEL
const previousDailyModel = process.env.CLOUDFLARE_IMAGE_MODEL_DAILY
const previousVisionRequirement = process.env.STUDIO_IMAGE_REQUIRE_VISION_CRITIC
const previousTextInspection = process.env.STUDIO_IMAGE_INSPECT_TEXT
const previousCandidateAttempts = process.env.STUDIO_IMAGE_CANDIDATE_ATTEMPTS
const previousTransportAttempts = process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS
process.env.CLOUDFLARE_ACCOUNT_ID = '0123456789abcdef0123456789abcdef'
process.env.CLOUDFLARE_API_TOKEN = 'self-test-token-not-real'
process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'
process.env.CLOUDFLARE_IMAGE_MODEL_DAILY = '@cf/black-forest-labs/flux-2-klein-4b'
process.env.STUDIO_IMAGE_REQUIRE_VISION_CRITIC = 'false'
process.env.STUDIO_IMAGE_INSPECT_TEXT = 'false'
process.env.STUDIO_IMAGE_CANDIDATE_ATTEMPTS = '1'
process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS = '1'

try {
  const fakeJpegBytes = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(1400, 1),
    Buffer.from([0xff, 0xd9]),
  ])
  const fakeImage = fakeJpegBytes.toString('base64')
  let calledUrl = ''
  const imageOnlyMock = (imageHandler) => async (url, options) => {
    if (!String(url).includes('/black-forest-labs/')) {
      return new Response(JSON.stringify({ success: false }), { status: 503, headers: { 'content-type': 'application/json' } })
    }
    return imageHandler(url, options)
  }
  const result = await generateCloudflareStudioImage(input, imageOnlyMock(async (url, options) => {
    calledUrl = String(url)
    assert.ok(options.body instanceof FormData)
    assert.equal(options.body.get('width'), '1024')
    assert.equal(options.body.get('height'), '1280')
    assert.ok(String(options.body.get('prompt')).length <= 2048)
    assert.match(String(options.headers.authorization), /^Bearer /)
    assert.equal(options.headers.accept, 'application/json')
    assert.equal(options.headers['content-type'], undefined, 'Multipart boundary must be set by fetch.')
    return new Response(JSON.stringify({ result: { image: fakeImage } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }))

  assert.match(calledUrl, /\/ai\/run\/@cf\/black-forest-labs\/flux-2-klein-4b$/)
  assert.match(result.imageUrl, /^data:image\/jpeg;base64,/)
  assert.equal(result.imageMime, 'image/jpeg')
  assert.equal(result.imageBytes, fakeJpegBytes.length)
  assert.equal(result.model, '@cf/black-forest-labs/flux-2-klein-4b')
  assert.equal(result.generationMode, 'daily')
  assert.equal(result.nativeAspect, true)
  assert.equal(result.targetWidth, 1080)
  assert.equal(result.targetHeight, 1350)
  assert.equal(result.requestId, input.regenerationId)
  assert.ok(Number.isInteger(result.seed))
  assert.ok(result.visualWorldLabel)
  assert.ok(result.layoutHint)
  assert.ok(result.imageTreatment)
  assert.equal(result.generationAttempts, 1)

  process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/leonardo/phoenix-1.0'
  const phoenixResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'phoenix-native-shape', generationMode: 'masterpiece' }, async (url, options) => {
    if (!String(url).includes('/leonardo/phoenix-1.0')) {
      return new Response(JSON.stringify({ success: false }), { status: 503, headers: { 'content-type': 'application/json' } })
    }
    const request = JSON.parse(String(options.body))
    assert.equal(options.headers['content-type'], 'application/json')
    assert.equal(request.width, 1024)
    assert.equal(request.height, 1280)
    assert.equal(request.num_steps, 8)
    assert.equal(request.guidance, 7)
    assert.match(request.negative_prompt, /text/)
    return new Response(fakeJpegBytes, { status: 200, headers: { 'content-type': 'image/jpeg' } })
  })
  assert.equal(phoenixResult.model, '@cf/leonardo/phoenix-1.0')
  assert.equal(phoenixResult.generationMode, 'masterpiece')
  assert.equal(phoenixResult.nativeAspect, true)
  assert.match(phoenixResult.sourceUrl, /phoenix-1\.0/)
  assert.match(phoenixResult.license, /Leonardo/)
  process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-4b'

  const dataUriResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'data-uri-shape' }, imageOnlyMock(async () => new Response(JSON.stringify({ image: `data:image/jpeg;charset=utf-8;base64,${fakeImage}` }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })))
  assert.match(dataUriResult.imageUrl, /^data:image\/jpeg;base64,/)

  const binaryResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'binary-shape' }, imageOnlyMock(async () => new Response(fakeJpegBytes, {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })))
  assert.equal(binaryResult.imageMime, 'image/jpeg')
  assert.equal(binaryResult.imageBytes, fakeJpegBytes.length)

  const fakePngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(1400, 2),
  ])
  const pngResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'png-shape' }, imageOnlyMock(async () => new Response(JSON.stringify({ result: { data: { image_base64: fakePngBytes.toString('base64') } } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })))
  assert.match(pngResult.imageUrl, /^data:image\/png;base64,/)
  assert.equal(pngResult.imageMime, 'image/png')

  let recoveryCalls = 0
  const recoverySeeds = []
  process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS = '2'
  const recoveredResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'empty-payload-recovery' }, imageOnlyMock(async (_url, options) => {
    recoveryCalls += 1
    recoverySeeds.push(options.body.get('seed'))
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
  }))
  assert.equal(recoveryCalls, 2, 'An empty successful payload must trigger one fresh Cloudflare attempt.')
  assert.notEqual(recoverySeeds[0], recoverySeeds[1], 'The recovery attempt must use a fresh seed.')
  assert.match(recoveredResult.imageUrl, /^data:image\/jpeg;base64,/)
  assert.equal(recoveredResult.generationAttempts, 2)
  process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS = '1'

  process.env.STUDIO_IMAGE_REQUIRE_VISION_CRITIC = 'true'
  process.env.STUDIO_IMAGE_INSPECT_TEXT = 'true'
  process.env.STUDIO_IMAGE_CANDIDATE_ATTEMPTS = '2'
  let imageCalls = 0
  let visionCalls = 0
  let judgeCalls = 0
  const visionGatedResult = await generateCloudflareStudioImage({ ...input, regenerationId: 'vision-gate-rescue', generationMode: 'masterpiece' }, async (url, options) => {
    if (String(url).includes('/black-forest-labs/')) {
      imageCalls += 1
      return new Response(JSON.stringify({ result: { image: fakeImage } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (String(url).includes('/moondream/')) {
      visionCalls += 1
      const request = JSON.parse(String(options.body))
      assert.equal(request.task, 'caption')
      assert.equal(request.caption_length, 'long')
      assert.equal(request.stream, false)
      assert.match(request.image, /^data:image\/jpeg;base64,/)
      const caption = visionCalls === 1
        ? 'A teacher stands beside an empty student chair and a fake dashboard covered with interface writing.'
        : 'A teacher protects warm natural light around an empty student chair while cold machine-like light reaches the classroom desk.'
      return new Response(JSON.stringify({ result: { caption } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (String(url).includes('/meta/llama-3.1-8b-instruct-fast')) {
      const request = JSON.parse(String(options.body))
      if (!String(request.prompt).includes('PIXEL CAPTION:')) {
        return new Response(JSON.stringify({ success: false }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        })
      }
      judgeCalls += 1
      const answer = judgeCalls === 1
        ? { score: 82, topicMatch: true, hasTextOrGlyphs: true, interfaceContamination: true, textSafeZoneClean: false, visualNoise: false, reason: 'A fake dashboard pollutes the image.', missingAnchor: '', correction: 'Remove all screens and writing.' }
        : { score: 0, topicMatch: true, hasTextOrGlyphs: false, interfaceContamination: false, textSafeZoneClean: true, visualNoise: false, reason: 'The human and machine-light tension is clear.', missingAnchor: '', correction: '' }
      return new Response(JSON.stringify({ result: { response: JSON.stringify(answer) } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ success: false }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  })
  assert.equal(imageCalls, 2, 'A contaminated image must be discarded and regenerated.')
  assert.equal(visionCalls, 2)
  assert.equal(judgeCalls, 2)
  assert.equal(visionGatedResult.semanticVerified, true)
  assert.equal(visionGatedResult.relevanceScore, 92, 'A clean pass must not be rejected when Moondream reports zero policy violations as score=0.')
  assert.equal(visionGatedResult.hasTextOrGlyphs, false)
  assert.equal(visionGatedResult.interfaceContamination, false)
  assert.equal(visionGatedResult.textSafeZoneClean, true)
  assert.equal(visionGatedResult.criticSource, 'cloudflare-moondream-caption+llama-semantic-gate')
  assert.equal(visionGatedResult.generationAttempts, 2)

  console.log('Studio image generation self-test passed for transport recovery, native aspect output, and strict visual contamination rescue.')

} finally {
  if (previousAccount == null) delete process.env.CLOUDFLARE_ACCOUNT_ID
  else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccount
  if (previousToken == null) delete process.env.CLOUDFLARE_API_TOKEN
  else process.env.CLOUDFLARE_API_TOKEN = previousToken
  if (previousModel == null) delete process.env.CLOUDFLARE_IMAGE_MODEL
  else process.env.CLOUDFLARE_IMAGE_MODEL = previousModel
  if (previousDailyModel == null) delete process.env.CLOUDFLARE_IMAGE_MODEL_DAILY
  else process.env.CLOUDFLARE_IMAGE_MODEL_DAILY = previousDailyModel
  if (previousVisionRequirement == null) delete process.env.STUDIO_IMAGE_REQUIRE_VISION_CRITIC
  else process.env.STUDIO_IMAGE_REQUIRE_VISION_CRITIC = previousVisionRequirement
  if (previousTextInspection == null) delete process.env.STUDIO_IMAGE_INSPECT_TEXT
  else process.env.STUDIO_IMAGE_INSPECT_TEXT = previousTextInspection
  if (previousCandidateAttempts == null) delete process.env.STUDIO_IMAGE_CANDIDATE_ATTEMPTS
  else process.env.STUDIO_IMAGE_CANDIDATE_ATTEMPTS = previousCandidateAttempts
  if (previousTransportAttempts == null) delete process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS
  else process.env.CLOUDFLARE_IMAGE_TRANSPORT_ATTEMPTS = previousTransportAttempts
}
