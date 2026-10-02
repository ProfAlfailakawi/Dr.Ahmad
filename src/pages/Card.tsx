import { useState } from 'react'
import { Page, SocialIcon } from '../components/ui'
import { useSeo } from '../components/seo'
import { profile, socials, academicProfiles, links, site } from '../data'
import { ArrowLeft, Check, Globe, UserPlus } from 'lucide-react'

/*
 * البطاقة الرقمية `/card`: صفحةٌ مستقلّةٌ للمؤتمرات واللقاءات — اسمك وصفتك،
 * وزرٌّ واحدٌ يحفظ جهة اتصالك في هاتف من أمامك (ملف vCard قياسي)، ثم روابطك
 * الرسمية بهدوء. لا خدمة خارجية، ولا تلوّث على صفحاتك القائمة.
 */
const SAVED_CONTACT_TITLE = 'أستاذ تكنولوجيا التعليم والذكاء الاصطناعي'

function buildVCard() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${profile.fullName}`,
    'N:الفيلكاوي;أحمد;حسين;د.;',
    `TITLE:${SAVED_CONTACT_TITLE}`,
    `URL:${site.url}`,
    ...academicProfiles.map((item) => `URL:${item.url}`),
    ...socials.map((item) => `URL:${item.url}`),
    'END:VCARD',
  ].join('\r\n')
}

export default function Card() {
  useSeo({ title: 'البطاقة الرقمية', path: '/card', description: 'البطاقة الرقمية للدكتور أحمد حسين الفيلكاوي — احفظ جهة الاتصال والروابط الرسمية بلمسة.' })
  const [saved, setSaved] = useState(false)

  const saveContact = () => {
    try {
      const blob = new Blob([buildVCard()], { type: 'text/vcard;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'د-أحمد-الفيلكاوي.vcf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 3000)
      setSaved(true)
      setTimeout(() => setSaved(false), 2600)
    } catch { /* التنزيل اختياري */ }
  }

  const globe = (
    <Globe aria-hidden size={16} strokeWidth={1.6} />
  )
  const profileLinks = [
    { label: 'الموقع الرسمي', url: site.url, icon: null as string | null },
    ...socials.map((item) => ({ label: item.label, url: item.url, icon: item.label as string | null })),
  ]

  return (
    <Page>
      <section className="flex min-h-[88svh] items-center justify-center px-6 py-20">
        <div className="mx-auto w-full max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hair bg-wash">
            <img decoding="async" src="/tebyan-icon.png" alt="" width={30} height={30} className="opacity-90" />
          </span>
          <h1 className="mt-6 font-display text-[clamp(1.6rem,5vw,2.1rem)] font-bold leading-[1.25] text-ink">{profile.fullName}</h1>
          <p className="mt-2 text-[.86rem] font-light leading-[1.8] text-soft">{profile.eyebrow}</p>

          <button
            type="button"
            onClick={saveContact}
            className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent px-7 py-3 text-[.9rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
          >
            {saved ? (
              <><span aria-hidden><Check aria-hidden size="1em" strokeWidth={1.6} className="inline-block align-[-0.125em]" /></span> حُفظت جهة الاتصال</>
            ) : (
              <>
                <UserPlus aria-hidden size={17} strokeWidth={1.6} />
                احفظ جهة الاتصال
              </>
            )}
          </button>
          <p className="mt-3 text-[.7rem] text-soft/75">تُضاف إلى جهات اتصال هاتفك مباشرةً (ملف vCard).</p>

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
            <a href={links.booking} target="_blank" rel="noreferrer" className="rounded-full border border-accent px-5 py-2 text-[.82rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">احجز لقاءً</a>
            <a href={links.cv} target="_blank" rel="noreferrer" className="rounded-full border border-hair px-5 py-2 text-[.82rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">السيرة الذاتية (PDF)</a>
          </div>
        </div>
      </section>
    </Page>
  )
}
