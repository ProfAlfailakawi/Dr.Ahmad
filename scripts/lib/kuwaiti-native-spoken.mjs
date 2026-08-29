/**
 * طبقة النص المنطوق قبل Gemini.
 *
 * هذه ليست لهجةً آليةً ولا قلباً ميكانيكياً للقاف. دورها أضيق:
 *  - إصلاح الصياغات التي سُمعت فعلياً كمقالٍ أو كمذيع.
 *  - تبسيط مداخل البحث من غير تغيير الرقم أو الجهة أو النتيجة.
 *  - إبقاء كل تغيير مسجلاً كي يطابق الـTranscript ما قيل فعلاً.
 *
 * تُطبق بعد إثبات أن المختصر مشتق من متن Firestore المقفول، وقبل أن يصل
 * النص إلى TTS. لذلك لا نطلب من Gemini أن يعيد الكتابة سراً ثم ننشر
 * Transcript مختلفاً؛ النص الذي يراه المحرك هو نفسه النص الذي نسجله.
 */

import { applyConversationVariety } from './kuwaiti-dialogue-variety.mjs'
import { applyApprovedRegisterRewrites } from './kuwaiti-register-rewrites.mjs'

export const NATIVE_SPOKEN_VERSION = '2026-08-29-native-kuwaiti-v15-city-ear-gate'
export const PILOT_SLUG = 'success-that-does-not-bring-joy-to-its-ownerarabic'
export const SERIOUSNESS_SLUG = 'when-seriousness-becomes-a-mask-for-escapearabic'
export const CLASSROOM_SLUG = 'the-classroom-that-fears-mistakesarabic'
export const INTELLIGENCE_SLUG = 'intelligence-without-a-consciencearabic'

const cloneTurn = (turn) => ({ ...turn })
const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim()

/* الحكم السمعي الأخير على الحلقة التجريبية سمّى هذه المواضع واحداً واحداً.
   التعديل هنا على الحلقة وحدها؛ لا نعمّم عبارةً سياقيةً على ١٤٤ موضوعاً. */
