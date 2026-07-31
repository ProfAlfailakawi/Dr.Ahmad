import type { User } from 'firebase/auth'
import { getFirebaseApp } from './firebase'

export type AdminPushRegistration = {
  ok: boolean
  token?: string
  registeredDevices?: number
  configured?: boolean
  message: string
}

async function authorizedJson(user: User, path: string, init: RequestInit = {}) {
  const token = await user.getIdToken()
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(payload?.error || 'تعذّر ربط الإشعارات الفورية.'))
  return payload as Record<string, unknown>
}

export async function adminPushStatus(user: User) {
  return authorizedJson(user, '/api/admin/push')
}

/** إشعار تجريبي فوري إلى أجهزة الدكتور المسجّلة — بنفس مسار الإشعار الحقيقي. */
export async function sendAdminPushTest(user: User): Promise<{ sent?: number; configured?: boolean }> {
  return authorizedJson(user, '/api/admin/push', { method: 'PUT' }) as Promise<{ sent?: number; configured?: boolean }>
}

export async function registerAdminPush(user: User): Promise<AdminPushRegistration> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, message: 'هذا المتصفح لا يدعم Push على الويب.' }
  }
  /* «لم يُمنح الإذن» رسالةٌ تصف ولا تُرشد. المتصفح لا يسأل مرتين: من رفض مرة
     لا يظهر له طلبٌ ثانٍ أبداً مهما ضغط الزر، فيظن العطب في الموقع. نفرّق
     بين الرفض السابق (يحتاج فتح إعدادات الموقع) والإغلاق العابر (يعيد
     المحاولة)، ونكتب له الطريق بالضبط على جهازه. */
  const before = Notification.permission
  const permission = before === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
    if (before === 'denied') {
      return {
        ok: false,
        message: isIos
          ? 'الإشعارات مرفوضة سابقاً على هذا الجهاز، والمتصفح لا يسأل مرتين. افتح: إعدادات الجهاز ← الإشعارات ← ابحث عن أيقونة الموقع ← فعّل «السماح بالإشعارات»، ثم ارجع واضغط الزر.'
          : 'الإشعارات مرفوضة سابقاً لهذا الموقع، والمتصفح لا يسأل مرتين. اضغط القفل 🔒 بجانب العنوان ← الإشعارات ← «سماح»، ثم أعد تحميل الصفحة واضغط الزر.',
      }
    }
    if (isIos && !standalone) {
      return { ok: false, message: 'على آيفون لا تعمل الإشعارات إلا من التطبيق المثبّت: افتح الموقع من أيقونته على الشاشة الرئيسية (لا من سفاري)، ثم اضغط الزر.' }
    }
    return { ok: false, message: 'أُغلق طلب الإذن قبل الموافقة. اضغط الزر مرة أخرى واختر «سماح» حين يسألك المتصفح.' }
  }

  const app = await getFirebaseApp()
  if (!app) return { ok: false, message: 'Firebase غير متاح في هذه النسخة.' }
  const messagingModule = await import('firebase/messaging')
  if (!(await messagingModule.isSupported())) return { ok: false, message: 'Push غير مدعوم على هذا الجهاز أو المتصفح.' }
  const config = await authorizedJson(user, '/api/admin/push')
  const vapidKey = String(config.vapidKey || '').trim()
  const registration = await navigator.serviceWorker.ready
  const messaging = messagingModule.getMessaging(app)
  const token = await messagingModule.getToken(messaging, {
    serviceWorkerRegistration: registration,
    ...(vapidKey ? { vapidKey } : {}),
  })
  if (!token) return { ok: false, configured: Boolean(vapidKey), message: 'لم يُصدر Firebase رمز Push لهذا الجهاز.' }
  const saved = await authorizedJson(user, '/api/admin/push', {
    method: 'POST',
    body: JSON.stringify({ token, platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '' }),
  })
  return {
    ok: true,
    token,
    configured: Boolean(vapidKey),
    registeredDevices: Number(saved.registeredDevices || config.registeredDevices || 0) + 1,
    message: vapidKey
      ? 'تم ربط هذا الجهاز بإشعارات Push الحقيقية.'
      : 'تم ربط الجهاز بالمفتاح الافتراضي؛ يفضّل إضافة مفتاح VAPID مخصص لدعم أوسع.',
  }
}
