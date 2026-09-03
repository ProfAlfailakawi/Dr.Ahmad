/**
 * الصورة الرمزية الموحدة للأصوات العامة في الموقع.
 * أسماء محركات/شخصيات الإنتاج لا تُعرض للزائر؛ يكفي تمييز الصوت بصرياً.
 */
export function VoiceFigure({ kind, size = 16 }: { kind: 'man' | 'woman'; size?: number }) {
  return kind === 'woman' ? (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M7.2 10.4a4.8 4.8 0 1 1 9.6 0c0 1.9.5 3 1.2 4.1-1.5.6-2.6.8-4 .8h-4c-1.4 0-2.5-.2-4-.8.7-1.1 1.2-2.2 1.2-4.1Z" />
      <circle cx="12" cy="9.6" r="3.1" fill="currentColor" stroke="none" opacity=".9" />
      <path d="M5.4 20.2c1.3-2.6 3.8-3.9 6.6-3.9s5.3 1.3 6.6 3.9" />
    </svg>
  ) : (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="8.6" r="3.4" fill="currentColor" stroke="none" opacity=".9" />
      <path d="M5.2 20.2c1.3-2.9 3.9-4.4 6.8-4.4s5.5 1.5 6.8 4.4" />
    </svg>
  )
}

export function voiceKindForSpeaker(speaker = ''): 'man' | 'woman' {
  return /نورة|نوره|female|woman|أنثى|امرأة|المتحدثة/i.test(speaker) ? 'woman' : 'man'
}