const PILOT_TURN_OVERRIDES = new Map([
  [0, { text: 'تطلع النتيجة، والتهاني من كل صوب، والطالب يبتسم… مثل ما الناس متوقعة منه.' }],
  [2, { deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [3, { text: 'ما حس بالفرحة اللي كان يبيها.' }],
  [4, { text: 'بس كل اللي حس فيه كان راحة شوي… وبس. مثل واحد كان محشور بمكان ضيّج… وبعدها طلع منه.' }],
  [5, { text: 'بس مو النجاح بروحه يستاهل الفرحة؟' }],
  [7, { text: 'إي، بس هني الفرق.', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [8, { text: 'الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي.' }],
  [9, { speaker: 'female', text: 'إي، ترى مو كل نجاح يفرّح صاحبه… مرات الواحد بس يرتاح لأنه عدى اللي كان خايف منه.' }],
  [12, { text: 'بس شنو يصير بالاختبار اللي بعده؟', deliveryType: 'question' }],
  [13, { speaker: 'female', text: 'وترى حتى الدراسات تقول إن هالضغط مو بسيط.', deliveryType: 'briefReaction' }],
  [14, { speaker: 'male', text: 'شلون يعني؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [15, { speaker: 'female', text: 'في مراجعة كبيرة، خذو فيها أبحاث وايد عن الموضوع.' }],
  [16, { speaker: 'male', text: 'وشنو طلع معاهم؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [17, { speaker: 'female', text: 'كل ما زاد التوتر، نزل مستوى الطالب.', deliveryType: 'statement' }],
  [18, { speaker: 'male', text: 'إي، بس تدري شنو الأسوأ؟', deliveryType: 'briefReaction', pauseAfterMs: 180, overlapMs: 70 }],
  [19, { speaker: 'female', text: 'إنه يدخل بنفس الدوامة كل مرة. ما يرتاح من داخل… بس ينطر الاختبار اللي بعده.' }],
  [20, { speaker: 'male', text: 'بس مو كبرنا الموضوع وايد؟' }],
  [21, { speaker: 'female', text: 'الدرجة بالنهاية تبيّن مستواه… بس مو كل شي فيه.' }],
  [22, { text: 'والأهم بعد… هالتجربة شنو غيّرت فيهم؟ صاروا أحسن؟' }],
  [23, { speaker: 'female', text: 'فهموا نفسهم أكثر؟ صاروا أهدأ؟' }],
  [24, { text: 'ترى في نجاح يطلع شكله وايد حلو… بس صاحبه ما حس بشي.', deliveryType: 'statement', pauseAfterMs: 320 }],
  [25, { text: 'واللي علينا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.', deliveryType: 'statement', pauseAfterMs: 320 }],
])

/* النسخة الكاملة تبقى قاعدة التحرير وإعادة التكثيف، لذلك تحمل العلاج نفسه
   حتى لو تبدّل المختصر مستقبلاً أو طُلبت الحلقة الكاملة. */
const PILOT_FULL_OVERRIDES = new Map([
  [0, { text: 'تطلع النتيجة، والتهاني من كل صوب، والطالب يبتسم… مثل ما الناس متوقعة منه. بس في شي داخله ساكت.' }],
  [1, { text: 'إي، بالضبط. الكل حواليه فرحان ويبارك له، بس هو من داخله؟ ما حس بالفرحة اللي كان يبيها.' }],
  [2, { text: 'مو فرحة من قلب، ولا ذاك الإحساس اللي يي لما تنجز شي يعني لك. بس كل اللي حس فيه كان راحة شوي… وبس. مثل واحد كان محشور بمكان ضيّج… وبعدها طلع منه.' }],
  [3, { text: 'بس مو النجاح بروحه يستاهل الفرحة؟ إذا الواحد عدى شي كان خايف منه، طبيعي يرتاح.' }],
  [4, { text: 'إي، بس هني الفرق. الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي. وترى مو كل نجاح يفرّح صاحبه؛ مرات الواحد بس يرتاح لأنه عدى اللي كان خايف منه.' }],
  [7, { text: 'إذا الامتحان صار معركة، النجاح بس يوقف التوتر شوي… بس شنو يصير بالاختبار اللي بعده؟' }],
  [8, { speaker: 'female', text: 'وترى حتى الدراسات تقول إن هالضغط مو بسيط.', deliveryType: 'briefReaction' }],
  [9, { speaker: 'male', text: 'شلون يعني؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [10, { speaker: 'female', text: 'في مراجعة كبيرة، خذو فيها أبحاث وايد عن الموضوع، وطلع معاهم إن كل ما زاد التوتر، نزل مستوى الطالب.' }],
  [11, { speaker: 'male', text: 'وفي دراسة ثانية؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [12, { speaker: 'female', text: 'ربطوا ضغط الدراسة بتوتر الامتحان. وقالوا بعد إن نظرة الأهل وحالة الطالب النفسية لهم دور.' }],
  [13, { speaker: 'male', text: 'إي، بس تدري شنو الأسوأ؟', deliveryType: 'briefReaction', pauseAfterMs: 180, overlapMs: 70 }],
  [14, { speaker: 'female', text: 'إن الطالب يصير يشوف الدرجة كأنها كل شي.' }],
  [15, { speaker: 'male', text: 'حتى نجاحه ما يطمنه.' }],
  [16, { speaker: 'female', text: 'إنه يدخل بنفس الدوامة كل مرة. ما يرتاح من داخل… بس ينطر الاختبار اللي بعده.' }],
  [17, { text: 'بس مو كبرنا الموضوع وايد؟ الدرجة بالنهاية تبيّن مستواه… بس مو كل شي فيه.' }],
  [18, { text: 'يدري هالشي بعقله، إي. بس الإحساس مو دايما يسمع كلام العقل. وهني أبحاث الجدارة الذاتية المشروطة فيها شي مهم.' }],
  [19, { text: 'إذا الواحد ربط قيمته بدرجاته، عقب شوي ثقته بروحه تهتز.' }],
  [20, { text: 'ويي معاه ضغط أكثر، وتوتر بالامتحان، وتصير دافعيته كلها خوف مو رغبة.' }],
  [27, { text: 'والأهم بعد… هالتجربة شنو غيرت فيهم؟ صاروا أحسن؟ فهموا نفسهم أكثر؟ صاروا أهدأ؟' }],
  [34, { text: 'ترى في نجاح يطلع شكله وايد حلو… بس صاحبه ما حس بشي.' }],
  [35, { text: 'واللي علينا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.', deliveryType: 'statement', pauseAfterMs: 320 }],
])

/* مراجعة الحلقة 04 بعد سماع الـSame-Take كاملاً (٢٥ أغسطس ٢٠٢٦): الصوتان
   واللهجة والجسور ناجحة؛ العطب كتابي فقط. لذلك لا نلمس Master Voice Prompt
   ولا الأصوات ولا المونتاج. نعيد بناء المواضع المقالية داخل طبقة المنطوق
   **بعد** إثبات المصدر المقفول، حتى يظل Firestore هو مصدر المعنى والحقائق،
   ويصل Gemini نصٌ شفهي ظاهر في الـTranscript لا إعادة كتابة سرية.

   البحثان كلاهما تمهيد → سؤال → نتيجة. والجملة الأخيرة قبل الإحالة تمر
   statement عادية، لا conclusion تجبر المحرك على التباطؤ وصناعة شعار. */
const SERIOUSNESS_SHORT_OVERRIDES = new Map([
  [0, { text: 'طول اليوم وإحنا نتحرك… ونسمي هالحركة التزام.', deliveryType: 'briefReaction' }],
  [2, { text: 'وبآخر الليل نرد… ونكتشف إن ما تحرّك فينا شي صج.', deliveryType: 'statement' }],
  [3, { text: 'بس الجدية مو دايم علامة نضج.', deliveryType: 'statement', pauseAfterMs: 320 }],
  [4, { text: 'مرات ما تكون جدية أصلا… تكون طريقة مرتبة نلهي فيها نفسنا.', deliveryType: 'statement', pauseAfterMs: 300, overlapMs: 0 }],
  [5, { speaker: 'female', text: 'نلهي نفسنا عن شنو؟', deliveryType: 'question', pauseAfterMs: 180, overlapMs: 70 }],
  [6, { speaker: 'male', text: 'عن سؤال ندري إنه ثقيل علينا.', deliveryType: 'briefReaction', pauseAfterMs: 240, overlapMs: 0 }],
  [7, { speaker: 'female', text: 'إحنا ننجز اللي المفروض… ولا بس اللي يريحنا؟', deliveryType: 'question' }],
  [8, { speaker: 'male', text: 'وترى حتى الدراسات لاحظت هالشي.', deliveryType: 'briefReaction', pauseAfterMs: 220 }],
  [9, { speaker: 'female', text: 'شلون يعني؟', deliveryType: 'question', pauseAfterMs: 180, overlapMs: 70 }],
  [10, { speaker: 'male', text: 'طلع إن الناس تشوف الشخص المشغول أهم وأشطر.', deliveryType: 'statement', pauseAfterMs: 420, overlapMs: 0, musicBridgeAfter: true }],
  [11, { speaker: 'female', text: 'إي، ويمكن نحضر كل اجتماع صغير…', deliveryType: 'statement' }],
  [12, { speaker: 'male', text: 'لأننا نخاف من مهمة وحدة كبيرة تكشف قدرتنا الحقيقية.', deliveryType: 'statement' }],
  [13, { speaker: 'female', text: 'ويمكن نتقن الانشغال الذكي…', deliveryType: 'statement' }],
  [14, { speaker: 'female', text: 'عشان ما نقرب من علاقة تبي شجاعة وصراحة.', deliveryType: 'statement' }],
  [15, { speaker: 'male', text: 'أو من مشروع يحطنا جدام احتمال الفشل…', deliveryType: 'statement' }],
  [16, { speaker: 'male', text: 'أو قرار مهم مأجلينه، وكل يوم نقول باجر.', deliveryType: 'statement' }],
  [17, { speaker: 'female', text: 'وجدام الكل شكلنا مرتب…', deliveryType: 'statement' }],
  [18, { speaker: 'female', text: 'بس من داخلنا، قاعدين نأجل الشي اللي نعرفه.', deliveryType: 'statement' }],
  [19, { text: 'بس هذا فيه قَسوة على اللي يشتغل بجد صج.', deliveryType: 'gentleObjection' }],
  [20, { text: 'صحيح. في شغل يطلع منه شي له فايدة… وفي شغل بس يلهينا عن الشي اللي ما نبي نواجهه.', deliveryType: 'statement' }],
  [21, { text: 'وحتى أبحاث التسويف لاحظت هالشي.', deliveryType: 'briefReaction', pauseAfterMs: 220 }],
  [22, { text: 'شلون يعني؟', deliveryType: 'question', pauseAfterMs: 180, overlapMs: 70, musicBridgeAfter: false }],
  [23, { text: 'إن الواحد مرات يأجل مو لأنه ما يفهم… لأن المهمة ثقيلة عليه، أو نتيجتها بعيدة.', deliveryType: 'statement', pauseAfterMs: 420, overlapMs: 0, musicBridgeAfter: true }],
  [24, { speaker: 'female', text: 'عيل من وين نبدي العلاج؟', deliveryType: 'question', pauseAfterMs: 260, overlapMs: 0 }],
  [25, { speaker: 'male', text: 'نفرق بين شغل يودّينا للشي المهم… وشغل يبعدنا عنه.', deliveryType: 'statement' }],
  [26, { speaker: 'female', text: 'ونحط للمهمة الثقيلة موعد واضح.', deliveryType: 'statement' }],
  [27, { speaker: 'male', text: 'المشكلة إن الواحد يظل مشغول سنة كاملة…', deliveryType: 'statement', pauseAfterMs: 260 }],
  [28, { speaker: 'male', text: 'وبالأخير يكتشف إن كل هالانشغال كان عشان ما يواجه نفسه.', deliveryType: 'statement', pauseAfterMs: 360 }],
])

/* جولة السماع ذات الخمس حلقات (٢٩ أغسطس): الحلقة 01 هي المرجع الصوتي.
   02 و03 لم تفشلا من الجسر أو الـSame-Take؛ فشلتا في كلمات محددة، ثم
   انزلق الأداء إلى خليجي غير كويتي. نعالج الكلمات هنا، أما اللهجة نفسها
   فتحكمها بوابة الصوت v15 بعد التوليد ولا نحاول تخمينها من الإملاء. */
const CLASSROOM_SHORT_OVERRIDES = new Map([
  [0, { text: 'توقفنا أسبوعين… انشغلنا بالحرب، وبالتوتر اللي يزيد مع كل خبر.' }],
  [2, { text: 'بس اليوم عندنا موضوع مهم بعد.' }],
  [3, { text: 'الصف… هني بعد يا يتعلم الطالب يتكلم، يا يخاف ويسكت.' }],
  [4, { text: 'إي… ومن أول مرة يرفع إيده، يبين شلون إحنا نتعامل مع الغلط.' }],
])

const INTELLIGENCE_SHORT_OVERRIDES = new Map([
  [4, { text: 'لحظة… خلنا ناخذها وحدة وحدة.', deliveryType: 'briefReaction', pauseAfterMs: 200 }],
])

/* قواعد آمنة قليلة للحلقات الحالية والجديدة. لا تشمل «كل قاف»: الهوية
   الكويتية معجمية، والمعنى أهم من مطاردة حرف. */
const SAFE_TEXT_RULES = [
  /* «ممم…» زُرعت قالبياً في 90 حلقة. هذا مو تردد بشري نابع من السياق؛
     تكراره نفسه يفضح الكاتب والمحرك، وحكم المراجعة يمنع تصنيع أمم وآهات.
     نحذف العلامة وحدها من البداية ولا نمس كلمةً واحدة من المعنى. */
  [/^ممم…\s*/u, ''],
  [/(?:أخذوا|اخذوا) فيها أبحاث/gu, 'خذو فيها أبحاث'],
  [/معنى القلق بصوت أبوه/gu, 'معنى الخوف بصوت أبوه'],
  [/وشنو وجه القلق في معلومات تعريفية دقيقة؟/gu, 'وشنو اللي يخوف في معلومات تعريفية دقيقة؟'],
  [/وهو مبين عليه القلق/gu, 'وهو مبين عليه متوتر'],
  [/لزيادة القلق والتوتر النفسي/gu, 'لزيادة الخوف والتوتر النفسي'],
  [/خلنا نوقف هني/gu, 'خلنا ناخذها وحدة وحدة'],
  [/لازم نوقف بوجه الحصار/gu, 'لازم نتصدى للحصار'],
  [/خل نوقف مع نفسنا وقفة تثقيفية/gu, 'خل نراجع نفسنا شوي'],
  [/فيها شي يستاهل نوقف عنده/gu, 'فيها شي لازم نفهمه عدل'],
  [/عشان نوقف حالة الغليان/gu, 'عشان نهدي حالة الغليان'],
  [/خلنا نوقف أسلوب قمع العيال/gu, 'خلنا ننهي أسلوب قمع العيال'],
  [/نوقف وياها ونآزرها/gu, 'نكون معاها ونساندها'],
  [/خلونا نوقف شوي عند هالصرخات/gu, 'خلونا نسمع عدل هالصرخات'],
  [/مثل واحد كان محشور بباب ضيق(?:،|…)?\s*(?:وعقب|وبعدين|وطلع)\s+منه/gu,
    'مثل واحد كان محشور بمكان ضيّج… وبعدها طلع منه'],
  [/إن النجاح يتحول من فرحة إلى وسيلة تهد[يّي] الخوف/gu,
    'الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي'],
  [/من هني الدراسة تصير محطة بعد محطة/gu, 'وهني يدخل بنفس الدوامة كل مرة'],
  [/أوضح مع نفسهم/gu, 'فهموا نفسهم أكثر'],
  [/دورنا مو بس نلمّع شكل النجاح\. نبي الطالب يحس إن (?:اللي سواه|تعبه) له معنى… مو بس شكل حلو جدام الناس\./gu,
    'واللي علينا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.'],
  [/لأن في نجاحات تطلع بالصورة وايد حلوة… بس من داخل فاضية\./gu,
    'ترى في نجاح يطلع شكله وايد حلو… بس صاحبه ما حس بشي.'],
  [/والتربية الحقيقية مو إحنا نلمع شكل النجاح؛ التربية إحنا نرجع له روحه\./gu,
    'واللي علينا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.'],
  [/^مراجعة بحثية واسعة، لقت إن المستخدمين يقبلون توصيات الذكاء حتى وهي ناقصة\.$/u,
    'وفي مراجعة كبيرة، خذو فيها أبحاث وايد، وطلع إن الناس تمشي ورا توصيات الذكاء حتى لما تكون ناقصة.'],
  /* [٢٨ أغسطس ٢٠٢٦] ثلاث كلمات فشلت داخل الحلقة الكاملة: «تكفي» خرجت
     بمعنى الرجاء، «بدال» حملها المحرك بقراءة دخيلة، و«ينختبر» خرجت بهمزة
     وصل. ما نعمم حركة ولا همزة؛ نعيد بناء الجملة الحالية سياقياً. وأي
     سياق جديد يبقى خلف الحارس الصلب إلى أن تضاف له إعادة واضحة هنا. */
  [/كأن هالكلمات تكفي تشرح اللي قاعد يصير فينا/gu, 'كأن هالكلمات تشرح كل اللي قاعد يصير فينا'],
  [/هالحقيقة بروحها تكفي عشان نعلمهم درس ثاني/gu, 'وهالحقيقة بروحها تعلّمهم درس ثاني'],
  [/المبادرة بروحها ما تكفي/gu, 'المبادرة بروحها مو كافية'],
  [/التشريعات المحلية بروحها ما تكفي/gu, 'التشريعات المحلية بروحها مو كافية'],
  [/التجربة بروحها يمكن ما تكفي/gu, 'التجربة بروحها يمكن مو كافية'],
  [/وتكفي الفكرة العلمية بروحها عشان تولد واقع تكنولوجي؟/gu, 'والفكرة العلمية بروحها تقدر تولد واقع تكنولوجي؟'],
  [/ما تكفي غضاضة البصر، سواء من الإداريين أو المراقبين على الامتحان أو من غيرهم؟/gu,
    'مو كافي إن الإداريين أو مراقبين الامتحان وغيرهم يسوون نفسهم ما شافوا شي؟'],
  [/اليوم الإنسان ما يحتاج يطلع من غرفته عشان يستهلك عالم كامل… شاشة صغيرة تكفي/gu,
    'اليوم الإنسان ما يحتاج يطلع من غرفته عشان يستهلك عالم كامل… شاشة صغيرة تفتح له كل هذا'],
  [/(?:و?ترى )?ساعة وحدة تكفي لكل هذا؟/gu, 'تتصور ساعة وحدة تسوي كل هذا؟'],
  [/وثلاثة أسئلة بس تكفي/gu, 'وكل اللي نحتاجه ثلاثة أسئلة'],
  [/الوهم إن الدفعة وحدها تكفي\. هي شرارة بس/gu, 'الوهم إن الدفعة بروحها تحل كل شي. هي شرارة بس'],
  [/العقل اللي ما ينختبر بسؤال/gu, 'العقل اللي ما نختبره بسؤال'],
  [/بدال ما نتصيد الأخطاء/gu, 'ما نبي نتصيد الأخطاء'],
  [/فبدال ما نستخدمها في هالقطاعات، وفي السلم وخدمة الناس/gu,
    'بس إحنا مو قاعدين نستخدمها في هالقطاعات، ولا في السلم وخدمة الناس'],
  [/وبدال ما نوثق تجربة فاعلة ونطورها/gu, 'وإحنا مو قاعدين نوثق تجربة فاعلة ونطورها'],
  [/بس بدال ما نشق الصف، خلنا نشوف شنو البديل قدامنا/gu,
    'بس خلنا ما نشق الصف، ونشوف شنو البديل جدامنا'],
  [/راح نستوردها، بدال ما نستغل أيدينا العاملة الوطنية من مخرجات كليات التربية/gu,
    'راح نستوردها، وإحنا نقدر نستغل أيدينا العاملة الوطنية من مخرجات كليات التربية'],
  [/يشير للشخص اللي يتفاعل مع تلفونه، أو أي جهاز ثاني، بدال ما يتفاعل مع إنسان/gu,
    'يشير للشخص اللي يتفاعل مع تلفونه أو أي جهاز ثاني، ويترك الإنسان اللي جدامه'],
  [/بدال ما نشعرهم إن هالأمور صعبة/gu, 'مو نخليهم يحسون إن هالأمور صعبة'],
  [/الخطورة إنك تستخدمها كذراع بديل عن العقل، بدال ما تكون امتداد له/gu,
    'الخطورة إنك تستخدمها مكان عقلك، مو كشي يساعده'],
  [/بدال الرسائل النصية اللي (?:يلتقطونها|ياخذونها) ويرسلونها طول الليل/gu,
    'قاعد يطالع الرسائل اللي توصله ويرسلها طول الليل'],
  [/ويرسل رموز وملصقات بدال الجمل الكاملة/gu, 'ويرسل رموز وملصقات، مو جمل كاملة'],
  [/والمقال ما يرفض النظام… يرفض إن النجاح يصير إنجاز رقمي، بدال ما يكون حالة وعي/gu,
    'والمقال ما يرفض النظام… يرفض إن النجاح يصير بس رقم، من غير وعي'],
  [/يرفض إن النجاح يصير إنجاز رقمي، بدال ما يكون حالة وعي/gu,
    'يرفض إن النجاح يصير بس رقم، من غير وعي'],
  [/بدال ما نقول له: إجابتك ضعيفة؟/gu, 'مو نقول له: إجابتك ضعيفة؟'],
  [/بدال: شلون جبت هالدرجة؟ نسأله:/gu, 'مو: شلون جبت هالدرجة؟ نسأله:'],
  [/وبدال الدروس الخصوصية اللي الأهل وهموا نفسهم إنها الحل/gu,
    'ومو نرميهم للدروس الخصوصية اللي الأهل وهموا نفسهم إنها الحل'],
  [/نقبل الحوار البناء بدال القطيعة/gu, 'نقبل الحوار البناء ونترك القطيعة'],
  [/بدال الأربطة/gu, 'مو الأربطة'],
  [/نقيم قدرة الطالب على استخدام هالأدوات الذكية، بدال ما نختبر نضجه الفكري/gu,
    'نقيم قدرة الطالب على استخدام هالأدوات الذكية، وننسى نختبر نضجه الفكري'],
  [/تعطي نفسك زمن واقعي… بدال ما تحاكمها بمنطق العجلة/gu,
    'تعطي نفسك وقت واقعي… وما تحاكمها بمنطق العجلة'],
  [/يصنعون بدال ما يكونون مهووسين/gu, 'يصنعون، مو بس يكونون مهووسين'],
  [/موعد محدد في اليوم… بدال ما تبقى رهينة المزاج/gu,
    'موعد محدد في اليوم… وما نخليها رهينة المزاج'],
  [/\bشنو الأخطر من القلق نفسه\b/gu, 'شنو الأسوأ من التوتر نفسه'],
  [/\bكل ما زاد القلق\b/gu, 'كل ما زاد التوتر'],
  [/\bفجأة\b/gu, 'مرة وحدة'],
  [/^وفي دراسة نشرتها ([^،…]+)([،…])/u, 'وأكو دراسة من $1$2'],
  [/^ففي دراسة نشرتها ([^،…]+)([،…])/u, 'وفي دراسة من $1$2'],
  [/^وبدراسة نشرتها ([^،…]+)([،…])/u, 'وفي دراسة من $1$2'],
  [/^وترى في دراسة نشرتها ([^،…]+)([،…])/u, 'وترى أكو دراسة من $1$2'],
  [/^وفي تقرير صدر عن ([^،…]+)([،…])/u, 'وفي تقرير من $1$2'],
  [/^وبتقرير أصدرته ([^،…]+)([،…])/u, 'وفي تقرير من $1$2'],
  [/^وهالشي مبين بتقارير/u, 'وهالشي مبين في تقارير'],
  [/^مثل ما تظهر تقارير ([^.؟…]+)([.؟…])/u, 'وهالشي مبين في تقارير $1$2'],
  [/\bتعزز هالفكرة\b/gu, 'تقول الشي نفسه'],
]

export const RISK_PATTERNS = [
  ['بحث بصوت مذيع', /(?:ميتا.?تحليل منشور|مراجعة بحثية (?:كبيرة|واسعة)|في بحث فعلي قاعد يقول)/u],
  ['جملة مقالية', /(?:المعنى اللي إحنا نحطه على النتيجة|في نجاحات ما تفرح صاحبها|نرجع للنجاح معناه|نرجع له روحه)/u],
  ['اعتراض ثقيل', /بس مو قاعدين نكبر الموضوع/u],
  ['صورة مكتوبة', /(?:وسيلة تهد[يّي] الخوف|الدراسة تصير محطة بعد محطة|أوضح مع نفسهم)/u],
  ['خاتمة شعارية', /(?:التربية الحقيقية مو|الفرح الحقيقي بعد|بالصورة وايد حلوة… بس من داخل فاضية|نلمّع شكل النجاح)/u],
]

const QAF_RISK_WORDS = /(?:^|[\s،؛:.!?؟…])(متوقع\S*|مؤقت\S*|فجأة|القلق|الأخطر|قاعدين|أقوى|أصدق|الحقيقية)(?=$|[\s،؛:.!?؟…])/gu

export function auditNativeSpokenTurns (turns) {
  const hard = []
  const soft = []
  let qafRiskCount = 0
  let researchTurns = 0
  let sloganTurns = 0
  for (const [index, turn] of turns.entries()) {
    const text = norm(turn.text)
    for (const [label, pattern] of RISK_PATTERNS) {
      if (pattern.test(text)) hard.push({ index, label, text })
    }
    qafRiskCount += [...text.matchAll(QAF_RISK_WORDS)].length
    const research = /(?:دراسة|دراسات|بحث|أبحاث|تقرير|تقارير|مجلة|جامعة|منظمة|معهد|باحث|بالمئة|في المئة)/u.test(text)
    if (research) {
      researchTurns += 1
      if (text.length > 115) soft.push({ index, label: 'مداخلة بحثية طويلة', text })
    }
    if (['conclusion', 'closing'].includes(String(turn.deliveryType || '')) && text.length > 118) {
      sloganTurns += 1
      soft.push({ index, label: 'خاتمة طويلة قابلة للإلقاء', text })
    }
  }
  return { hard, soft, qafRiskCount, researchTurns, sloganTurns }
}

export function optimizeNativeSpokenEpisode (turns, { slug = '' } = {}) {
  const output = turns.map(cloneTurn)
  const changes = []

  output.forEach((turn, index) => {
    const before = norm(turn.text)
    const register = applyApprovedRegisterRewrites(before, { slug })
    let after = register.text
    for (const [pattern, replacement] of SAFE_TEXT_RULES) after = after.replace(pattern, replacement)
    if (after !== before) {
      turn.text = after
      changes.push({
        index,
        field: 'text',
        before,
        after,
        reason: register.applied.length
          ? `إعادة صياغة سياقية معتمدة (${register.applied.join('،')})`
          : 'قاعدة منطوقة آمنة',
      })
    }
  })

  /* الطول + البداية + الـslug قفلٌ كافٍ للحلقة القصيرة. لا نربط الترحيل
     بعبارة «التربية» القديمة؛ وإلا تعجز v2 عن إصلاح ملفٍ صُقل سابقاً بـv1. */
  if (slug === PILOT_SLUG && output.length === 27
    && norm(output[0]?.text).startsWith('تطلع النتيجة')) {
    for (const [index, patch] of PILOT_TURN_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم الأذن على الحلقة التجريبية' })
        turn[field] = value
      }
    }
    /* ثمانية تبديلات سريعة داخل البحث جعلت Gemini Preview يربط «السائل»
       بصوتٍ لا بالاسم، فيبدّل فهد ونورة وسط الـTake. نضغطها إلى سؤال واحد
       وجواب واحد مع حفظ المعلومتين حرفياً؛ السالفة تبقى حواراً والبحث لا
       يصير فقرة مذيع. هذا علاجٌ للحلقة التي سُمعت فقط، لا قاعدة عامة. */
    const beforeResearch = output.slice(14, 18).map((turn) => ({ ...turn }))
    const mergedResearch = [
      {
        ...output[14],
        text: 'شلون يعني؟ وشنو طلع معاهم؟',
        deliveryType: 'question',
        pauseAfterMs: 180,
        overlapMs: 70,
      },
      {
        ...output[15],
        text: 'في مراجعة كبيرة، خذو فيها أبحاث وايد عن الموضوع. كل ما زاد التوتر، نزل مستوى الطالب.',
        deliveryType: 'statement',
      },
    ]
    output.splice(14, 4, ...mergedResearch)
    changes.push({
      index: 14,
      field: 'turns',
      before: beforeResearch,
      after: mergedResearch,
      reason: 'ضغط التبديل السريع في البحث لمنع إعادة ربط الصوت بالدور الحواري',
    })
  } else if (slug === PILOT_SLUG && output.length >= 15
    && norm(output[0]?.text).startsWith('تطلع النتيجة')
    && norm(output[0]?.text).includes('بس في شي داخله ساكت')) {
    for (const [index, patch] of PILOT_FULL_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم الأذن على متن الحلقة الكامل' })
        turn[field] = value
      }
    }
  }

  if (slug === SERIOUSNESS_SLUG && output.length === 30
    && norm(output[0]?.text).startsWith('نسرع وايد')) {
    for (const [index, patch] of SERIOUSNESS_SHORT_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'مراجعة شفوية للحلقة 04 بعد نجاح الصوت' })
        turn[field] = value
      }
    }
  }

  if (slug === CLASSROOM_SLUG && output.length === 29) {
    for (const [index, patch] of CLASSROOM_SHORT_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم أذن الدكتور على الحلقة 02 من باقة السماع' })
        turn[field] = value
      }
    }
  }

  if (slug === INTELLIGENCE_SLUG && output.length === 29) {
    for (const [index, patch] of INTELLIGENCE_SHORT_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم أذن الدكتور على الحلقة 03 من باقة السماع' })
        turn[field] = value
      }
    }
  }

  /* التنويع يأتي بعد العلاج النصي: لا يمس كلمةً ولا ترتيباً، ويجعل نورة
     تقود قسماً من المكتبة بدل أن تبدأ الحلقات الـ144 كلها بفهد. */
  const varied = applyConversationVariety(output, { slug })
  changes.push(...varied.changes)
  const audit = { ...auditNativeSpokenTurns(varied.turns), conversationPlan: varied.plan }
  return { turns: varied.turns, changes, audit, conversationPlan: varied.plan, version: NATIVE_SPOKEN_VERSION }
}
