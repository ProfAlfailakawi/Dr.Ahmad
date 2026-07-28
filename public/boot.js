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

  var isAdmin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  if (isAdmin && navigator.serviceWorker.controller) {
    var swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (swReloaded) return;
      swReloaded = true;
      location.reload();
    });
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(function (registration) {
      if (isAdmin) registration.update().catch(function () {});
    }).catch(function () {});
  });
})();
