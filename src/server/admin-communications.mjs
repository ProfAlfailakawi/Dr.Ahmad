import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const safeString = (value, max = 2_000) => String(value ?? '').trim().slice(0, max)
const cleanEmail = (value) => safeString(value, 320).toLowerCase()
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(cleanEmail(value))
const htmlEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const emailHash = (email) => createHash('sha256').update(cleanEmail(email)).digest('hex').slice(0, 32)
const nowIso = () => new Date().toISOString()

function json(res, status, payload, headers = {}) {
  const body = Buffer.from(JSON.stringify(payload))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  })
  res.end(body)
}

function html(res, status, body) {
  const payload = Buffer.from(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>النشرة البريدية</title><body style="margin:0;background:#faf9f6;color:#17202a;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="max-width:620px;border:1px solid #e6e2d8;border-radius:24px;background:white;padding:36px;text-align:center;line-height:1.9">${body}</section></main></body></html>`)
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'content-length': payload.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(payload)
}

async function readJson(req, maximum = 32_768) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maximum) throw Object.assign(new Error('Payload too large'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }) }
}

function createLimiter(limit, windowMs = 60_000) {
  const rows = new Map()
  return (key) => {
    const now = Date.now()
    const current = rows.get(key)
    const row = !current || current.until <= now ? { count: 0, until: now + windowMs } : current
    row.count += 1
    rows.set(key, row)
    if (rows.size > 2_000) for (const [id, value] of rows) if (value.until <= now) rows.delete(id)
    return row.count <= limit
  }
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 120)
}

function unsubscribeSignature(email, secret) {
  return createHmac('sha256', secret).update(cleanEmail(email)).digest('hex').slice(0, 40)
}

function safeSignatureEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b)
}

function newsletterHtml({ subject, text, unsubscribeUrl = '' }) {
  const paragraphs = String(text || '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean)
  const body = paragraphs.map((part) => `<p style="margin:0 0 18px;line-height:1.95;font-size:17px">${htmlEscape(part).replace(/\n/g, '<br>')}</p>`).join('')
  return `<div dir="rtl" style="font-family:Arial,Tahoma,sans-serif;max-width:680px;margin:auto;color:#18202a;background:#fff"><h1 style="font-size:25px;line-height:1.5;margin:0 0 26px">${htmlEscape(subject)}</h1>${body}<hr style="border:0;border-top:1px solid #e8e5df;margin:34px 0 18px"><p style="font-size:12px;line-height:1.8;color:#777">وصلتك هذه الرسالة لأنك اشتركت في النشرة البريدية لد. أحمد حسين الفيلكاوي.${unsubscribeUrl ? ` <a href="${htmlEscape(unsubscribeUrl)}" style="color:#526b7d">إلغاء الاشتراك</a>` : ''}</p></div>`
}

async function resendSingle({ apiKey, from, to, subject, text, html: htmlBody, idempotencyKey }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from, to: [to], subject, text, html: htmlBody }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(safeString(payload?.message || payload?.error || `Resend HTTP ${response.status}`, 500))
  return payload
}

async function resendBatch({ apiKey, messages, idempotencyKey }) {
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify(messages),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(safeString(payload?.message || payload?.error || `Resend HTTP ${response.status}`, 500))
  return payload
}

async function sendAdminPush(getFirestore, { title, body, url = '/admin?tab=inbox', tag = 'admin-alert' }) {
  try {
    const { db } = await getFirestore()
    const snapshot = await db.collection('admin_push_tokens').limit(200).get()
    const rows = snapshot.docs.map((document) => ({ id: document.id, ...(document.data() || {}) })).filter((row) => safeString(row.token, 4096))
    if (!rows.length) return { sent: 0, configured: false }
    const { getMessaging } = await import('firebase-admin/messaging')
    const response = await getMessaging().sendEachForMulticast({
      tokens: rows.map((row) => row.token),
      data: {
        title: safeString(title, 120),
        body: safeString(body, 360),
        url: safeString(url, 500),
        tag: safeString(tag, 120),
      },
      webpush: { headers: { Urgency: 'high' } },
    })
    const invalid = []
    response.responses.forEach((result, index) => {
      const code = String(result.error?.code || '')
      if (!result.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/i.test(code)) invalid.push(rows[index]?.id)
    })
    await Promise.all(invalid.filter(Boolean).map((id) => db.collection('admin_push_tokens').doc(id).delete().catch(() => {})))
    return { sent: response.successCount, failed: response.failureCount, configured: true }
  } catch (error) {
    console.warn('[admin-push]', error instanceof Error ? error.message : error)
    return { sent: 0, failed: 0, configured: false, error: safeString(error instanceof Error ? error.message : error, 300) }
  }
}

