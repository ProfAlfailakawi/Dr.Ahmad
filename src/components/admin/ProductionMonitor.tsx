import { useMemo } from 'react'
import guardian from '../../data/site-guardian.json'
import audio from '../../data/audio.json'
import supervisor from '../../data/audio-supervisor.json'
import type { ArticleRecord } from '../../lib/cms'
import type { AdminTab } from './AdminArchitecture'

const card='min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const button='rounded-full border border-hair px-4 py-2 text-[.78rem] font-semibold text-soft transition hover:border-accent hover:text-accent'

type Props={articles:ArticleRecord[];onOpen:(tab:AdminTab)=>void}
export function ProductionMonitor({articles,onOpen}:Props){
  const stats=useMemo(()=>{
    const audioMap=audio as Record<string,unknown>
    const ready=articles.filter((a)=>Boolean(audioMap[a.slug])||a.hasAudio).length
    const pending=Math.max(0,articles.filter((a)=>!a._cms.hidden).length-ready)
    const sup=supervisor as any
    return {
      designs:Number(localStorage.getItem('dr-ahmad-social-design-generated-count')||0),
      campaigns:Number(localStorage.getItem('dr-ahmad-social-campaign-count')||0),
      audioReady:ready,audioPending:pending,
      audioFailed:Number(sup?.summary?.failed||sup?.failed||0),
      links:Number((guardian as any)?.counts?.brokenInternal||0),
      images:Number((guardian as any)?.counts?.missingImages||0),
      whatsappLearned:Number(localStorage.getItem('whatsapp-learned-patterns-count')||0),
      guardian:String((guardian as any)?.status||'pending'),
    }
  },[articles])
  const rows=[
    ['التصميم','الاستوديو والـDNA',stats.designs,'studio'],
    ['الحملات','خطط النشر المتكاملة',stats.campaigns,'studio'],
    ['الصوت','جاهز / ينتظر',`${stats.audioReady} / ${stats.audioPending}`,'production'],
    ['روابط وصور','تنبيهات الحارس',stats.links+stats.images,'content-health'],
    ['واتساب','أنماط تعلّم محلية',stats.whatsappLearned,'whatsapp'],
  ] as const
  return <div className="grid gap-5">
    <section className={`${card} border-accent/25 bg-accent/[.035]`}>
      <p className="text-[.72rem] font-bold uppercase tracking-[.16em] text-accent">Production monitor</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-display text-[clamp(1.5rem,3vw,2.3rem)] font-bold text-ink">نبض المنظومة في شاشة واحدة.</h2><p className="mt-2 max-w-2xl text-[.82rem] leading-relaxed text-soft">لا تكرر غرف الأدوات؛ تجمع حالتها وتفتح موضع القرار فقط.</p></div><span className={`rounded-full px-4 py-2 text-[.74rem] font-semibold ${stats.guardian==='healthy'?'bg-accent/10 text-accent':'bg-amber-50 text-amber-900'}`}>{stats.guardian==='healthy'?'الحارس سليم':'الحارس يحتاج فحصًا'}</span></div>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{rows.map(([label,note,value,tab])=><button key={label} type="button" onClick={()=>onOpen(tab)} className={`${card} text-right transition hover:border-accent`}><span className="text-[.7rem] font-semibold text-accent">{label}</span><strong className="mt-2 block font-display text-2xl text-ink">{value}</strong><span className="mt-1 block text-[.7rem] text-soft">{note}</span></button>)}</section>
    <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-xl font-bold text-ink">الأولوية الآن</h3><p className="mt-1 text-[.78rem] text-soft">يظهر فقط ما يحتاج قرارًا.</p></div><div className="flex flex-wrap gap-2">{stats.audioFailed>0&&<button className={button} onClick={()=>onOpen('production')}>{stats.audioFailed} فشل صوتي</button>}{stats.audioPending>0&&<button className={button} onClick={()=>onOpen('production')}>{stats.audioPending} مادة بلا صوت</button>}{stats.links+stats.images>0&&<button className={button} onClick={()=>onOpen('content-health')}>{stats.links+stats.images} مشكلة محتوى</button>}{stats.audioFailed===0&&stats.audioPending===0&&stats.links+stats.images===0&&<span className="text-[.82rem] text-soft">لا توجد مشكلة عاجلة.</span>}</div></div></section>
  </div>
}
