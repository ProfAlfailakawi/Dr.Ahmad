(function () {
  'use strict';

  var canonicalHost = 'dr-alfailakawi.com';
  var legacyHosts = {
    'www.dr-alfailakawi.com': true,
    'dr-alfailakawi.web.app': true,
    'dr-alfailakawi.firebaseapp.com': true,
  };
  var host = window.location.hostname.toLowerCase();
  if (legacyHosts[host] || (host === canonicalHost && window.location.protocol !== 'https:')) {
    window.location.replace('https://' + canonicalHost + window.location.pathname + window.location.search + window.location.hash);
    return;
  }

  /* ---------- السمة: اختيار الزائر الصريح أوّلاً، ثم تفضيل نظامه ----------
     هذا الملف يُحمَّل في <head> بلا defer/async، فيُنفَّذ قبل أوّل رسمٍ للصفحة:
     الصنف `dark` يوضع على <html> قبل ظهور أيّ بكسل فلا يومض الوضع الخاطئ.
     (سياسة CSP تمنع السكربتات المضمّنة، فهذا الملف الخارجي بديلها المكافئ.)

     ترتيب الأولوية:
       ١) `theme-choice` — اختيار صريح ضغط عليه الزائر (light أو dark).
       ٢) وإلا: prefers-color-scheme من النظام.
     ويسبقهما ترحيلٌ لمرّة واحدة يحترم اختيار من سبق أن اختار الليل بالمفتاح
     القديم `theme`. أمّا 'light' القديم فلا يُعدّ اختياراً: الشيفرة كانت
     تكتبه تلقائياً لكل زائر، فلو عددناه اختياراً لَما تبع أحدٌ نظامه أبداً. */
  var THEME_CHOICE_KEY = 'theme-choice';
  var THEME_LEGACY_KEY = 'theme';
  var THEME_MIGRATED_KEY = 'theme-choice-migrated';
  var DARK_QUERY = '(prefers-color-scheme: dark)';

  /* ترحيلٌ لمرّة واحدة: من كان مفتاحُه القديم 'dark' فقد اختار الليلَ بنفسه،
     فنحفظ اختياره في المفتاح الجديد. تُوضع علامةُ الترحيل فوراً لأن المفتاح
     القديم صار مرآةً للسمة المطبَّقة، فلولا العلامة لَعاد كلُّ اتّباعٍ للنظام
     في الليل اختياراً صريحاً يتجمّد عنده الموقع. */
  try {
    if (!localStorage.getItem(THEME_CHOICE_KEY) && !localStorage.getItem(THEME_MIGRATED_KEY)) {
      if (localStorage.getItem(THEME_LEGACY_KEY) === 'dark') localStorage.setItem(THEME_CHOICE_KEY, 'dark');
      localStorage.setItem(THEME_MIGRATED_KEY, '1');
    }
  } catch (error) { /* التخزين المحلي اختياري */ }

  function readThemeChoice() {
    try {
      var choice = localStorage.getItem(THEME_CHOICE_KEY);
      if (choice === 'dark' || choice === 'light') return choice;
    } catch (error) { /* التخزين المحلي اختياري */ }
    return null;
  }

  function systemPrefersDark() {
    try { return !!(window.matchMedia && window.matchMedia(DARK_QUERY).matches); } catch (error) { return false; }
  }

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    /* شريط المتصفح على الجوّال يتبع السمة نفسها فلا يبقى فاتحاً فوق صفحةٍ ليلية. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#111215' : '#FCFCFA');
    try { localStorage.setItem(THEME_LEGACY_KEY, dark ? 'dark' : 'light'); } catch (error) { /* noop */ }
  }

  var initialChoice = readThemeChoice();
  applyTheme(initialChoice ? initialChoice === 'dark' : systemPrefersDark());

  /* تغيّر تفضيل النظام أثناء الجلسة (غروب/شروق تلقائي) يتبعه الموقع فوراً،
     ما لم يكن للزائر اختيارٌ صريح. */
  try {
    var mediaQuery = window.matchMedia && window.matchMedia(DARK_QUERY);
    if (mediaQuery) {
      var onSystemChange = function (event) {
        if (readThemeChoice()) return;
        applyTheme(event.matches);
        window.dispatchEvent(new CustomEvent('theme:system-changed', { detail: { dark: event.matches } }));
      };
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onSystemChange);
      else if (mediaQuery.addListener) mediaQuery.addListener(onSystemChange);
    }
  } catch (error) { /* المتصفحات القديمة تبقى على السمة الأوّلية */ }

  var html = document.documentElement;
  html.classList.add('js');
  window.__appBootFallbackTimer = window.setTimeout(function () {
    var root = document.getElementById('root');
    var appRendered = html.hasAttribute('data-app-ready') || (root && root.childElementCount > 0);
    if (!appRendered) html.classList.remove('js');
  }, 20000);

  if (!('serviceWorker' in navigator)) return;
  if (location.hostname.includes('ais-dev-') || location.hostname.includes('localhost') || location.hostname.includes('127.0.0.1')) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) { registration.unregister(); });
    });
    if ('caches' in window) caches.keys().then(function (keys) { keys.forEach(function (key) { caches.delete(key); }); });
    return;
  }
  if (location.protocol !== 'https:') return;

  var hadServiceWorkerController = !!navigator.serviceWorker.controller;
  if (hadServiceWorkerController) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var now = Date.now();
      var lastReload = 0;
      try { lastReload = Number(sessionStorage.getItem('sw-controller-reload-at') || 0); } catch (error) {}
      if (now - lastReload < 10000) return;
      try { sessionStorage.setItem('sw-controller-reload-at', String(now)); } catch (error) {}
      location.reload();
    });
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (registration) {
      // لا نعتمد على دورة التحقق الدورية للمتصفح: افحص إصدار الخدمة عند كل فتح.
      // إذا وُجد إصدار جديد فـ skipWaiting + clients.claim في sw.js يستبدلانه فوراً،
      // وcontrollerchange أعلاه يعيد الصفحة مرة واحدة فقط لتأخذ أصول الإصدار الجديد.
      registration.update().catch(function () {});
    }).catch(function () {});
  });
})();
