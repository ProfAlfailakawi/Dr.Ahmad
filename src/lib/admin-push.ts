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
  /* آيباد الحديث يعلن نفسه Macintosh، فكان يصله نصُّ الكمبيوتر («اضغط القفل
     🔒 بجانب العنوان») وهو مستحيلٌ داخل تطبيقٍ مثبّت. */
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1)
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
  const permission = before === 'granted' ? 'granted' : await Notification.requestPermission()
  /* **بصمة الحالة**: ثلاث ليالٍ من الإصلاحات ضاعت لأن الرسائل كانت تصف ولا
     تقيس — فلا نعرف أي فرعٍ وصله الدكتور ولا هل ظهرت نافذة الإذن أصلاً.
     الآن تُلحق بكل عودةٍ غير ناجحة: الإذن قبل←بعد (denied→denied تعني أن
     النافذة لم تظهر قط؛ default→denied تعني أنها ظهرت ورُفضت)، والوضع
     (مثبّت/متصفح). لقطةٌ واحدة تكفي للتشخيص بلا تخمين. */
  const stamp = ` [الإذن: ${before}→${permission} · ${standalone ? 'مثبّت' : 'متصفح'}]`
  if (permission !== 'granted') {
    /* ترتيب الشرطين حاكم (لقطة الدكتور ٣١ يوليو): على آيفون **خارج التطبيق
       المثبّت** تكون الحالة `denied` افتراضاً — لا لأن أحداً رفض، بل لأن iOS
       لا يمنح Push لموقعٍ في سفاري أصلاً. وحين كان فحص «مرفوضة سابقاً» يسبق،
       كانت البطاقة ترسله إلى: إعدادات الجهاز ← الإشعارات ← «ابحث عن أيقونة
       الموقع» — **وهي إرشادةٌ لا يمكن تنفيذها**، لأن موقعاً غير مثبّتٍ لا
       يظهر في تلك القائمة قط. فيظن العطب في الموقع وهو في الطريق.
       لذلك: حالة آيفون-غير-مثبّت تُفحص أولاً وتُعطي الطريق الحقيقي. */
    if (isIos && !standalone) {
      return { ok: false, message: 'على آيفون لا تعمل الإشعارات إلا من التطبيق المثبّت: افتح سفاري ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم افتح الموقع من أيقونته (لا من سفاري) واضغط الزر. الموقع لا يظهر في إعدادات الإشعارات قبل تثبيته.' }
    }
    /* على آيفون **داخل التطبيق المثبّت** لا تتكرر نافذة الإذن أبداً: واحدةٌ
       لكل تثبيت. فالعلاج النافع هو إعادة التثبيت لا زيارة الإعدادات (وتطبيقٌ
       رُفض إذنه قد لا يُدرَج في تلك القائمة أصلاً). ولذلك تُصدَّر إعادةُ
       التثبيت، وتُذكر الإعدادات بديلاً، مع تحذير تسجيل الدخول لأن حذف
       الأيقونة يمحو تخزين التطبيق ومنه جلسة الدخول. */
    const iosReinstall = 'الإذن مرفوض على مستوى النظام، وآيفون لا يسأل مرتين — لديك نافذةٌ واحدة لكل تثبيت. الحل: اضغط مطوّلاً على أيقونة الموقع ← حذف، ثم افتح سفاري على dr-alfailakawi.com ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، وافتح من الأيقونة الجديدة واضغط الزر واختر «سماح». (وإن وجدت الموقع في إعدادات الجهاز ← الإشعارات فيمكنك تفعيله من هناك بلا إعادة تثبيت.) تنبيه: إعادة التثبيت تتطلب تسجيل دخولٍ جديد للوحة.'
    if (isIos && standalone) return { ok: false, message: iosReinstall + stamp }
    if (before === 'denied') {
      return {
        ok: false,
        message: isIos
          ? iosReinstall + stamp
          : 'الإشعارات مرفوضة سابقاً لهذا الموقع، والمتصفح لا يسأل مرتين. اضغط القفل 🔒 بجانب العنوان ← الإشعارات ← «سماح»، ثم أعد تحميل الصفحة واضغط الزر.' + stamp,
      }
    }
    return { ok: false, message: 'أُغلق طلب الإذن قبل الموافقة. اضغط الزر مرة أخرى واختر «سماح» حين يسألك المتصفح.' + stamp }
  }

  const app = await getFirebaseApp()
  if (!app) return { ok: false, message: 'Firebase غير متاح في هذه النسخة.' }
  const messagingModule = await import('firebase/messaging')
  if (!(await messagingModule.isSupported())) {
    /* الرسالة العامة لا تُرشد. على آيفون يكون السبب دائماً واحداً من اثنين:
       نظامٌ أقدم من 16.4، أو أيقونةٌ مثبّتة قبل تفعيل الإشعارات فبقيت بلا
       صلاحياتها — وكلاهما له علاجٌ مختلف. */
    return {
      ok: false,
      message: isIos
        ? 'رفض Firebase تفعيل Push داخل هذا التطبيق المثبّت. تأكّد أن نظام آيفون 16.4 فأحدث، ثم احذف أيقونة الموقع من الشاشة الرئيسية وأعد تثبيتها من سفاري (الأيقونات القديمة تبقى بلا صلاحية إشعارات).'
        : 'Push غير مدعوم على هذا الجهاز أو المتصفح.',
    }
  }
  const config = await authorizedJson(user, '/api/admin/push')
  const vapidKey = String(config.vapidKey || '').trim()
  const registration = await navigator.serviceWorker.ready
  const messaging = messagingModule.getMessaging(app)
  /* «تعمل على الكمبيوتر ولا تعمل في التطبيق المثبّت» (ملاحظة الدكتور): الخادم
     والمفتاح مُثبتان سليمين بعمل الكمبيوتر، فالعطب في إصدار الرمز على الجهاز.
     كان خطأ Firebase يصعد خاماً بالإنجليزية فلا يُفهم منه شيء. الآن يُترجَم
     برمزه إلى سببٍ وعلاجٍ بالعربية — فتشخّص البطاقة نفسها بدل أن تصف. */
  let token = ''
  try {
    token = await messagingModule.getToken(messaging, {
      serviceWorkerRegistration: registration,
      ...(vapidKey ? { vapidKey } : {}),
    })
  } catch (error) {
    const code = String((error as { code?: string })?.code || '')
    const raw = error instanceof Error ? error.message : String(error)
    const explain = code.includes('permission-blocked') || code.includes('permission-default')
      ? 'رفض الجهازُ الإذنَ عند إصدار الرمز. افتح إعدادات الإشعارات لهذا التطبيق وفعّل السماح.'
      : code.includes('unsupported-browser')
        ? 'هذه النسخة من النظام لا تدعم Push في التطبيقات المثبّتة. يلزم آيفون بنظام 16.4 فأحدث.'
        : code.includes('failed-service-worker-registration')
          ? 'تعذّر تسجيل عامل الخدمة داخل التطبيق المثبّت. احذف الأيقونة من الشاشة الرئيسية وأعد تثبيت الموقع، ثم أعد المحاولة.'
          : code.includes('token-subscribe-failed') || code.includes('token-subscribe')
            ? 'رفض خادمُ Firebase اشتراكَ هذا الجهاز. غالباً لأن الأيقونة المثبّتة قديمة سابقة لتفعيل الإشعارات — أعد تثبيت الموقع من سفاري.'
            : 'تعذّر إصدار رمز Push على هذا الجهاز.'
    return { ok: false, configured: Boolean(vapidKey), message: `${explain} (${code || 'بلا رمز'}: ${raw.slice(0, 120)})${stamp}` }
  }
  if (!token) return { ok: false, configured: Boolean(vapidKey), message: 'لم يُصدر Firebase رمز Push لهذا الجهاز — ولم يُبلّغ عن سبب. أعد تثبيت الموقع على الشاشة الرئيسية ثم حاول.' }
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