async function writeDeliveryRows({ db, FieldValue, sendId, recipients, state, providerIds = [] }) {
  const chunkSize = 350
  for (let offset = 0; offset < recipients.length; offset += chunkSize) {
    const batch = db.batch()
    recipients.slice(offset, offset + chunkSize).forEach((email, index) => {
      const providerId = providerIds[offset + index] || ''
      const ref = db.collection('newsletter_deliveries').doc(`${sendId}-${emailHash(email)}`)
      batch.set(ref, { sendId, email, state, providerId, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true })
    })
    await batch.commit()
  }
}

export function communicationsHealth() {
  const resendReady = Boolean(safeString(process.env.RESEND_API_KEY, 500) && safeString(process.env.NEWSLETTER_FROM_EMAIL, 320))
  const unsubscribeReady = Boolean(safeString(process.env.NEWSLETTER_UNSUBSCRIBE_SECRET, 500))
  const vapidReady = Boolean(safeString(process.env.FIREBASE_WEB_PUSH_VAPID_KEY || process.env.VITE_FIREBASE_VAPID_KEY, 2_000))
  return {
    newsletterReady: resendReady && unsubscribeReady,
    resendReady,
    unsubscribeReady,
    vapidReady,
    from: safeString(process.env.NEWSLETTER_FROM_EMAIL, 320),
  }
}

