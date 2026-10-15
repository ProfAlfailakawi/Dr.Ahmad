import type { RankedBar, YearBar } from '../lib/count-tiles'

/* بلاطات عدّ هادئة فوق القوائم — عرض فقط، بألوان التوكنات نفسها. */

const fmt = (value: number) => String(value)

export function RingTile({ value, of, label, note }: { value: number; of: number; label: string; note?: string }) {
  const radius = 34
  const full = 2 * Math.PI * radius
  const share = of > 0 ? Math.min(1, value / of) : 0
  return (
    <div className="count-tile count-tile--row" role="img" aria-label={`${label}: ${fmt(value)}${note ? `، ${note}` : ''}`}>
      <svg className="count-ring" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgb(var(--c-ink) / .1)" strokeWidth="6" />
        <circle cx="44" cy="44" r={radius} fill="none" stroke="rgb(var(--c-accent))" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${full * share} ${full}`} transform="rotate(-90 44 44)" />
        <text x="44" y="51" textAnchor="middle" className="count-ring-text">{fmt(value)}</text>
      </svg>
      <div>
        <p className="count-tile-title">{label}</p>
        {note && <p className="count-tile-note">{note}</p>}
      </div>
    </div>
  )
}

export function YearBarsTile({ title, bars }: { title: string; bars: YearBar[] }) {
  const max = Math.max(...bars.map((bar) => bar.count), 1)
  return (
    <div className="count-tile">
      <p className="count-tile-title">{title}</p>
      <div className="count-bars" role="img" aria-label={title + ': ' + bars.map((bar) => `${bar.year} ${bar.count}`).join('، ')}>
        {bars.map((bar) => (
          <div key={bar.year} className="count-bar">
            <span className="count-bar-value">{bar.count > 0 ? fmt(bar.count) : ''}</span>
            <i style={{ height: bar.count > 0 ? `${Math.max(8, (bar.count / max) * 60)}px` : '2px', opacity: bar.count > 0 ? 1 : .35 }} />
            <span className="count-bar-key">{bar.year}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const booksWord = (n: number) => (n === 1 ? 'كتاب واحد' : n === 2 ? 'كتابان' : n <= 10 ? `${fmt(n)} كتب` : `${fmt(n)} كتاباً`)

/** خطّ زمني بالسنوات التي صدر فيها شيء فعلاً — بلا أعمدةٍ فارغة. سنة واحدة تصير جملة. */
export function YearTimelineTile({ title, bars }: { title: string; bars: YearBar[] }) {
  const rows = bars.filter((bar) => bar.count > 0).sort((a, b) => Number(a.year) - Number(b.year))
  if (rows.length === 0) return null
  return (
    <div className="count-tile">
      <p className="count-tile-title">{title}</p>
      {rows.length === 1 ? (
        <p className="count-tile-note">{booksWord(rows[0].count)} صدرت كلها عام {rows[0].year}.</p>
      ) : (
        <ol className="count-timeline" aria-label={title}>
          {rows.map((row) => (
            <li key={row.year}>
              <span className="count-timeline-year">{row.year}</span>
              <span className="count-timeline-count">{booksWord(row.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function RankedTile({ title, note, rows }: { title: string; note?: string; rows: RankedBar[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="count-tile count-tile--wide">
      <p className="count-tile-title">{title}</p>
      {note && <p className="count-tile-note">{note}</p>}
      <div className="count-ranked" role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${fmt(row.value)}`).join('، ')}`}>
        {rows.map((row) => (
          <div key={row.label} className="count-ranked-row">
            <span className="count-ranked-key">{row.label}</span>
            <span className="count-ranked-track"><i style={{ width: `${(row.value / max) * 100}%` }} /></span>
            <span className="count-ranked-value">{fmt(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CountTiles({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <section className={`count-tiles ${className}`.trim()} aria-label={label}>{children}</section>
}
