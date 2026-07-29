import { useMemo } from 'react'
import podcastAdmin from '../../data/podcast-admin.json'
import type { ArticleRecord } from '../../lib/cms'
import { Pagination, usePagedList } from '../Pagination'
import type { AdminTab } from './admin-navigation'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const softBtn = 'rounded-full border border-hair px-4 py-2 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent'
const adminAudioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const adminAudioUrl = (path: string) => adminAudioBase ? `${adminAudioBase}/${path.replace(/^\/?audio\//, '')}` : path

type PodcastEpisode = {
  slug: string
  title: string
  status: string
  audio: string
  hasTranscript?: boolean
  utterances?: number
  quality?: {
    score?: number
    pass?: boolean
    pronunciation?: string
    pace?: string
    pauses?: string
    issues?: string[]
    metrics?: { durationSeconds?: number; importantRatio?: number | null; longSilences?: number | null }
  }
}

type PodcastPlaylist = { title: string; episodes: { slug: string; title: string }[] }

export function AudioSystemOverview({ articles, onOpen }: { articles: ArticleRecord[]; onOpen: (tab: AdminTab) => void }) {
  const podcast = podcastAdmin as { episodes?: PodcastEpisode[]; playlists?: PodcastPlaylist[] }
  const episodes = podcast.episodes || []
  const playlists = podcast.playlists || []
  const episodePages = usePagedList(episodes, 8, String(episodes.length))
  const playlistPages = usePagedList(playlists, 6, String(playlists.length))
  const summary = useMemo(() => {
    const withAudio = articles.filter((article) => article.hasAudio).length
    const blocked = episodes.filter((episode) => episode.status !== 'published' || !episode.quality?.pass)
    const average = episodes.length ? Math.round(episodes.reduce((sum, episode) => sum + Number(episode.quality?.score || 0), 0) / episodes.length) : 0
    return { withAudio, missing: Math.max(0, articles.length - withAudio), published: episodes.length - blocked.length, blocked, average }
  }, [articles, episodes])

  return (
    <section className="grid gap-4" aria-labelledby="audio-system-overview-title">
      <div className={`${card} border-accent/25 bg-accent/[.035]`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.72rem] font-semibold text-accent">نظرة الصوت الرسمية</p>
            <h2 id="audio-system-overview-title" className="mt-1 font-display text-xl font-semibold text-ink">الحالة والجودة والمكتبة في مكان الإنتاج نفسه.</h2>
            <p className="mt-2 max-w-2xl text-[.8rem] leading-relaxed text-soft">المختبر يطوّر الفكرة فقط؛ مراقبة الصوت وقراراته تعيش هنا مع قافلة الصوت وغرفة الإنتاج.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={softBtn} onClick={() => onOpen('sound-caravan')}>قافلة الصوت</button>
            <button type="button" className={softBtn} onClick={() => onOpen('audio-library')}>مكتبة الصوت</button>
            <button type="button" className={softBtn} onClick={() => onOpen('voice')}>اختيار الأصوات</button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['مقالات بصوت', summary.withAudio],
            ['تحتاج صوتاً', summary.missing],
            ['حلقات منشورة', summary.published],
            ['تحت المراجعة', summary.blocked.length],
            ['متوسط الجودة', summary.average],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{value}</strong><span className="mt-1 block text-[.72rem] text-soft">{label}</span></div>)}
        </div>
      </div>

      <details className={`${card} group`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 marker:hidden">
          <span><span className="block font-display text-lg font-semibold text-ink">الحلقات الحوارية وقوائم الاستماع</span><span className="mt-1 block text-[.8rem] text-soft">السماع والتحقق من Transcript والـScore من دون إنشاء لوحة صوت ثانية.</span></span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="mt-5 border-t border-hair pt-5">
          <div id="audio-system-episodes" className="grid scroll-mt-28 gap-3">
            {episodes.length ? episodePages.pageItems.map((episode) => (
              <div key={episode.slug} className="rounded-xl border border-hair bg-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{episode.title}</p>
                    <p className="mt-1 text-[.76rem] text-soft">الحالة: {episode.status === 'published' ? 'منشورة' : episode.status} · Transcript: {episode.hasTranscript ? `${episode.utterances || 0} مداخلة` : 'غير موجود'} · Score: {episode.quality?.score ?? 0}/100</p>
                    {episode.quality?.issues?.length ? <p className="mt-1 text-[.74rem] text-soft">{episode.quality.issues[0]}</p> : null}
                  </div>
                  <a href={adminAudioUrl(episode.audio)} target="_blank" rel="noreferrer" className={softBtn}>استماع</a>
                </div>
              </div>
            )) : <p className="rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">لا توجد حلقات حوارية منشورة بعد.</p>}
            <Pagination page={episodePages.page} pageCount={episodePages.pageCount} onChange={episodePages.setPage} totalItems={episodes.length} firstItem={episodePages.firstItem} lastItem={episodePages.lastItem} scrollTargetId="audio-system-episodes" label="صفحات الحلقات الحوارية" />
          </div>
          <div id="audio-system-playlists" className="mt-6 grid scroll-mt-28 gap-3">
            <p className="text-[.76rem] font-semibold text-accent">قوائم استماع فكرية</p>
            {playlists.length ? playlistPages.pageItems.map((playlist) => <div key={playlist.title} className="rounded-xl border border-hair bg-canvas p-4"><p className="font-semibold text-ink">{playlist.title}</p><ul className="mt-2 grid gap-1 text-[.8rem] text-soft">{playlist.episodes.map((episode) => <li key={episode.slug}>• {episode.title}</li>)}</ul></div>) : <p className="rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">ستُبنى القوائم تلقائياً مع زيادة الحلقات.</p>}
            <Pagination page={playlistPages.page} pageCount={playlistPages.pageCount} onChange={playlistPages.setPage} totalItems={playlists.length} firstItem={playlistPages.firstItem} lastItem={playlistPages.lastItem} scrollTargetId="audio-system-playlists" label="صفحات قوائم الاستماع" />
          </div>
        </div>
      </details>
    </section>
  )
}
