/* «استمع على» — روابط منصّات مجلس الفكرة.
 *
 * أيقونات خطّية موحّدة بلون الحبر لا شعارات المنصّات الصاخبة: تبقى أنيقةً
 * متناسقةً مع هوية الموقع. تُعرض المنصّة فقط إن كان لها رابطٌ مؤكّد؛ الباقي
 * يُضاف بسطرٍ واحد فور تأكّد ظهور البرنامج عليها. */

import type { ReactNode } from 'react'

type Platform = { name: string; url: string; glyph: ReactNode }

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const MicPodcast = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...S}>
    <rect x="9" y="3" width="6" height="10" rx="3" />
    <path d="M6 11a6 6 0 0 0 12 0" />
    <path d="M12 17v3M9.5 20h5" />
  </svg>
)
const SpotifyGlyph = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...S}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7 9.6c3.4-1 6.9-.5 9.8 1.3M7.6 13c2.9-.8 5.8-.3 8.1 1M8.1 16c2.2-.6 4.3-.3 6 .8" />
  </svg>
)
const AnghamiGlyph = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...S}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
  </svg>
)
const DeezerGlyph = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...S} strokeWidth={2}>
    <path d="M5 15v4M10 10v9M15 12v7M20 14v5" />
  </svg>
)
const AmazonGlyph = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden {...S}>
    <circle cx="8.5" cy="16.5" r="2.5" />
    <path d="M11 16.5V7l7-1.6v8.1" />
    <circle cx="15.5" cy="13.5" r="2.5" />
  </svg>
)

/* المفاتيح المؤكّدة اليوم مُوصّلة؛ اترك url فارغاً حتى يتأكّد ظهور البرنامج. */
const PLATFORMS: Platform[] = [
  { name: 'Apple Podcasts', url: 'https://podcasts.apple.com/podcast/id6801329645', glyph: MicPodcast },
  { name: 'Spotify', url: '', glyph: SpotifyGlyph },
  { name: 'Anghami', url: '', glyph: AnghamiGlyph },
  { name: 'Deezer', url: 'https://www.deezer.com/show/1003473582', glyph: DeezerGlyph },
  { name: 'Amazon Music', url: '', glyph: AmazonGlyph },
]

export function PodcastPlatforms() {
  const live = PLATFORMS.filter((p) => p.url)
  if (!live.length) return null
  return (
    <div className="mt-5">
      <p className="mb-2.5 text-[.7rem] font-semibold uppercase tracking-[.14em] text-soft">استمع على</p>
      <div className="flex flex-wrap gap-2">
        {live.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full border border-hair bg-wash/[.55] px-3.5 py-2 text-[.78rem] text-ink transition-colors hover:border-accent/[.45] hover:text-accent"
          >
            <span className="text-soft transition-colors group-hover:text-accent">{p.glyph}</span>
            {p.name}
          </a>
        ))}
      </div>
    </div>
  )
}
