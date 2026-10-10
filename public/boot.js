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

  /* ---------- السمة: النهار هو الأصل دائماً ----------
     لا يتحوّل الموقع إلى الليل إلا باختيارٍ صريحٍ من الزائر بنفسه (زر القمر/الشمس)؛ وتفضيل جهازه
     (prefers-color-scheme) لا يُقرأ هنا ولا في أيّ مكانٍ آخر.
     هذا الملف يُحمَّل في <head> بلا defer/async، فيُنفَّذ قبل أوّل رسمٍ للصفحة: الصنف `dark`
     يوضع على <html> قبل ظهور أيّ بكسل فلا يومض الوضع الخاطئ.
     (سياسة CSP تمنع السكربتات المضمّنة، فهذا الملف الخارجي بديلها المكافئ.)

     المفتاح `theme-choice` (light أو dark) هو الاختيار الصريح الوحيد. والمفتاح القديم `theme`:
     ترحيلٌ لمرّة واحدة يحترم من سبق أن اختار الليل بالزر (القيمة 'dark' آنذاك)، ثم لا يُقرأ بعد
     ذلك أبداً؛ فقيمٌ كُتبت فيه آليّاً من نسخةٍ سابقة (تتبّع الجهاز) لا تُعدّ اختياراً. */
  var THEME_CHOICE_KEY = 'theme-choice';
  var THEME_LEGACY_KEY = 'theme';
  var THEME_MIGRATED_KEY = 'theme-choice-migrated';

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

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    /* شريط المتصفح على الجوّال يتبع السمة نفسها فلا يبقى فاتحاً فوق صفحةٍ ليلية. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#111215' : '#FCFCFA');
  }

  applyTheme(readThemeChoice() === 'dark');

  var html = document.documentElement;
  html.classList.add('js');

  /* ---------- تسليم الافتتاحية إلى React ----------
     العلامة الكوفية مرسومةٌ في index.html نفسه فتظهر مع أوّل بكسل. حين
     يُركّب React يضع `data-app-ready` على <html>، فنُلاشيها 300ms ثم نزيلها:
     تسليمٌ بلا قفزةٍ ولا وميض. (main.tsx ينقلها خارج #root قبل التركيب كي
     لا يمسحها React فجأةً بلا تلاشٍ.)

     ولا تحبس الواجهة أبداً: إن تأخّر التركيب أُزيلت بعد 12s — قبل مهلة
     الإقلاع (20s) التي تكشف الصفحة الثابتة — كما يخفيها نزعُ الصنف `js`
     هناك وحده، فهي شبكتا أمانٍ متعاقبتان لا متعارضتان. */
  var splashRemoved = false;
  var splashShownAt = Date.now();
  /* حدٌّ أدنى للبقاء على الشاشة. الكشف خليةً خليةً ينتهي عند ‎880ms تقريباً،
     وكان التسليم يجري لحظة ظهور `data-app-ready` بلا انتظار: على كاشٍ دافئ
     يُركَّب React خلال ‎300ms فتُنتزع العلامة وهي ثلثُ مرسومة — فلا يرى
     الزائر علامةً بل شكلاً عابراً، وهو أسوأ من غياب الافتتاحية أصلاً.
     ‎1800ms تُكمل الرسم وتترك مهلةً حقيقيةً لقراءته قبل التلاشي. */
  var SPLASH_MIN_MS = 1800;
  var SPLASH_MIN_REDUCED_MS = 1000;
  function splashHoldRemaining() {
    var reduced = false;
    try {
      reduced = typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) { /* بلا matchMedia: يُؤخَذ الحدّ الكامل */ }
    var floor = reduced ? SPLASH_MIN_REDUCED_MS : SPLASH_MIN_MS;
    return Math.max(0, floor - (Date.now() - splashShownAt));
  }
  function removeBootSplash(immediate) {
    var splash = document.getElementById('boot-splash');
    if (!splash) return;
    if (immediate) { splash.remove(); return; }
    splash.classList.add('is-leaving');
    window.setTimeout(function () { splash.remove(); }, 360);
  }
  function dismissBootSplash(immediate) {
    if (splashRemoved) return;
    if (!document.getElementById('boot-splash')) return;
    splashRemoved = true;
    /* `immediate` هو شبكة الأمان (12s أو تطبيقٌ جاهزٌ سلفاً): تُنفَّذ بلا مهلة. */
    if (immediate) { removeBootSplash(true); return; }
    var wait = splashHoldRemaining();
    if (wait === 0) { removeBootSplash(false); return; }
    window.setTimeout(function () { removeBootSplash(false); }, wait);
  }
  if (html.hasAttribute('data-app-ready')) dismissBootSplash(false);
  else {
    try {
      var appReadyObserver = new MutationObserver(function () {
        if (!html.hasAttribute('data-app-ready')) return;
        appReadyObserver.disconnect();
        dismissBootSplash(false);
      });
      appReadyObserver.observe(html, { attributes: true, attributeFilter: ['data-app-ready'] });
    } catch (error) { /* بلا مراقب: مهلة الأمان أدناه تكفي */ }
  }
  window.setTimeout(function () { dismissBootSplash(true); }, 12000);

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
    // لا إعادة تحميل فوق عملٍ جارٍ: التوليد في الاستوديو يعلّم الجذر aria-busy،
    // فيُؤجَّل التبديل إلى الإصدار الجديد حتى تنتهي العملية (كانت الصفحة تُعاد
    // بعد ٢٠–٣٠ ثانية من «ولّد من الصفر» فيضيع التقدم كله).
    var pageBusy = function () {
      try { return html.getAttribute('aria-busy') === 'true'; } catch (error) { return false; }
    };
    var reloadWhenIdle = function () {
      if (pageBusy()) { window.setTimeout(reloadWhenIdle, 4000); return; }
      var now = Date.now();
      var lastReload = 0;
      try { lastReload = Number(sessionStorage.getItem('sw-controller-reload-at') || 0); } catch (error) {}
      if (now - lastReload < 10000) return;
      try { sessionStorage.setItem('sw-controller-reload-at', String(now)); } catch (error) {}
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadWhenIdle);
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
