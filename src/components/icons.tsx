/* أيقونات SVG أحادية اللون تتبع لون النص — ملف مستقل يمنع الاستيراد الدائري.
   أيقونات الواجهة كلها خطية (lucide، سمك 1.6) كي لا يختلط الخط الرفيع بالمصمت؛
   تبقى شعارات المنصات (LinkedIn وX…) علاماتٍ تجارية كما هي. */
import {
  ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, Bookmark, Calendar, Check, ChevronDown, ChevronLeft, CircleHelp, Copy, Download, FileText, History,
  Image, Link, Mail, PenLine, Play, Printer, Quote, Search, Share2, Sparkles, Trash2, X, type LucideIcon,
} from 'lucide-react'

const LINE_ICONS: Record<string, LucideIcon> = {
  Link, Check, Calendar, Search, Spark: Sparkles, Mail, Bookmark, Copy, Image, Cite: Quote, Close: X,
  Download, Print: Printer, Play, History, ArrowUp, Edit: PenLine, ChevronDown, Trash: Trash2, Share: Share2,
  ArrowBack: ChevronLeft, Question: CircleHelp, CV: FileText,
}

/* سهم اتجاهي موحّد يحلّ محلّ الأسهم النصية (← → ↗ ↖) داخل النصوص.
   kind: next = تقدّم في اتجاه القراءة (يسار في RTL، يمين في LTR) · out = ↗ · back = عودة (يمين في RTL). */
export function Arrow({ kind = 'next', ltr = false, bare = false, className = '' }: { kind?: 'next' | 'back' | 'out' | 'upstart'; ltr?: boolean; bare?: boolean; className?: string }) {
  const Cmp = kind === 'out' ? ArrowUpRight
    : kind === 'upstart' ? (ltr ? ArrowUpRight : ArrowUpLeft)
    : (kind === 'next') === !ltr ? ArrowLeft : ArrowRight
  return <Cmp aria-hidden="true" size="1em" strokeWidth={1.6} className={`inline-block shrink-0 align-[-0.125em] ${bare ? '' : kind === 'back' ? 'me-[.3em]' : 'ms-[.3em]'} ${className}`.trim()} />
}

