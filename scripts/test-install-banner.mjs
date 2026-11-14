#!/usr/bin/env node
/** اختبار منطق شريط التثبيت: src/shared/install-banner.ts */
import assert from 'node:assert/strict'
import { resolveInstallBanner, APP_STORE_URL, PLAY_STORE_URL } from '../src/shared/install-banner.ts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
let n = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n += 1 }

eq(APP_STORE_URL, 'https://apps.apple.com/app/id6834582484', 'APP_STORE_URL')
eq(PLAY_STORE_URL, '', 'PLAY_STORE_URL فارغ')
eq(resolveInstallBanner({ userAgent: IPHONE, capacitorNative: true }), { show: false, reason: 'native-shell' }, 'غلاف iOS لا يعرض')
eq(resolveInstallBanner({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 5, capacitorNative: true }).show, false, 'غلاف iPad لا يعرض')
eq(resolveInstallBanner({ userAgent: IPHONE }), { show: true, action: 'open-store', url: APP_STORE_URL, store: 'app-store' }, 'iPhone Safari')
eq(resolveInstallBanner({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 5 }).action, 'open-store', 'iPad بصيغة Mac')
eq(resolveInstallBanner({ userAgent: DESKTOP, platform: 'MacIntel', maxTouchPoints: 0 }), { show: true, action: 'pwa-prompt' }, 'Mac سطح مكتب')
eq(resolveInstallBanner({ userAgent: IPHONE, standalone: true }), { show: false, reason: 'already-installed' }, 'مثبّت')
eq(resolveInstallBanner({ userAgent: ANDROID }), { show: true, action: 'pwa-prompt' }, 'Android بلا رابط Play')
eq(resolveInstallBanner({ userAgent: ANDROID }, { playStore: 'https://play.google.com/store/apps/details?id=x' }), { show: true, action: 'open-store', url: 'https://play.google.com/store/apps/details?id=x', store: 'play-store' }, 'Android مع Play')
eq(resolveInstallBanner({ userAgent: DESKTOP }), { show: true, action: 'pwa-prompt' }, 'سطح المكتب')
eq(resolveInstallBanner({}), { show: true, action: 'pwa-prompt' }, 'بيئة فارغة')
console.log(`install-banner: ${n} checks passed`)
