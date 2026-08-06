export type AdminTab =
  | 'dashboard'
  | 'content-health'
  | 'production'
  | 'analytics'
  | 'studio'
  | 'social-posts'
  | 'design'
  | 'tweets'
  | 'image-lab'
  | 'launch'
  | 'event'
  | 'articles'
  | 'books'
  | 'papers'
  | 'media'
  | 'inbox'
  | 'lab'
  | 'voice'
  | 'manual-dialogue'
  | 'audio-library'
  | 'sound-caravan'
  | 'pronunciation'
  | 'cv'
  | 'whatsapp'
  | 'bot-messages'
  | 'monitor'

export type AdminArea = 'system' | 'publishing' | 'library' | 'audience'

export type AdminNavItem = {
  tab: AdminTab
  label: string
  note: string
}

export type AdminNavSection = {
  id: string
  label?: string
  note?: string
  items: AdminNavItem[]
}

export type AdminNavGroup = {
  area: AdminArea
  label: string
  icon: string
  sections: AdminNavSection[]
}

/* سجل واحد فقط يولّد القائمة، الروابط العميقة، لوحة الأوامر، والتنقل المتجاوب.
   لا تُعرّف تبويبات الإدارة في ملف آخر حتى لا تتباعد القائمة عن الـURL أو الـrender. */
export const ADMIN_GROUPS: AdminNavGroup[] = [
  {
    area: 'system',
    label: 'النظام',
    icon: '◉',
    sections: [{
      id: 'system-core',
      items: [
        { tab: 'dashboard', label: 'غرفة القيادة', note: 'ما يحتاج قرارك الآن فقط' },
        { tab: 'monitor', label: 'مركز التشغيل الذاتي', note: 'افحص وافهم وأصلح كل خدمة من مكان واحد' },
        { tab: 'content-health', label: 'صحة المحتوى', note: 'المصادر والنواقص واكتمال الأرشيف' },
        { tab: 'lab', label: 'المختبر المتقدم', note: 'التجارب والذاكرة وتطوير الفكرة' },
      ],
    }],
  },
  {
    area: 'publishing',
    label: 'الإنتاج والنشر',
    icon: '↗',
    sections: [
      {
        id: 'creation',
        label: 'الإنشاء',
        note: 'من الفكرة إلى المادة والصورة',
        items: [
          { tab: 'studio', label: 'استوديو النشر', note: 'من الفكرة إلى الحزمة التحريرية' },
          /* «اكتب الموضوع فتجهز التغريدات» (طلب الدكتور ٣١ يوليو): المسار كان
             يعمل كاملاً لكنه مخبوء داخل استوديو النشر كخطوةٍ جانبية، فلم يجده.
             صار باباً مستقلاً بلغته هو — يفتح الاستوديو على المسار السريع رأساً. */
          { tab: 'social-posts', label: 'تغريدات ومنشورات', note: 'اكتب الموضوع فقط — وتخرج لك صيغ كل منصة' },
          { tab: 'design', label: 'استوديو التصاميم', note: 'التصميم والتوليد ومكتبة الأصول' },
          { tab: 'tweets', label: 'استوديو التغريدات', note: 'تغريداتٌ من أرشيفك، ثم تصميمها بنقرة' },
        ],
      },
      {
        id: 'audio',
        label: 'الصوت',
        note: 'راقب، أنتج، حرّر، ثم راجع المكتبة',
        items: [
          { tab: 'sound-caravan', label: 'قافلة الصوت', note: 'النظرة العامة للمقالات والأصوات الثلاثة' },
          { tab: 'production', label: 'غرفة الإنتاج', note: 'طابور البودكاست من المسودة إلى النشر' },
          { tab: 'manual-dialogue', label: 'الحوار اليدوي', note: 'تحرير الحلقة مداخلةً مداخلة' },
          { tab: 'audio-library', label: 'مكتبة الصوت', note: 'السماع وإعادة التوليد والحذف' },
        ],
      },
      {
        id: 'audio-settings',
        label: 'إعدادات الصوت',
        note: 'إعدادات تُراجع عند الحاجة لا كل يوم',
        items: [
          { tab: 'pronunciation', label: 'قاموس النطق', note: 'اضبط نطق الكلمات المعتمدة' },
          { tab: 'voice', label: 'اختيار الأصوات', note: 'المقارنة العمياء وضبط الجودة' },
        ],
      },
      {
        id: 'launch',
        label: 'الإطلاق',
        items: [
          { tab: 'launch', label: 'وضع الإطلاق', note: 'إبراز عمل واحد في الواجهة مؤقتاً' },
        ],
      },
    ],
  },
  {
    area: 'library',
    label: 'المكتبة',
    icon: '▦',
    sections: [{
      id: 'library-content',
      items: [
        { tab: 'articles', label: 'المقالات', note: 'إنشاء وتحرير وجدولة' },
        { tab: 'books', label: 'الكتب', note: 'المؤلفات والملفات' },
        { tab: 'papers', label: 'الأبحاث', note: 'المساهمات العلمية' },
        { tab: 'media', label: 'الإعلام', note: 'الظهور واللقاءات المنشورة' },
        { tab: 'event', label: 'اللقاءات القادمة', note: 'إضافة المواعيد وإدارتها' },
        { tab: 'cv', label: 'السيرة والهوية', note: 'ملفات السيرة والبيانات العامة' },
      ],
    }],
  },
  {
    area: 'audience',
    label: 'الجمهور',
    icon: '◎',
    sections: [{
      id: 'audience-tools',
      items: [
        /* النشرة البريدية تسكن هذا التبويب (غرفة تحريرها أسفل الرسائل)، وكانت
           لا تُذكر في اسمه فيظن الدكتور أنها غير موجودة — الوصف يدلّ عليها الآن. */
        { tab: 'inbox', label: 'الرسائل والنشرة', note: 'طلبات التواصل · المشتركون · غرفة تحرير النشرة' },
        { tab: 'whatsapp', label: 'مساعد واتساب', note: 'الحالة والمحادثات والحملات والجمهور' },
        { tab: 'bot-messages', label: 'رسائل البوت', note: 'تحرير ما يقوله البوت بلا كود' },
        { tab: 'analytics', label: 'التحليلات', note: 'المشاهدات ورحلة الزائر والاقتراح الشخصي' },
      ],
    }],
  },
]

