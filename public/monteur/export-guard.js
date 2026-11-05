/* حارس تصدير المونتير — منطق نقيّ يُحمَّل قبل monteur.js ويُختبر تحت node (scripts/test-monteur-export-guard.mjs).
   التصدير هنا تسجيل لتبويب/منطقة (getDisplayMedia)، لا رسمُ Canvas؛ فالعيوب المحتملة مختلفة:
   اختيار نافذة أو شاشة بدل التبويب، فشل القص إلى مساحة الفيديو، إيقاف المشاركة قبل النهاية،
   صوتٌ صامت، مشاهد لم تُعرض، وملفٌّ يُعلَن «جاهزاً» دون أن يُقاس شيء منه.
   ES5 عمداً: يعمل كما هو في المتصفح بلا بناء. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MonteurExportGuard = api;
})(typeof self !== 'undefined' ? self : this, function () {
  var SURFACE_LABEL = { monitor: 'الشاشة كلها', window: 'نافذة', browser: 'تبويب المتصفح' };

  function check(id, label, status, detail) { return { id: id, label: label, status: status, detail: detail }; }

  /* ما الذي يشاركه المستخدم فعلاً؟ المطلوب «هذا التبويب». نافذة أو شاشة تسجّل ما حول الفيديو. */
  function checkSurface(settings) {
    var surface = settings && settings.displaySurface;
    if (!surface) return check('surface', 'سطح المشاركة', 'unverified', 'لم يُعلِم المتصفح بنوع ما تشاركه؛ تأكد أنك اخترت هذا التبويب.');
    if (surface !== 'browser') {
      return check('surface', 'سطح المشاركة', 'fail', 'اخترتَ «' + (SURFACE_LABEL[surface] || surface) + '» بدل «هذا التبويب». أعد التصدير واختر تبويب الموقع الحالي، وإلا يُسجَّل ما حول الفيديو.');
    }
    return check('surface', 'سطح المشاركة', 'pass', 'تبويب المتصفح.');
  }

  /* بعد القص (cropTo): مقاس المسار يجب أن يطابق نسبة عنصر الفيديو. rect = {width,height} للعنصر. */
  function checkCrop(trackSettings, rect, cropped, fullscreenOk) {
    if (!cropped) {
      return fullscreenOk
        ? check('crop', 'منطقة الالتقاط', 'pass', 'ملء الشاشة للعنصر نفسه.')
        : check('crop', 'منطقة الالتقاط', 'fail', 'تعذّر عزل مساحة الفيديو: لا قصّ ولا ملء شاشة للعنصر.');
    }
    if (!trackSettings || !trackSettings.width || !trackSettings.height || !rect || !rect.width || !rect.height) {
      return check('crop', 'منطقة الالتقاط', 'unverified', 'نجح القص لكن تعذّر قياس مقاس المسار.');
    }
    var want = rect.width / rect.height, got = trackSettings.width / trackSettings.height;
    var off = Math.abs(got - want) / want;
    return off <= 0.06
      ? check('crop', 'منطقة الالتقاط', 'pass', 'المسار ' + trackSettings.width + '×' + trackSettings.height + ' يطابق نسبة الفيديو.')
      : check('crop', 'منطقة الالتقاط', 'fail', 'نسبة المسار ' + got.toFixed(3) + ' لا تطابق نسبة الفيديو ' + want.toFixed(3) + ' — القص لم يُطبَّق على عنصر الفيديو.');
  }

  /* حدّ الصوت الأدنى: ما دون ذلك صمت. */
  var AUDIO_FLOOR = 0.002;

  function frameBlank(s) { return s.mean < 5 || s.variance < 2; }

  /* تقييم الملف الناتج. كل مُدخل اختياري؛ ما غاب يُصبح «غير متحقَّق» لا «ناجح».
     input: { expectedSeconds, expectedAspect, measured:{duration,width,height}, bytes,
              completed:boolean (وصل المشغّل نهاية الفيديو), endedEarly:string|null,
              sceneCount, scenesSeen:number[]|null, extraChecks:[فحوص سابقة للتسجيل: السطح والقص],
              audio:{wanted, peak|null}, samples:[{label,stats|null}], recorderError:string|null } */
  function evaluateExport(input) {
    var checks = [], m = input.measured || {};
    var pre = input.extraChecks || [];
    for (var e = 0; e < pre.length; e++) if (pre[e]) checks.push(pre[e]);
    if (input.recorderError) checks.push(check('recorder', 'المسجِّل', 'fail', input.recorderError));
    checks.push(input.bytes > 0 ? check('bytes', 'حجم الملف', input.bytes >= 20000 ? 'pass' : 'fail', input.bytes >= 20000 ? Math.round(input.bytes / 1024) + 'KB.' : 'الملف أصغر من أن يحتوي فيديو حقيقياً.') : check('bytes', 'حجم الملف', 'fail', 'لم يُنتج التسجيل أي بيانات.'));

    if (input.endedEarly) checks.push(check('complete', 'اكتمال التسجيل', 'fail', input.endedEarly));
    else checks.push(input.completed ? check('complete', 'اكتمال التسجيل', 'pass', 'وصل المشغّل إلى نهاية الفيديو.') : check('complete', 'اكتمال التسجيل', 'fail', 'توقف التسجيل قبل أن يصل المشغّل إلى النهاية.'));

    if (m.duration == null || !isFinite(m.duration)) checks.push(check('duration', 'المدة', 'unverified', 'تعذّر قراءة مدة الملف.'));
    else {
      var tol = Math.max(1.2, input.expectedSeconds * 0.06);
      checks.push(Math.abs(m.duration - input.expectedSeconds) <= tol
        ? check('duration', 'المدة', 'pass', m.duration.toFixed(1) + 'ث تطابق ' + input.expectedSeconds.toFixed(1) + 'ث.')
        : check('duration', 'المدة', 'fail', 'مدة الملف ' + m.duration.toFixed(1) + 'ث بدل ' + input.expectedSeconds.toFixed(1) + 'ث.'));
    }

    if (!m.width || !m.height || !input.expectedAspect) checks.push(check('size', 'المقاس', 'unverified', 'تعذّر قراءة مقاس الملف.'));
    else {
      var aspect = m.width / m.height, offA = Math.abs(aspect - input.expectedAspect) / input.expectedAspect;
      checks.push(offA <= 0.06 ? check('size', 'المقاس', 'pass', m.width + '×' + m.height + '.') : check('size', 'المقاس', 'fail', 'المقاس ' + m.width + '×' + m.height + ' لا يطابق نسبة الفيديو (' + input.expectedAspect.toFixed(3) + ').'));
    }

    if (!input.scenesSeen || !input.sceneCount) checks.push(check('scenes', 'اكتمال المشاهد', 'unverified', 'لم تُرصد المشاهد المعروضة.'));
    else {
      var missing = [];
      for (var i = 0; i < input.sceneCount; i++) if (input.scenesSeen.indexOf(i) < 0) missing.push(i + 1);
      checks.push(missing.length ? check('scenes', 'اكتمال المشاهد', 'fail', 'لم يُعرض أثناء التسجيل: المشهد ' + missing.join('، ') + '.') : check('scenes', 'اكتمال المشاهد', 'pass', 'عُرضت المشاهد كلها (' + input.sceneCount + ').'));
    }

    var a = input.audio;
    if (a && a.wanted) {
      if (a.peak == null) checks.push(check('audio', 'الصوت', 'unverified', 'الصوت مفعّل لكن تعذّر قياس مستواه.'));
      else checks.push(a.peak >= AUDIO_FLOOR ? check('audio', 'الصوت', 'pass', 'مسار صوتي حيّ (قمة ' + a.peak.toFixed(2) + ').') : check('audio', 'الصوت', 'fail', 'الصوت مفعّل لكن المسار صامت طوال التسجيل.'));
    }

    var samples = input.samples || [], lit = 0, unknown = 0;
    for (var k = 0; k < samples.length; k++) {
      var s = samples[k];
      if (!s.stats) { unknown++; checks.push(check('sample-' + k, s.label, 'unverified', 'تعذّر أخذ عيّنة من الملف.')); continue; }
      if (frameBlank(s.stats)) checks.push(check('sample-' + k, s.label, 'fail', 'الإطار فارغ أو شبه أسود.'));
      else { lit++; checks.push(check('sample-' + k, s.label, 'pass', 'محتوى مرئي.')); }
    }
    if (!samples.length) checks.push(check('samples', 'عيّنات الإطارات', 'unverified', 'لم تُؤخذ عيّنات.'));

    var status = 'verified';
    for (var j = 0; j < checks.length; j++) { if (checks[j].status === 'fail') { status = 'failed'; break; } if (checks[j].status === 'unverified') status = 'unverified'; }
    return { status: status, ready: status === 'verified', checks: checks };
  }

  /* سطر عربي للواجهة: لا «جاهز للنشر» إلا إذا verified. */
  function describe(result) {
    if (result.ready) return 'اجتاز فحوص الملف: السطح والمنطقة والمدة والمقاس والمشاهد والعيّنات. جاهز للنشر.';
    var bad = [];
    for (var i = 0; i < result.checks.length; i++) if (result.checks[i].status !== 'pass') bad.push(result.checks[i].label + ': ' + result.checks[i].detail);
    return (result.status === 'failed' ? 'لا تنشر هذا الملف قبل مراجعته — ' : 'لم يكتمل التحقق، راجع الملف بنفسك قبل النشر — ') + bad.join(' · ');
  }

  /* أسباب شائعة لخطأ getDisplayMedia → رسالة عربية (NotAllowedError يعني إلغاء المستخدم ويبقى صامتاً). */
  function explainCaptureError(error) {
    var name = error && error.name;
    if (name === 'NotAllowedError') return '';
    if (name === 'NotFoundError') return 'لا يوجد ما يُسجَّل؛ اختر «هذا التبويب» في نافذة المشاركة.';
    if (name === 'NotReadableError' || name === 'AbortError') return 'تعذّر بدء الالتقاط (قد يكون التبويب محجوباً أو المتصفح مشغولاً). أعد المحاولة.';
    if (name === 'SecurityError') return 'منع المتصفح الالتقاط في هذا السياق؛ افتح الصفحة مباشرة لا داخل إطار مقيّد.';
    return 'تعذّر التصدير: ' + ((error && error.message) || 'خطأ غير معروف');
  }

  return { checkSurface: checkSurface, checkCrop: checkCrop, evaluateExport: evaluateExport, describe: describe, explainCaptureError: explainCaptureError, AUDIO_FLOOR: AUDIO_FLOOR };
});
