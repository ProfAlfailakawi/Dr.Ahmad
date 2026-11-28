import { useEffect, useState } from 'react'
import { Page, SocialIcon } from '../components/ui'
import { useSeo } from '../components/seo'
import { profile, socials, academicProfiles, links, site } from '../data'
import { ArrowLeft, Check, Globe, UserPlus, Wallet } from 'lucide-react'

/*
 * البطاقة الرقمية `/card`: صفحةٌ مستقلّةٌ للمؤتمرات واللقاءات — اسمك وصفتك،
 * وزرٌّ واحدٌ يحفظ جهة اتصالك في هاتف من أمامك (ملف vCard قياسي)، ثم روابطك
 * الرسمية بهدوء. لا خدمة خارجية، ولا تلوّث على صفحاتك القائمة.
 */
/* ملف vCard ثابت في public/card.vcf يحمل الصورة والروابط بعناوينها. Safari وApp Clip
   يفتحانه مباشرةً في معاينة «جهة اتصال جديدة»، بلا تنزيل ملف. */
const VCARD_URL = '/card.vcf'

/* لافتة App Clip في Safari: تظهر أعلى الصفحة باسم البطاقة وزر «فتح». */
const APP_CLIP_META = 'app-id=6834582484, app-clip-bundle-id=com.dralfailakawi.library.Clip, app-clip-display=card'

export default function Card() {
  useSeo({ title: 'البطاقة الرقمية', path: '/card', description: 'البطاقة الرقمية للدكتور أحمد حسين الفيلكاوي — احفظ جهة الاتصال والروابط الرسمية بلمسة.' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // index.html يحمل وسم apple-itunes-app للتطبيق؛ في /card نضيف إليه الـ App Clip ثم نعيده.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-itunes-app"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'apple-itunes-app'
      document.head.appendChild(meta)
    }
    const previous = meta.content
    meta.content = APP_CLIP_META
    return () => {
      if (created) meta?.remove()
      else if (meta) meta.content = previous
    }
  }, [])

  // .pkpass يفتح في Wallet على أجهزة Apple فقط؛ أندرويد لا يفهمه فلا نعرض الزر له.
  const [isApple, setIsApple] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsApple(/iPhone|iPad|iPod|Macintosh/.test(ua) && !/Android/.test(ua))
  }, [])

  const saveContact = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2600)
  }

  const globe = (
    <Globe aria-hidden size={16} strokeWidth={1.6} />
  )
  const profileLinks = [
    { label: 'الموقع الرسمي', url: site.url, icon: null as string | null },
    ...socials.map((item) => ({ label: item.label, url: item.url, icon: item.label as string | null })),
  ]

  return (
    <Page className="duo-book">
      <section className="flex min-h-[88svh] items-center justify-center px-6 py-20">
        <div className="card-spread mx-auto w-full max-w-md text-center">
          <img decoding="async" src="/portrait.webp" alt="" width={1345} height={2048} className="mx-auto h-24 w-24 rounded-full border border-hair object-cover object-top" />
          <h1 className="mt-6 font-display text-[clamp(1.6rem,5vw,2.1rem)] font-bold leading-[1.25] text-ink">{profile.fullName}</h1>
          <p className="mt-2 text-[.86rem] font-light leading-[1.8] text-soft">{profile.eyebrow}</p>

          <a
            href={VCARD_URL}
            onClick={saveContact}
            className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3 text-[.9rem] font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep"
          >
            {saved ? (
              <><span aria-hidden><Check aria-hidden size="1em" strokeWidth={1.6} className="inline-block align-[-0.125em]" /></span> حُفظت جهة الاتصال</>
            ) : (
              <>
                <UserPlus aria-hidden size={17} strokeWidth={1.6} />
                احفظ جهة الاتصال
              </>
            )}
          </a>
          <p className="mt-3 text-[.7rem] text-soft/75">تُضاف إلى جهات اتصال هاتفك مباشرةً مع الصورة والروابط.</p>
          {isApple && (
            <a href="/card.pkpass" className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-[.82rem] font-semibold text-white">
              <Wallet aria-hidden size={17} strokeWidth={1.6} />
              أضف إلى Apple Wallet
            </a>
          )}

          <div className="mt-10 flex items-center justify-center gap-2.5" aria-label="الملفات الأكاديمية">
            {academicProfiles.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                title={item.label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <SocialIcon name={item.label} size={18} />
              </a>
            ))}
          </div>

          <div className="mt-5 grid gap-2.5">
            {profileLinks.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target={item.url.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-hair bg-canvas px-5 py-3.5 text-start transition-colors hover:border-accent/[.45]"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors group-hover:border-accent group-hover:text-accent">
                    {item.icon ? <SocialIcon name={item.icon} size={16} /> : globe}
                  </span>
                  <span className="text-[.86rem] font-semibold text-ink">{item.label}</span>
                </span>
                <span className="text-[.8rem] text-soft transition-transform duration-300 group-hover:-translate-x-1" aria-hidden><ArrowLeft aria-hidden size="1em" strokeWidth={1.6} className="inline-block align-[-0.125em]" /></span>
              </a>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={links.booking} target="_blank" rel="noreferrer" className="rounded-full border border-accent px-5 py-2 text-[.82rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas">احجز لقاءً</a>
            <a href={links.cv} target="_blank" rel="noreferrer" className="rounded-full border border-hair px-5 py-2 text-[.82rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">السيرة الذاتية (PDF)</a>
          </div>
        </div>
      </section>
    </Page>
  )
}