export const itemsOfGroup = (group: AdminNavGroup): AdminNavItem[] =>
  group.sections.flatMap((section) => section.items)

/* «مختبر الصور» يعمل كاملاً ويغذّي الاستوديو ببصمة الصورة اللونية، لكن الدكتور
   لا يحتاجه الآن (قراره ٣١ يوليو) — يبقى حياً بالرابط المباشر بلا أن يزاحم
   تبويباته. لا يُحذف: يُظهره سطرٌ واحد متى طلبه. */
const HIDDEN_ADMIN_TABS: AdminTab[] = ['image-lab']
export const ADMIN_TABS: AdminTab[] = [...ADMIN_GROUPS.flatMap((group) => itemsOfGroup(group).map((item) => item.tab)), ...HIDDEN_ADMIN_TABS]

export const adminItem = (tab: AdminTab): AdminNavItem | undefined =>
  ADMIN_GROUPS.flatMap(itemsOfGroup).find((item) => item.tab === tab)

/** اسمٌ عربيٌّ للأداة في تقارير الاستخدام — والمعرّف الخام إن لم تكن تبويباً. */
export const adminToolLabel = (tool: string): string =>
  adminItem(tool as AdminTab)?.label || tool || 'غير محدّد'

export const areaOfTab = (tab: AdminTab): AdminArea =>
  ADMIN_GROUPS.find((group) => itemsOfGroup(group).some((item) => item.tab === tab))?.area || 'system'

export const defaultTabForArea = (area: AdminArea): AdminTab =>
  ADMIN_GROUPS.find((group) => group.area === area)?.sections[0]?.items[0]?.tab || 'dashboard'
