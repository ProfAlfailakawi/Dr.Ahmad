import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page } from '../components/ui'
import { fetchPublishedExtras } from '../lib/firebase'
import { useSeo } from '../components/seo'

type NowItem = {
  id: string
  question?: string
  note?: string
  link?: string
}

export default function Now() {
  useSeo({
    title: 'ماذا أفكر الآن',
    description: 'أسئلة وملاحظات قصيرة تتشكّل بين المقالات الكبيرة.',
    path: '/now',
  })
  const [items, setItems] = useState<NowItem[]>([])

  useEffect(() => {
    let active = true
    fetchPublishedExtras<NowItem>('site_now').then((value) => {
      if (active) setItems(value.slice(0, 3))
    })
    return () => { active = false }
  }, [])

  return (
    <Page>
      <main className="px-6 pb-24 pt-36 md:px-11 md:pt-44">
        <div className="mx-auto max-w-3xl">
          <FadeUp>
            <p className="mb-3 text-[.82rem] font-semibold uppercase text-accent">ماذا أفكر الآن؟</p>
            <h1 className="font-display text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.25] text-ink">
              أفكار قصيرة في طور التشكّل.
            </h1>
            <p className="mt-5 max-w-2xl text-[1rem] font-light leading-loose text-soft">
              ليست مقالات مكتملة؛ بل أسئلة وملاحظات صغيرة تسبق المقال أحياناً.
            </p>
          </FadeUp>

          <div className="mt-12 grid gap-4">
            {items.length ? items.map((item) => (
              <FadeUp key={item.id}>
                <article className="rounded-2xl border border-hair bg-wash p-6">
                  <h2 className="font-display text-xl font-semibold leading-relaxed text-ink">{item.question}</h2>
                  {item.note && <p className="mt-3 text-[.94rem] leading-loose text-soft">{item.note}</p>}
                  {item.link && (
                    <Link to={item.link} className="mt-4 inline-block text-[.84rem] font-semibold text-accent">
                      اقرأ ما يتصل بها ←
                    </Link>
                  )}
                </article>
              </FadeUp>
            )) : (
              <FadeUp>
                <div className="rounded-2xl border border-hair bg-wash p-8 text-center text-soft">
                  ستظهر هنا آخر ثلاث أفكار يضيفها الدكتور من لوحة التحكم.
                </div>
              </FadeUp>
            )}
          </div>
        </div>
      </main>
    </Page>
  )
}

