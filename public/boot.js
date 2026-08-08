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

  try {
    if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
  } catch (error) { /* التخزين المحلي اختياري */ }

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
