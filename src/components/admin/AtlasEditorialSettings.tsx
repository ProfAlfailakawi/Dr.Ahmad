import { useEffect, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import {
  cacheAtlasSettings,
  constellationLines,
  fetchAtlasSettings,
  parseConstellationLines,
} from '../../lib/atlas-settings'
import { getDb } from '../../lib/firebase'

export function AtlasEditorialSettings({ articles }: { articles: ArticleRecord[] }) {
  const [dailyStarSlug, setDailyStarSlug] = useState('')
  const [lines, setLines] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle')

  useEffect(() => {
    let active = true
    fetchAtlasSettings().then((value) => {
      if (!active) return
      setDailyStarSlug(value.dailyStarSlug)
      setLines(constellationLines(value.constellations))
    })
    return () => { active = false }
  }, [])

  const save = async () => {
    const validSlugs = new Set(articles.map((article) => article.slug))
    const settings = {
      dailyStarSlug: validSlugs.has(dailyStarSlug.trim()) ? dailyStarSlug.trim() : '',
      constellations: parseConstellationLines(lines)
        .map((item) => ({ ...item, slugs: item.slugs.filter((slug) => validSlugs.has(slug)) }))
        .filter((item) => item.slugs.length >= 2),
    }
    setState('busy')
    try {
      const db = await getDb()
      if (!db) throw new Error('firebase unavailable')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'site_settings', 'atlas'), { ...settings, updatedAt: serverTimestamp() }, { merge: true })
      cacheAtlasSettings(settings)
      setState('saved')
      window.setTimeout(() => setState('idle'), 2800)
    } catch {
      setState('error')
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-hair bg-paper p-5 md:p-7" aria-labelledby="atlas-editorial-title">
      <p className="text-[.7rem] font-semibold text-accent">سماء المقالات</p>
      <h2 id="atlas-editorial-title" className="mt-1 font-display text-xl font-bold text-ink">النجم الساطع والكوكبات</h2>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-[.78rem] font-semibold text-ink">
          نجمة اليوم
          <select value={dailyStarSlug} onChange={(event) => setDailyStarSlug(event.target.value)} className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] font-normal text-ink">
            <option value="">اختيار يومي تلقائي</option>
            {articles.map((article) => <option key={article.slug} value={article.slug}>{article.title}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-[.78rem] font-semibold text-ink">
          مسارات الكوكبات
          <textarea
            value={lines}
            onChange={(event) => setLines(event.target.value)}
            dir="auto"
            rows={5}
            placeholder="رحلة القلق التربوي | article-slug-1, article-slug-2, article-slug-3"
            className="rounded-xl border border-hair bg-canvas px-4 py-3 font-mono text-[.78rem] font-normal leading-7 text-ink"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={state === 'busy'} className="rounded-full bg-accent px-5 py-2.5 text-[.76rem] font-semibold text-white disabled:opacity-50">{state === 'busy' ? 'يحفظ…' : 'حفظ السماء'}</button>
          {state === 'saved' && <span className="text-[.74rem] font-semibold text-accent">تم الحفظ.</span>}
          {state === 'error' && <span className="text-[.74rem] font-semibold text-red-500">تعذّر الحفظ.</span>}
        </div>
      </div>
    </section>
  )
}