export function createAdminCommunications({ getFirestore, verifyAdminRequest }) {
  const allowContact = createLimiter(8)
  const allowSubscribe = createLimiter(12)

  const requireAdmin = async (req) => {
    const claims = await verifyAdminRequest(req)
    if (!claims?.admin) throw Object.assign(new Error('Admin access required'), { status: 403 })
    return claims
  }

  return async function handleAdminCommunications(req, res, url, method) {
    try {
      if (url.pathname === '/api/contact') {
        if (method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }, { allow: 'POST' }); return true }
        if (!allowContact(clientIp(req))) throw Object.assign(new Error('Too many requests'), { status: 429 })
        const body = await readJson(req, 16_384)
        const name = safeString(body.name, 100)
        const email = cleanEmail(body.email)
        const topic = safeString(body.topic || 'أخرى', 80)
        const message = safeString(body.message, 3_000)
        if (name.length < 2 || !validEmail(email) || message.length < 10) throw Object.assign(new Error('Invalid message'), { status: 400 })
        const reference = safeString(body.reference, 80) || `AH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(1000 + Math.random() * 9000))}`
        const { db, FieldValue } = await getFirestore()
        const ref = db.collection('messages').doc()
        await ref.set({
          name, email, topic, message, reference,
          intent: safeString(body.intent, 120), quality: safeString(body.quality, 120),
          createdAt: FieldValue.serverTimestamp(), source: 'website-api',
        })
        void sendAdminPush(getFirestore, { title: 'رسالة جديدة وصلت إلى الموقع', body: [name, topic].filter(Boolean).join(' — '), tag: `site-message-${ref.id}` })
        json(res, 201, { ok: true, id: ref.id, reference })
        return true
      }

      if (url.pathname === '/api/newsletter/subscribe') {
        if (method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }, { allow: 'POST' }); return true }
        if (!allowSubscribe(clientIp(req))) throw Object.assign(new Error('Too many requests'), { status: 429 })
        const body = await readJson(req, 4_096)
        const email = cleanEmail(body.email)
        if (!validEmail(email)) throw Object.assign(new Error('Invalid email'), { status: 400 })
        const { db, FieldValue } = await getFirestore()
        const ref = db.collection('subscribers').doc(email)
        const before = await ref.get()
        await ref.set({ email, active: true, source: 'website-api', updatedAt: FieldValue.serverTimestamp(), ...(before.exists ? {} : { createdAt: FieldValue.serverTimestamp() }) }, { merge: true })
        if (!before.exists) void sendAdminPush(getFirestore, { title: 'مشترك جديد في النشرة', body: `${email} اشترك في النشرة البريدية.`, tag: `newsletter-subscriber-${emailHash(email)}` })
        json(res, 200, { ok: true, created: !before.exists })
        return true
      }

      if (url.pathname === '/api/newsletter/unsubscribe') {
        if (method !== 'GET') { json(res, 405, { error: 'Method Not Allowed' }, { allow: 'GET' }); return true }
        const email = cleanEmail(url.searchParams.get('email'))
        const sig = safeString(url.searchParams.get('sig'), 100)
        const secret = safeString(process.env.NEWSLETTER_UNSUBSCRIBE_SECRET, 500)
        if (!secret || !validEmail(email) || !safeSignatureEqual(sig, unsubscribeSignature(email, secret))) {
          html(res, 400, '<h1 style="margin-top:0">الرابط غير صالح</h1><p>لم يتم تغيير اشتراكك.</p>')
          return true
        }
        const { db } = await getFirestore()
        await db.collection('subscribers').doc(email).delete()
        html(res, 200, '<h1 style="margin-top:0">تم إلغاء الاشتراك.</h1><p>لن تصلك النشرة البريدية مرة أخرى من هذا العنوان.</p>')
        return true
      }

      if (url.pathname === '/api/admin/push') {
        const claims = await requireAdmin(req)
        const { db, FieldValue } = await getFirestore()
        if (method === 'GET') {
          const snapshot = await db.collection('admin_push_tokens').limit(50).get()
          const vapidKey = safeString(process.env.FIREBASE_WEB_PUSH_VAPID_KEY || process.env.VITE_FIREBASE_VAPID_KEY, 2_000)
          json(res, 200, { ok: true, registeredDevices: snapshot.size, vapidKey, configured: Boolean(vapidKey) })
          return true
        }
        if (method === 'POST') {
          const body = await readJson(req, 16_384)
          const token = safeString(body.token, 8_192)
          if (token.length < 80) throw Object.assign(new Error('Invalid push token'), { status: 400 })
          const id = createHash('sha256').update(token).digest('hex').slice(0, 40)
          await db.collection('admin_push_tokens').doc(id).set({
            token,
            ownerUid: safeString(claims.sub, 200),
            email: cleanEmail(claims.email),
            userAgent: safeString(req.headers['user-agent'], 600),
            platform: safeString(body.platform, 120),
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          }, { merge: true })
          json(res, 200, { ok: true, id })
          return true
        }
        if (method === 'DELETE') {
          const body = await readJson(req, 16_384)
          const token = safeString(body.token, 8_192)
          if (token) await db.collection('admin_push_tokens').doc(createHash('sha256').update(token).digest('hex').slice(0, 40)).delete()
          json(res, 200, { ok: true })
          return true
        }
        json(res, 405, { error: 'Method Not Allowed' }, { allow: 'GET, POST, DELETE' })
        return true
      }

      if (url.pathname === '/api/admin/newsletter') {
        const claims = await requireAdmin(req)
        const { db, FieldValue } = await getFirestore()
        const config = communicationsHealth()
        if (method === 'GET') {
          const [subscribersSnapshot, sendsSnapshot] = await Promise.all([
            db.collection('subscribers').limit(5_000).get(),
            db.collection('newsletter_sends').orderBy('createdAt', 'desc').limit(12).get().catch(() => ({ docs: [] })),
          ])
          const sends = sendsSnapshot.docs.map((document) => ({ id: document.id, ...(document.data() || {}) }))
          const recentIds = sends.slice(0, 5).map((row) => row.id)
          let deliveries = []
          if (recentIds.length) {
            const deliverySnapshot = await db.collection('newsletter_deliveries').where('sendId', 'in', recentIds).limit(300).get().catch(() => ({ docs: [] }))
            deliveries = deliverySnapshot.docs.map((document) => ({ id: document.id, ...(document.data() || {}) }))
          }
          json(res, 200, {
            ok: true,
            configured: config.newsletterReady,
            provider: config.resendReady ? 'Resend' : 'غير مربوط',
            from: config.from,
            recipientCount: subscribersSnapshot.size,
            testEmail: cleanEmail(claims.email || process.env.ADMIN_NOTIFICATION_EMAIL),
            missing: [!config.resendReady ? 'RESEND_API_KEY + NEWSLETTER_FROM_EMAIL' : '', !config.unsubscribeReady ? 'NEWSLETTER_UNSUBSCRIBE_SECRET' : ''].filter(Boolean),
            sends,
            deliveries,
          })
          return true
        }
        if (method !== 'POST') { json(res, 405, { error: 'Method Not Allowed' }, { allow: 'GET, POST' }); return true }
        const body = await readJson(req, 64_000)
        const action = safeString(body.action, 30)
        const subject = safeString(body.subject, 220)
        const text = safeString(body.text, 20_000)
        if (!subject || text.length < 20) throw Object.assign(new Error('العنوان والنص مطلوبان'), { status: 400 })
        if (!config.resendReady) throw Object.assign(new Error('مزوّد البريد غير مربوط بعد: اضبط RESEND_API_KEY وNEWSLETTER_FROM_EMAIL'), { status: 503 })
        if (action === 'test') {
          const target = cleanEmail(body.to || claims.email || process.env.ADMIN_NOTIFICATION_EMAIL)
          if (!validEmail(target)) throw Object.assign(new Error('لا يوجد بريد اختبار صالح لحساب المشرف'), { status: 400 })
          const sendId = `test-${Date.now()}-${emailHash(target).slice(0, 8)}`
          const result = await resendSingle({ apiKey: process.env.RESEND_API_KEY, from: config.from, to: target, subject: `[اختبار] ${subject}`, text, html: newsletterHtml({ subject, text }), idempotencyKey: `newsletter-${sendId}` })
          await db.collection('newsletter_sends').doc(sendId).set({ subject, text, kind: 'test', recipientCount: 1, acceptedCount: 1, failedCount: 0, provider: 'resend', providerId: safeString(result?.id, 200), createdBy: safeString(claims.sub, 200), createdAt: FieldValue.serverTimestamp() })
          await writeDeliveryRows({ db, FieldValue, sendId, recipients: [target], state: 'accepted', providerIds: [safeString(result?.id, 200)] })
          json(res, 200, { ok: true, sendId, accepted: 1, target })
          return true
        }
        if (action !== 'send' || body.confirm !== 'SEND_TO_ALL') throw Object.assign(new Error('تأكيد الإرسال الكامل مطلوب'), { status: 400 })
        if (!config.unsubscribeReady) throw Object.assign(new Error('NEWSLETTER_UNSUBSCRIBE_SECRET مطلوب قبل الإرسال الجماعي'), { status: 503 })
        const subscriberSnapshot = await db.collection('subscribers').limit(5_000).get()
        const recipients = [...new Set(subscriberSnapshot.docs.map((document) => cleanEmail(document.data()?.email || document.id)).filter(validEmail))]
        if (!recipients.length) throw Object.assign(new Error('لا يوجد مشتركون صالحون للإرسال'), { status: 400 })
        const sendId = `newsletter-${Date.now()}-${createHash('sha1').update(`${subject}|${text}`).digest('hex').slice(0, 10)}`
        await db.collection('newsletter_sends').doc(sendId).set({ subject, text, kind: 'broadcast', recipientCount: recipients.length, acceptedCount: 0, failedCount: 0, status: 'sending', provider: 'resend', createdBy: safeString(claims.sub, 200), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
        let accepted = 0
        let failed = 0
        for (let offset = 0; offset < recipients.length; offset += 100) {
          const chunk = recipients.slice(offset, offset + 100)
          const messages = chunk.map((email) => {
            const sig = unsubscribeSignature(email, process.env.NEWSLETTER_UNSUBSCRIBE_SECRET)
            const unsubscribeUrl = `https://dr-alfailakawi.com/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}&sig=${encodeURIComponent(sig)}`
            return { from: config.from, to: [email], subject, text, html: newsletterHtml({ subject, text, unsubscribeUrl }) }
          })
          try {
            const response = await resendBatch({ apiKey: process.env.RESEND_API_KEY, messages, idempotencyKey: `${sendId}-batch-${offset / 100}` })
            const ids = Array.isArray(response?.data) ? response.data.map((item) => safeString(item?.id, 200)) : []
            accepted += chunk.length
            await writeDeliveryRows({ db, FieldValue, sendId, recipients: chunk, state: 'accepted', providerIds: ids })
          } catch (error) {
            failed += chunk.length
            await writeDeliveryRows({ db, FieldValue, sendId, recipients: chunk, state: 'failed' })
            console.error('[newsletter-batch]', offset, error instanceof Error ? error.message : error)
          }
        }
        await db.collection('newsletter_sends').doc(sendId).set({ acceptedCount: accepted, failedCount: failed, status: failed ? (accepted ? 'partial' : 'failed') : 'sent', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        json(res, failed && !accepted ? 502 : 200, { ok: accepted > 0, sendId, recipients: recipients.length, accepted, failed })
        return true
      }

      return false
    } catch (error) {
      const status = Number(error?.status || 500)
      json(res, status >= 400 && status <= 599 ? status : 500, { error: safeString(error instanceof Error ? error.message : error, 700) || 'Request failed' })
      return true
    }
  }
}