export function SocialIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Line = LINE_ICONS[name]
  if (Line) return <Line size={size} strokeWidth={1.6} aria-hidden="true" />
  if (name === 'Tebyan') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 4.5h9.4A3.6 3.6 0 0 1 18 8.1V19H8.6A3.6 3.6 0 0 1 5 15.4V4.5Z" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round" />
        <path d="M8.3 8.2h6.5M8.3 11.5h6.5M8.3 14.8h4.2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 7.6c.9-.55 1.45-1.35 1.7-2.4" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'Schedule') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.2" width="17" height="15" rx="2.4" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 3.5v3.3M16.5 3.5v3.3M3.7 9.2h16.6" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'Google Scholar') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.7 9.1 12 4l9.3 5.1L12 14.2 2.7 9.1Z" fill="currentColor" />
        <path d="M6.3 11.2v4.1c0 1.55 2.55 3.2 5.7 3.2s5.7-1.65 5.7-3.2v-4.1L12 14.35l-5.7-3.15Z" fill="currentColor" opacity=".78" />
        <path d="M20.2 10.15v5.25" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20.2" cy="16.9" r="1.15" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'ResearchGate') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.15" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.2 16.9V7.1h4.1c2.18 0 3.56 1.13 3.56 3.02 0 1.34-.72 2.3-1.92 2.73l2.38 4.05h-2.18l-2.1-3.72H9.18v3.72H7.2Zm1.98-5.4h1.94c1.1 0 1.72-.47 1.72-1.3 0-.85-.62-1.31-1.72-1.31H9.18v2.61Z" fill="currentColor" />
        <path d="M16.45 7.5h2.8M17.85 6.1v2.8" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'ORCID') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.1" stroke="currentColor" strokeWidth="1.55" />
        <circle cx="8.5" cy="7.75" r="1.05" fill="currentColor" />
        <rect x="7.75" y="9.9" width="1.5" height="6.35" rx=".5" fill="currentColor" />
        <path d="M11.3 9.9h2.75c1.92 0 3.2 1.24 3.2 3.18s-1.28 3.17-3.2 3.17H11.3V9.9Zm1.55 1.45v3.45h1.1c1.09 0 1.75-.66 1.75-1.72 0-1.07-.66-1.73-1.75-1.73h-1.1Z" fill="currentColor" />
      </svg>
    )
  }
  if (name === 'Wikidata') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.6 6.6v10.8M6.1 6.6v10.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        <path d="M9 6.6v10.8M11.6 6.6v10.8M14.1 6.6v10.8" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" />
        <path d="M17 6.6v10.8M20.4 6.6v10.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'Web of Science') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9.15" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.4 8.7 8.6 15.3 12 9.7 15.4 15.3 17.6 8.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'Semantic Scholar') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.2 5 7.3v6.1c0 4 3.05 6.4 7 7.4 3.95-1 7-3.4 7-7.4V7.3L12 3.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8.9 12.7c1.45 1.1 4.55 1 6-1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.1 9.5c1.45-1.05 4.35-.95 5.6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (name === 'Goodreads') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="10.35" cy="10.75" r="4.3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14.8 7.2v8.9c0 2.6-1.75 4.2-4.45 4.2-2.15 0-3.75-1-4.2-2.65" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  }
  if (name === 'Wikipedia') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.6 7.4h5.1M9.4 7.4h4M15.4 7.4h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M4.2 7.4 8.7 17.6 11.3 11.2M11 7.4l3.9 10.2 4-10.2M12.6 11l1.4-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  const p: Record<string, string> = {
    LinkedIn: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45z',
    WhatsApp: 'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.23-.64.08-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.77-1.65-2.07-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.01-1.04 2.48s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.64-.24-.38a9.86 9.86 0 01-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 016.98 2.9 9.82 9.82 0 012.9 6.99c0 5.45-4.44 9.88-9.89 9.88m8.42-18.3A11.8 11.8 0 0012.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.59 5.94L.06 24l6.33-1.66a11.9 11.9 0 005.65 1.44h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.49-8.4',

    X: 'M17.6 3h3.1l-6.78 7.74L22 21h-6.2l-4.86-6.36L5.4 21H2.3l7.25-8.29L2 3h6.36l4.4 5.82L17.6 3zm-1.09 16.1h1.72L7.6 4.8H5.75l10.76 14.3z',
    Instagram: 'M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 01-1.38-.9 3.7 3.7 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 1.8c-3.15 0-3.5.01-4.74.07-.9.04-1.38.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.33-.28.81-.32 1.71C3.21 8.5 3.2 8.85 3.2 12s.01 3.5.07 4.74c.04.9.19 1.38.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.33.13.81.28 1.71.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.38-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.33.28-.81.32-1.71.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.38-.32-1.71a2.85 2.85 0 00-.69-1.06 2.85 2.85 0 00-1.06-.69c-.33-.13-.81-.28-1.71-.32C15.5 4.01 15.15 4 12 4zm0 3.06A4.94 4.94 0 1112 17a4.94 4.94 0 010-9.88zm0 1.8a3.14 3.14 0 100 6.28 3.14 3.14 0 000-6.28zm5.14-.66a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z',
    Facebook: 'M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z',
    YouTube: 'M23.5 6.5a3 3 0 00-2.1-2.12C19.5 3.87 12 3.87 12 3.87s-7.5 0-9.4.51A3 3 0 00.5 6.5 31 31 0 000 12a31 31 0 00.5 5.5 3 3 0 002.1 2.12c1.9.51 9.4.51 9.4.51s7.5 0 9.4-.51a3 3 0 002.1-2.12A31 31 0 0024 12a31 31 0 00-.5-5.5zM9.6 15.5v-7l6.3 3.5-6.3 3.5z',
  }
  const d = p[name] || p.LinkedIn
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
