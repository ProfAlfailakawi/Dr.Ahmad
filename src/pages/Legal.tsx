import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'

type LegalSection = {
  title: string
  body?: string[]
  items?: string[]
}

type LegalDocumentProps = {
  path: string
  label: string
  title: string
  subtitle: string
  englishTitle: string
  updated: string
  arabic: LegalSection[]
  english: LegalSection[]
}

const EMAIL = 'ah.alfailakawi@paaet.edu.kw'

const legalLinks = [
  { to: '/privacy', label: 'سياسة الخصوصية', en: 'Privacy Policy' },
  { to: '/terms', label: 'شروط الاستخدام', en: 'Terms of Use' },
  { to: '/data-deletion', label: 'حذف البيانات', en: 'Data Deletion' },
]

function Section({ section, lang }: { section: LegalSection; lang: 'ar' | 'en' }) {
  return (
    <section className="border-b border-hair py-9 last:border-b-0">
      <h2 className="font-display text-[1.35rem] font-semibold leading-[1.5] text-ink md:text-[1.55rem]">
        {section.title}
      </h2>
      {section.body?.map((paragraph) => (
        <p key={paragraph} className="mt-4 text-[1rem] font-light leading-[2] text-ink/82">
          {paragraph}
        </p>
      ))}
      {section.items && (
        <ul className="mt-5 space-y-3">
          {section.items.map((item) => (
            <li key={item} className="relative ps-6 text-[.98rem] font-light leading-[1.9] text-ink/82">
              <span className={`absolute top-[.72em] h-1.5 w-1.5 rotate-45 bg-accent ${lang === 'ar' ? 'right-0' : 'left-0'}`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LegalDocument({ path, label, title, subtitle, englishTitle, updated, arabic, english }: LegalDocumentProps) {
  useSeo({ title, path, description: subtitle })

  return (
    <Page>
      <PageHead label={label} title={title} sub={subtitle} />
      <div className="px-5 py-12 md:px-11 md:py-18">
        <div className="mx-auto max-w-[980px]">
          <FadeUp>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hair bg-wash px-5 py-4 text-[.84rem] text-soft">
              <span>آخر تحديث: {updated}</span>
              <nav aria-label="الصفحات القانونية" className="flex flex-wrap gap-x-4 gap-y-2">
                {legalLinks.map((item) => (
                  <Link key={item.to} to={item.to} className={`transition-colors hover:text-accent ${item.to === path ? 'font-semibold text-accent' : ''}`}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </FadeUp>

          <FadeUp delay={0.06}>
            <article dir="rtl" lang="ar" className="mt-9 rounded-3xl border border-hair bg-canvas px-6 py-4 shadow-[0_20px_70px_rgba(0,0,0,.035)] md:px-10 md:py-6">
              {arabic.map((section) => <Section key={section.title} section={section} lang="ar" />)}
            </article>
          </FadeUp>

          <FadeUp delay={0.1}>
            <article dir="ltr" lang="en" className="mt-10 rounded-3xl border border-hair bg-wash px-6 py-4 text-left shadow-[0_20px_70px_rgba(0,0,0,.03)] md:px-10 md:py-6">
              <div className="border-b border-hair py-9">
                <span className="text-[.72rem] font-semibold uppercase tracking-[.14em] text-accent">English version</span>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.7rem)] font-semibold leading-[1.25] text-ink">{englishTitle}</h2>
                <p className="mt-4 text-[.9rem] text-soft">Last updated: July 13, 2026</p>
              </div>
              {english.map((section) => <Section key={section.title} section={section} lang="en" />)}
            </article>
          </FadeUp>

          <FadeUp delay={0.13}>
            <div className="mt-10 rounded-2xl border border-accent/30 bg-accent/[.055] px-6 py-6 text-center">
              <p className="text-[.98rem] leading-[1.9] text-ink/80">
                للاستفسارات المتعلقة بالخصوصية أو الحسابات المرتبطة: <a dir="ltr" href={`mailto:${EMAIL}`} className="font-semibold text-accent hover:text-accent-deep">{EMAIL}</a>
              </p>
            </div>
          </FadeUp>
        </div>
      </div>
    </Page>
  )
}

const privacyArabic: LegalSection[] = [
  {
    title: '1. من نحن ونطاق هذه السياسة',
    body: [
      'تنطبق هذه السياسة على الموقع الرسمي للدكتور أحمد حسين الفيلكاوي وعلى أداة Dr Alfailakawi Publishing المخصّصة لإدارة المحتوى وربط حسابات النشر. المسؤول عن معالجة البيانات هو د. أحمد حسين الفيلكاوي في دولة الكويت، ويمكن التواصل عبر البريد المبين في هذه الصفحة.',
      'تشرح السياسة البيانات التي قد نعالجها عند زيارة الموقع، إرسال رسالة، استخدام لوحة الإدارة، أو ربط حساب في Meta أو LinkedIn. لا تمنحنا زيارة الموقع وحدها صلاحية الوصول إلى حساباتك الاجتماعية.',
    ],
  },
  {
    title: '2. البيانات التي قد نجمعها',
    items: [
      'بيانات التواصل التي تقدمها طوعاً، مثل الاسم والبريد وموضوع الرسالة ونصها.',
      'بيانات تشغيل وأمان محدودة، مثل الصفحة التي تمت زيارتها، وقت الزيارة، مسار التنقل، حالة الطلب، ومعلومات تكنولوجية إجمالية تساعد على اكتشاف الأعطال ومنع الإساءة.',
      'بيانات محفوظة محلياً في متصفحك، مثل تقدّم القراءة، موضع تشغيل الصوت، اختيارات العرض، وبعض التفضيلات المؤقتة. يمكنك حذفها من إعدادات المتصفح.',
      'بيانات دخول لوحة الإدارة المصرّح بها، مثل البريد وسجلات المصادقة والأمان.',
      'عند ربط حساب اجتماعي: معرّف الحساب أو الصفحة، الاسم والصورة العامة التي تسمح بها المنصة، الصلاحيات التي وافقت عليها، رموز الوصول المشفّرة، المحتوى الذي اخترت نشره، ونتيجة النشر أو رابط المنشور.',
    ],
  },
  {
    title: '3. كيف نستخدم البيانات',
    items: [
      'تشغيل الموقع وحفظ إعداداته وتقديم وظائف القراءة والصوت والتواصل.',
      'الرد على الرسائل وطلبات التعاون أو الاستشارة.',
      'قياس الأداء بصورة إجمالية، تحسين تجربة الاستخدام، تشخيص الأخطاء، وحماية الخدمة.',
      'إنشاء أو تنسيق محتوى بمساعدة الذكاء الاصطناعي عندما يطلب المستخدم ذلك، وتحويل النص إلى صوت عند تشغيل هذه الوظيفة.',
      'تنفيذ تسجيل الدخول وربط الحسابات والنشر على المنصات التي يختارها المستخدم، بعد موافقته الصريحة فقط.',
      'الامتثال للالتزامات القانونية وحماية الحقوق ومنع الاستخدام غير المشروع.',
    ],
  },
  {
    title: '4. الخدمات التكنولوجية والأطراف المعالجة',
    body: [
      'قد نستعين بمقدمي خدمات لمعالجة البيانات بالقدر اللازم لتشغيل الوظيفة المطلوبة: Google Cloud وFirebase للاستضافة والمصادقة وقواعد البيانات والتخزين؛ Google Gemini للمساعدة في توليد أو تنسيق المحتوى؛ Microsoft Azure Speech لتحويل النص إلى صوت؛ Meta لربط Facebook وInstagram؛ وLinkedIn لتسجيل الدخول والنشر. تخضع هذه الخدمات لسياساتها وشروطها المستقلة.',
      'لا نبيع البيانات الشخصية ولا نؤجرها. وقد تُعالج البيانات في دول أخرى بحسب البنية العالمية لمقدمي الخدمة، مع تطبيق الضمانات المتاحة وفق الشروط السارية.',
    ],
  },
  {
    title: '5. الذكاء الاصطناعي والمحتوى الحساس',
    body: [
      'قد يُرسل النص الذي يختاره المسؤول إلى Gemini لإنتاج مسودة أو حزمة نشر، أو إلى Azure Speech لإنشاء ملف صوتي. لا ينبغي إدخال أسرار أو كلمات مرور أو بيانات صحية أو مالية أو معلومات شخصية حساسة في أدوات التوليد. يجب مراجعة المخرجات بشرياً قبل اعتمادها أو نشرها.',
    ],
  },
  {
    title: '6. الأساس القانوني والموافقة',
    body: [
      'نعالج البيانات، بحسب الحالة والقانون المنطبق، بناءً على موافقتك، أو لتنفيذ طلبك، أو لمصلحتنا المشروعة في تشغيل الموقع وتأمينه وتحسينه، أو للوفاء بالتزام قانوني. تستطيع سحب صلاحية الحساب الاجتماعي من إعدادات المنصة أو طلب حذف بيانات الربط.',
    ],
  },
  {
    title: '7. الاحتفاظ والحماية',
    body: [
      'نحتفظ بالبيانات فقط للمدة اللازمة للغرض الذي جُمعت من أجله، ولتشغيل الخدمة وتسوية المشكلات والوفاء بالمتطلبات القانونية. تُحذف أو تُعطّل رموز الوصول وبيانات الربط بعد فصل الحساب أو قبول طلب حذف موثّق، مع احتمال بقاء نسخ محدودة مؤقتاً في النسخ الاحتياطية أو السجلات الأمنية.',
      'نستخدم ضوابط وصول، وأسراراً مُدارة، واتصالات مشفّرة، وقواعد أمان مناسبة. ومع ذلك لا توجد وسيلة نقل أو تخزين إلكتروني تضمن أماناً مطلقاً.',
    ],
  },
  {
    title: '8. حقوقك وخياراتك',
    items: [
      'طلب معرفة البيانات المرتبطة بك، أو تصحيحها، أو حذفها، أو تقييد معالجتها حيث يسمح القانون.',
      'سحب موافقة الربط وإلغاء صلاحيات Meta أو LinkedIn من إعدادات حسابك لدى المنصة.',
      'مسح بيانات التخزين المحلي وملفات الموقع من إعدادات المتصفح.',
      'الاعتراض على معالجة معينة أو تقديم استفسار عبر البريد الموضح أدناه.',
    ],
  },
  {
    title: '9. الأطفال والروابط الخارجية',
    body: [
      'الموقع وخدمة النشر ليستا موجهتين لجمع بيانات أطفال دون السن القانونية، ولا نطلب منهم ربط حسابات اجتماعية. قد يحتوي الموقع على روابط لخدمات خارجية لا نتحكم في ممارساتها، ويُنصح بمراجعة سياساتها.',
    ],
  },
  {
    title: '10. تحديث السياسة والتواصل',
    body: [
      `قد نحدّث هذه السياسة عند تغير الوظائف أو المتطلبات. يظهر تاريخ آخر تحديث أعلى الصفحة. للاستفسارات أو طلبات الحقوق: ${EMAIL}.`,
    ],
  },
]

const privacyEnglish: LegalSection[] = [
  {
    title: '1. Who we are and scope',
    body: [
      'This policy applies to the official website of Dr. Ahmad Hussein Alfailakawi and the Dr Alfailakawi Publishing tool used to manage content and connect publishing accounts. The data controller is Dr. Ahmad Hussein Alfailakawi in Kuwait.',
      'It covers website visits, contact messages, authorized administration, and optional Meta or LinkedIn connections. Merely visiting the website does not give us access to your social accounts.',
    ],
  },
  {
    title: '2. Data we may collect',
    items: [
      'Information you submit, including your name, email address, message topic and message content.',
      'Limited operational and security data, such as pages viewed, timestamps, navigation paths, request status and aggregated technical information.',
      'Browser-local data, including reading progress, audio position, display choices and temporary preferences.',
      'Authorized administrator authentication information and related security records.',
      'When a social account is connected: account or Page identifiers, permitted public profile details, granted scopes, encrypted access tokens, selected publishing content, publishing status and post links.',
    ],
  },
  {
    title: '3. How we use data',
    items: [
      'To operate, secure and improve the website and its reading, audio and contact features.',
      'To respond to inquiries and collaboration requests.',
      'To diagnose errors, measure aggregate performance and prevent abuse.',
      'To generate or format content with AI, or synthesize speech, when an authorized user requests those functions.',
      'To authenticate, connect accounts and publish only to platforms explicitly selected and authorized by the user.',
      'To comply with law and protect rights and service integrity.',
    ],
  },
  {
    title: '4. Service providers and disclosures',
    body: [
      'We may use Google Cloud and Firebase for hosting, authentication, databases and storage; Google Gemini for AI-assisted content; Microsoft Azure Speech for text-to-speech; Meta for Facebook and Instagram connections; and LinkedIn for authentication and publishing. Each provider operates under its own terms and privacy practices.',
      'We do not sell or rent personal data. Data may be processed internationally as part of these providers’ global infrastructure, subject to available contractual and legal safeguards.',
    ],
  },
  {
    title: '5. AI and sensitive information',
    body: [
      'Text deliberately selected by an authorized administrator may be sent to Gemini to create a draft or social package, or to Azure Speech to produce audio. Do not submit passwords, secrets, health, financial or other sensitive personal information to generative tools. AI output must be reviewed before publication.',
    ],
  },
  {
    title: '6. Legal bases and consent',
    body: [
      'Depending on the context and applicable law, processing may rely on consent, performance of your request, legitimate interests in operating and securing the service, or legal obligations. Social platform access can be revoked through the platform or by requesting deletion of connection data.',
    ],
  },
  {
    title: '7. Retention and security',
    body: [
      'We retain information only as long as reasonably necessary for its purpose, service operation, dispute resolution, security and legal requirements. Connection records and access tokens are deleted or disabled after a verified deletion request or account disconnection, subject to limited backup and security-log retention.',
      'We use access controls, managed secrets, encrypted transport and security rules. No electronic system can guarantee absolute security.',
    ],
  },
  {
    title: '8. Your choices and rights',
    items: [
      'Request access, correction, deletion or restriction where applicable.',
      'Revoke Meta or LinkedIn permissions from your platform account settings.',
      'Clear local website data through your browser settings.',
      'Object to particular processing or contact us with a privacy request.',
    ],
  },
  {
    title: '9. Children and external links',
    body: [
      'The publishing service is not intended to collect data from children below the applicable age of consent. The website may link to third-party services whose privacy practices we do not control.',
    ],
  },
  {
    title: '10. Updates and contact',
    body: [`We may update this policy as features or requirements change. The latest revision date appears above. Privacy requests may be sent to ${EMAIL}.`],
  },
]

const termsArabic: LegalSection[] = [
  {
    title: '1. قبول الشروط',
    body: ['باستخدام الموقع أو أداة Dr Alfailakawi Publishing فإنك تقر بقراءة هذه الشروط والموافقة عليها. إن لم توافق، فتوقف عن استخدام الوظائف المعنية. قد تنطبق كذلك شروط Meta وLinkedIn وGoogle وMicrosoft وغيرها من الخدمات المرتبطة.'],
  },
  {
    title: '2. طبيعة الخدمة',
    body: ['يوفر الموقع محتوى أكاديمياً وفكرياً، ووسائل تواصل وقراءة وصوت، وأداة خاصة لإدارة المقالات وتجهيز محتوى السوشيال وربط منصات النشر. لا تمثل المواد المنشورة استشارة قانونية أو طبية أو مالية أو بديلاً عن المختص.'],
  },
  {
    title: '3. الأهلية والحسابات',
    items: [
      'يجب أن تكون مخولاً قانونياً لاستخدام الحسابات أو الصفحات التي تربطها بالخدمة.',
      'أنت مسؤول عن حماية بيانات الدخول وأسرار التطبيقات وعدم مشاركتها أو وضعها في كود علني.',
      'لا يجوز انتحال صفة الغير أو ربط حساب لا تملكه أو لا تملك صلاحية إدارته.',
      'يجوز فصل الحساب أو إيقاف الوصول عند وجود اشتباه أمني أو إساءة استخدام.',
    ],
  },
  {
    title: '4. النشر والموافقة البشرية',
    body: ['لا يُفترض أن يتم نشر محتوى على منصة اجتماعية إلا بعد اختيار الحساب والمنصة واعتماد المحتوى من مستخدم مخول. أنت مسؤول عن دقة المنشور وحقوق مواده وملاءمته وسياسات المنصة. قد ترفض منصة خارجية النشر أو تحذفه أو تغير واجهاتها دون سيطرتنا.'],
  },
  {
    title: '5. المحتوى المولّد أو المدعوم بالذكاء الاصطناعي',
    body: ['قد تحتوي المسودات أو المقترحات على أخطاء أو نقص أو تشابه غير مقصود. يجب مراجعة الحقائق والاستشهادات والصياغة وحقوق النشر قبل الاعتماد. لا يجوز استخدام أدوات الذكاء الاصطناعي لتضليل الجمهور أو انتهاك الحقوق أو إدخال معلومات سرية لا تملك حق معالجتها.'],
  },
  {
    title: '6. الملكية الفكرية',
    body: ['تبقى حقوق المحتوى الأصلي لأصحابه. يحتفظ د. أحمد حسين الفيلكاوي بحقوق المواد الأصلية المنشورة باسمه ما لم يذكر خلاف ذلك. عند رفع مادة أو اختيارها للمعالجة، فإنك تمنح الخدمة إذناً محدوداً لمعالجتها وتخزينها وإرسالها إلى المنصة المحددة بالقدر اللازم لتنفيذ طلبك.'],
  },
  {
    title: '7. الاستخدام المحظور',
    items: [
      'الوصول غير المصرح به، تجاوز ضوابط الأمان، اختبار الثغرات دون إذن، أو تعطيل الخدمة.',
      'نشر محتوى غير قانوني أو مضلل أو منتهك للخصوصية أو الملكية الفكرية.',
      'استخدام رموز الوصول أو البيانات لأغراض غير التي وافق عليها صاحب الحساب.',
      'إرسال رسائل مزعجة أو تنفيذ نشر آلي مخالف لحدود وسياسات المنصات.',
    ],
  },
  {
    title: '8. خدمات الطرف الثالث',
    body: ['تعتمد بعض الوظائف على Firebase وGemini وAzure وMeta وLinkedIn. قد تتوقف أو تتغير أو تصبح خاضعة لحدود أو مراجعات أو أسعار يحددها مزود الخدمة. لا نضمن استمرار أي واجهة خارجية أو قبول أي تطبيق أو منشور.'],
  },
  {
    title: '9. التوافر وإخلاء المسؤولية',
    body: ['تُقدَّم الخدمة على أساس حالتها المتاحة. نسعى للدقة والأمان والاستمرارية، لكن لا نضمن خلو الخدمة من الأخطاء أو الانقطاع أو فقدان البيانات. إلى أقصى حد يسمح به القانون، لا نتحمل الأضرار غير المباشرة أو التبعية الناتجة عن الاعتماد على المحتوى أو تعطل منصة خارجية.'],
  },
  {
    title: '10. التعليق والإنهاء',
    body: ['يمكنك التوقف عن استخدام الخدمة وإلغاء صلاحيات الحسابات المرتبطة في أي وقت. ويجوز تعليق وظيفة أو وصول عند مخالفة هذه الشروط أو وجود خطر أمني أو طلب قانوني. تبقى البنود التي بطبيعتها تستمر بعد الإنهاء، ومنها الملكية وحدود المسؤولية.'],
  },
  {
    title: '11. القانون والتحديثات',
    body: [`تخضع هذه الشروط للقوانين السارية في دولة الكويت، مع مراعاة الحقوق الإلزامية التي يمنحها قانون بلد المستخدم عند انطباقها. قد نحدّث الشروط، ويظهر تاريخ التحديث أعلى الصفحة. للتواصل: ${EMAIL}.`],
  },
]

const termsEnglish: LegalSection[] = [
  { title: '1. Acceptance', body: ['By using the website or Dr Alfailakawi Publishing, you agree to these terms. If you do not agree, do not use the relevant features. Separate terms of Meta, LinkedIn, Google, Microsoft and other connected services may also apply.'] },
  { title: '2. The service', body: ['The website provides academic and editorial content, contact, reading and audio features, and a private tool for managing articles, preparing social content and connecting publishing platforms. Published material is not legal, medical or financial advice.'] },
  { title: '3. Eligibility and accounts', items: ['You must be legally authorized to connect and use each account or Page.', 'You are responsible for protecting credentials, application secrets and authorized access.', 'You may not impersonate another person or connect an account you do not own or administer.', 'Access may be suspended where misuse or a security risk is reasonably suspected.'] },
  { title: '4. Publishing and human approval', body: ['Content should be published only after an authorized user selects the destination and approves the content. You are responsible for accuracy, rights, suitability and platform compliance. A third-party platform may reject, remove or change how it handles a post.'] },
  { title: '5. AI-assisted content', body: ['AI drafts may contain errors, omissions or unintended similarities. Facts, citations, wording and rights must be reviewed before use. Generative tools must not be used to deceive, infringe rights or process confidential information without authority.'] },
  { title: '6. Intellectual property', body: ['Original content remains owned by its respective rights holder. Dr. Ahmad Hussein Alfailakawi retains rights in original materials published under his name unless stated otherwise. By submitting content for processing, you grant a limited permission to process, store and transmit it only as needed to perform the requested function.'] },
  { title: '7. Prohibited use', items: ['Unauthorized access, security bypass, unapproved vulnerability testing or service disruption.', 'Illegal, deceptive, privacy-invasive or infringing content.', 'Using tokens or data beyond the purposes authorized by the account owner.', 'Spam or automation that violates platform policies or limits.'] },
  { title: '8. Third-party services', body: ['Some features depend on Firebase, Gemini, Azure, Meta and LinkedIn. Those services may change, stop, impose limits, require review or change pricing. We do not guarantee continued access to any third-party API or approval of any app or post.'] },
  { title: '9. Availability and disclaimer', body: ['The service is provided as available. We aim for accuracy, security and continuity but do not warrant uninterrupted or error-free operation or that data loss can never occur. To the extent permitted by law, indirect or consequential losses arising from reliance on content or third-party outages are excluded.'] },
  { title: '10. Suspension and termination', body: ['You may stop using the service and revoke connected-account permissions at any time. A feature or access may be suspended for breach, security risk or legal requirements. Provisions that naturally survive termination remain effective.'] },
  { title: '11. Governing law and updates', body: [`These terms are governed by the applicable laws of Kuwait, without limiting mandatory consumer rights that may apply. We may update the terms and will show the revision date above. Contact: ${EMAIL}.`] },
]

const deletionArabic: LegalSection[] = [
  {
    title: 'طلب حذف بيانات التطبيق',
    body: ['يمكنك طلب حذف البيانات التي يحتفظ بها الموقع أو أداة Dr Alfailakawi Publishing والمرتبطة بحسابك في Facebook أو Instagram أو LinkedIn. لا تحتاج إلى إرسال كلمة مرور أو App Secret أو Access Token، ولن نطلبها منك عبر البريد.'],
  },
  {
    title: 'الطريقة الأولى: إلغاء الربط من المنصة',
    items: [
      'في Facebook أو Instagram: افتح إعدادات الحساب أو مركز الحسابات، ثم قسم التطبيقات والمواقع أو تكاملات الأعمال، واختر التطبيق وأزل صلاحيته.',
      'في LinkedIn: افتح الإعدادات والخصوصية، ثم أذونات البيانات أو الخدمات المسموح بها، وأزل تطبيق Dr Alfailakawi Publishing.',
      'إلغاء الصلاحية يمنع استخدام رمز الوصول مستقبلاً. ولحذف السجلات الموجودة لدينا أيضاً، أرسل طلب الحذف بالطريقة التالية.',
    ],
  },
  {
    title: 'الطريقة الثانية: إرسال طلب مباشر',
    body: [`أرسل رسالة إلى ${EMAIL} بعنوان: «طلب حذف بيانات التطبيق». اذكر المنصة المعنية، اسم الحساب أو الصفحة، رابط الملف الشخصي أو المعرّف إن توفر، والبريد الذي يمكننا الرد عليه. حدّد هل تريد حذف بيانات الربط فقط أم الرسائل أو السجلات الأخرى المرتبطة بك.`],
  },
  {
    title: 'التحقق والتنفيذ',
    items: [
      'قد نطلب إثباتاً مناسباً بأنك صاحب الحساب أو مخول بإدارته، من دون طلب كلمة المرور.',
      'بعد التحقق، نحذف أو نعطّل رموز الوصول، معرّفات الربط، بيانات الحساب المحفوظة، وسجلات النشر المرتبطة بقدر ما يمكن تحديدها.',
      'نعالج الطلب عادة خلال 30 يوماً. سنخبرك إذا احتجنا إلى معلومات إضافية أو مدة أطول لسبب قانوني أو تكنولوجي مشروع.',
      'قد نحتفظ بحد أدنى من السجلات اللازمة للامتثال القانوني، منع الاحتيال، إثبات تنفيذ الطلب، أو حماية الحقوق، ثم نتخلص منها عند انتهاء الحاجة.',
    ],
  },
  {
    title: 'ما الذي قد لا يُحذف تلقائياً؟',
    body: ['إزالة البيانات من خدمتنا لا تحذف المنشورات التي نُشرت بالفعل على منصة خارجية. يمكنك حذف المنشور من Facebook أو Instagram أو LinkedIn مباشرة. كما قد تبقى نسخة مؤقتة في نسخة احتياطية آمنة إلى أن تدور دورة النسخ الاعتيادية، مع منع استخدامها في التشغيل اليومي.'],
  },
  {
    title: 'تأكيد الطلب',
    body: ['بعد إتمام المعالجة نرسل تأكيداً إلى عنوان البريد المستخدم في الطلب، ما لم يمنع القانون أو الأمن ذلك. للاعتراض أو الاستفسار استخدم البريد نفسه.'],
  },
]

const deletionEnglish: LegalSection[] = [
  { title: 'Request deletion of app data', body: ['You may request deletion of data held by the website or Dr Alfailakawi Publishing in connection with your Facebook, Instagram or LinkedIn account. Never send a password, App Secret or access token. We will not ask for them by email.'] },
  { title: 'Method 1: Revoke access on the platform', items: ['For Facebook or Instagram, open account settings or Accounts Center, locate Apps and Websites or Business Integrations, select the app and remove access.', 'For LinkedIn, open Settings & Privacy, locate data permissions or permitted services, and remove Dr Alfailakawi Publishing.', 'Revoking permission prevents future token use. To request deletion of records already held by us, also use Method 2.'] },
  { title: 'Method 2: Send a direct request', body: [`Email ${EMAIL} with the subject “App Data Deletion Request”. Include the platform, account or Page name, profile link or identifier if available, and an email where we can respond. State whether you want only connection data deleted or other records associated with you as well.`] },
  { title: 'Verification and action', items: ['We may ask for proportionate proof that you own or administer the account, but never your password.', 'After verification, we delete or disable access tokens, connection identifiers, stored account details and identifiable publishing logs where applicable.', 'Requests are normally processed within 30 days. We will explain if more information or additional time is reasonably required.', 'A minimal record may be retained where needed for legal compliance, fraud prevention, proof of completion or protection of rights.'] },
  { title: 'What may not be removed automatically', body: ['Deleting data from our service does not remove posts already published on a third-party platform. Delete those posts directly on Facebook, Instagram or LinkedIn. Limited encrypted backup copies may remain until routine backup rotation, without being used for normal operations.'] },
  { title: 'Confirmation', body: ['We will send a completion confirmation to the request email unless law or security prevents it. Questions or objections may be sent to the same address.'] },
]

export function PrivacyPolicy() {
  return (
    <LegalDocument
      path="/privacy"
      label="الخصوصية"
      title="سياسة الخصوصية"
      subtitle="كيف تُجمع البيانات وتُستخدم وتُحمى في الموقع وأداة النشر المرتبطة."
      englishTitle="Privacy Policy"
      updated="13 يوليو 2026"
      arabic={privacyArabic}
      english={privacyEnglish}
    />
  )
}

export function TermsOfUse() {
  return (
    <LegalDocument
      path="/terms"
      label="الشروط"
      title="شروط الاستخدام"
      subtitle="قواعد استخدام الموقع وأداة إدارة المحتوى والنشر على المنصات المرتبطة."
      englishTitle="Terms of Use"
      updated="13 يوليو 2026"
      arabic={termsArabic}
      english={termsEnglish}
    />
  )
}

export function DataDeletion() {
  return (
    <LegalDocument
      path="/data-deletion"
      label="البيانات"
      title="تعليمات حذف البيانات"
      subtitle="مسار واضح لإلغاء الربط وطلب حذف بيانات Facebook وInstagram وLinkedIn."
      englishTitle="Data Deletion Instructions"
      updated="13 يوليو 2026"
      arabic={deletionArabic}
      english={deletionEnglish}
    />
  )
}
