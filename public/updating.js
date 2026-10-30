/*
 * منطق صفحة «الموقع قيد التحديث» (public/updating.html).
 *
 * ملفٌّ خارجي لأن سياسة CSP في الموقع تمنع السكربت المضمّن. يُحمَّل في <head>
 * بلا defer: يضع سمة الليل قبل أول رسمٍ إن اختارها الزائر بنفسه (theme-choice،
 * كما في boot.js)، ثم ينتظر اكتمال الصفحة.
 *
 * يسأل /api/version كل ثلاث ثوانٍ (ويتباطأ إلى خمس عشرة)، فإذا أجاب أعاد فتح
 * الصفحة المطلوبة. وإن عادت الصفحةُ تتعثّر والخادمُ سليم ثلاثَ مرّاتٍ في دقيقتين،
 * تباطأ إلى مرّةٍ كل نصف دقيقة ولا يدور في حلقة.
 */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('theme-choice') === 'dark') {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#111215');
    }
  } catch (error) { /* التخزين المحلي اختياري */ }

  var HEALTH = '/api/version';
  var FIRST = 3000, CEILING = 15000, PATIENT = 30000;
  var KEY = 'alfailakawi-updating-reloads';
  var tries = 0, timer = 0, asking = false;
  var title, lead, note;

  /* إعاداتُ التحميل في الدقيقتين الأخيرتين: ثلاثٌ والخادمُ سليم تعني أن الصفحة
     نفسها تتعثّر، فلا ندور في حلقة. */
  function recent() {
    try {
      var now = Date.now();
      return JSON.parse(sessionStorage.getItem(KEY) || '[]').filter(function (t) { return now - t < 120000; });
    } catch (error) { return []; }
  }
  function remember() {
    try { var list = recent(); list.push(Date.now()); sessionStorage.setItem(KEY, JSON.stringify(list)); } catch (error) { /* اختياري */ }
  }
  function stuck() { return recent().length >= 3; }

  /* فُتحت هذه الصفحة باسمها مباشرة: العودة إلى الرئيسية، لا إليها. */
  function isSelf() { return /^\/updating(?:\.html)?\/?$/.test(location.pathname); }
  function reopen() {
    if (isSelf()) location.replace('/');
    else location.reload();
  }

  var HEADLINE = 'نُجدّد الموقع، ونعود بعد قليل';
  function describe() {
    if (navigator.onLine === false) {
      title.textContent = 'انقطع الاتصال بالإنترنت';
      lead.textContent = 'ما كنت تقرؤه باقٍ في موضعه؛ ستعود الصفحة وحدها حين يعود الاتصال.';
      note.textContent = '';
    } else if (stuck()) {
      title.textContent = HEADLINE;
      lead.textContent = 'يطول التجديد هذه المرّة أكثر من عادته، وما كنت تقرؤه باقٍ في موضعه.';
      note.textContent = 'سنعيد المحاولة كل نصف دقيقة، ولك أن تفتح الصفحة الآن.';
    } else {
      title.textContent = HEADLINE;
      lead.textContent = 'يُجدَّد الموقع في هذه الدقائق؛ عُد بعد قليل تجد ما كنت تقرؤه في موضعه.';
      note.textContent = 'ستعود هذه الصفحة وحدها حين يكتمل التجديد.';
    }
  }

  /* سطر العدد: تاريخ اليوم بتوقيت الكويت. */
  function dateIssue() {
    var slot = document.getElementById('issue-date');
    if (!slot) return;
    try {
      slot.textContent = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { dateStyle: 'long', timeZone: 'Asia/Kuwait' }).format(new Date());
    } catch (error) { /* يبقى «اليوم» */ }
  }

  function wait() {
    if (stuck()) return PATIENT;
    return Math.min(CEILING, Math.round(FIRST * Math.pow(1.3, Math.max(0, tries - 5))));
  }
  function later() { clearTimeout(timer); timer = setTimeout(ask, wait()); }

  function ask() {
    clearTimeout(timer);
    if (asking) return;
    if (navigator.onLine === false) { describe(); later(); return; }
    asking = true;
    tries++;
    var control = typeof AbortController === 'function' ? new AbortController() : null;
    var guard = setTimeout(function () { if (control) control.abort(); }, 8000);
    fetch(HEALTH, { cache: 'no-store', credentials: 'same-origin', signal: control ? control.signal : undefined })
      .then(function (response) { return response.ok; }, function () { return false; })
      .then(function (ok) {
        clearTimeout(guard);
        asking = false;
        if (ok) { remember(); reopen(); return; }
        describe();
        later();
      });
  }

  function start() {
    title = document.getElementById('title');
    lead = document.getElementById('lead');
    note = document.getElementById('note');
    if (!title || !lead || !note) return;
    dateIssue();
    var retry = document.getElementById('retry');
    if (retry) retry.addEventListener('click', reopen);
    window.addEventListener('online', function () { describe(); ask(); });
    window.addEventListener('offline', describe);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ask(); });
    describe();
    later();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
