#!/usr/bin/env node
/**
 * حارس إشعارات لوحة التحكم داخل التطبيق الأصلي (WKWebView) مقابل المتصفح.
 * (أ) داخل التطبيق: لا Notification، لكن إضافة PushNotifications موجودة، فيجب أن تُقرأ
 *     حالة الإذن من النظام لا أن تُعدّ «غير مدعومة»، ولا يظهر نص «المتصفح/PWA».
 * (ب) في المتصفح: السلوك السابق كما هو (Notification.permission أو unsupported).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

let checks = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1 }
const ok = (c, m) => { assert.ok(c, m); checks += 1 }

const { isNativeShell } = await import('../src/lib/native-shell.ts')
const { initialAdminPushPermission, readAdminPushPermission } = await import('../src/lib/admin-push-state.ts')

/* (ب) المتصفح: لا Capacitor ولا Notification */
delete globalThis.Capacitor
delete globalThis.Notification
eq(isNativeShell(), false, 'المتصفح ليس غلافاً أصلياً')
eq(initialAdminPushPermission(), 'unsupported', 'متصفح بلا Notification: unsupported')
eq(await readAdminPushPermission(), 'unsupported', 'قراءة المتصفح بلا Notification')
for (const perm of ['granted', 'denied', 'default']) {
  globalThis.Notification = { permission: perm }
  eq(initialAdminPushPermission(), perm, `متصفح: ${perm} كما هو`)
  eq(await readAdminPushPermission(), perm, `قراءة المتصفح: ${perm}`)
}

/* متصفح iOS Safari/Android: Capacitor غير موجود حتى لو وُجد كائن آخر */
globalThis.Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' }
eq(isNativeShell(), false, 'Capacitor ويب: ليس أصلياً')
eq(initialAdminPushPermission(), 'default', 'ويب مع Capacitor غير أصلي: يبقى على Notification')

/* (أ) التطبيق: لا Notification، والإضافة موجودة */
delete globalThis.Notification
let nativePerm = 'prompt'
globalThis.Capacitor = {
  isNativePlatform: () => true,
  getPlatform: () => 'ios',
  Plugins: { PushNotifications: { checkPermissions: async () => ({ receive: nativePerm }), requestPermissions: async () => ({ receive: 'granted' }), register: async () => {}, addListener: async () => ({ remove: async () => {} }) } },
}
eq(isNativeShell(), true, 'غلاف أصلي')
eq(initialAdminPushPermission(), 'default', 'التطبيق: ليس unsupported رغم غياب Notification')
eq(await readAdminPushPermission(), 'default', 'prompt ← default')
nativePerm = 'granted'
eq(await readAdminPushPermission(), 'granted', 'إذن النظام الممنوح')
nativePerm = 'denied'
eq(await readAdminPushPermission(), 'denied', 'إذن النظام المرفوض')

/* التطبيق بلا إضافة (نسخة قديمة): unsupported بنص عربي مناسب للتطبيق */
globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {} }
eq(await readAdminPushPermission(), 'unsupported', 'بلا إضافة: unsupported')

/* مصدر Admin.tsx: لا نص PWA ولا «المتصفح» في مسار التطبيق */
const admin = readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8')
ok(/pwaEntry && !isNativeShell\(\)/.test(admin), 'نص PWA مخفي داخل التطبيق')
ok(/nativeShell \? 'إشعارات النظام غير متاحة في هذا التطبيق\.' : 'هذا المتصفح لا يدعم Push على الويب\.'/.test(admin), 'نص عدم الدعم متفرّع (التطبيق/المتصفح)')
ok(/native \? 'اضغط الزر ثم اسمح للتطبيق\.' : 'اضغط الزر ثم اسمح للمتصفح\.'/.test(admin), 'نص السماح متفرّع')
ok(!/typeof Notification === 'undefined' \? 'unsupported'/.test(admin), 'لا قراءة مباشرة لـNotification لحالة اللوحة')

console.log(`native-admin-push: ${checks} فحصاً ناجحاً`)
