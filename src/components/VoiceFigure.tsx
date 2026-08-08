/**
 * الصورة الرمزية الموحدة للأصوات العامة في الموقع.
 * أسماء محركات/شخصيات الإنتاج لا تُعرض للزائر؛ يكفي تمييز الصوت بصرياً.
 */
export function VoiceFigure({ kind, size = 16 }: { kind: 'man' | 'woman'; size?: number }) {
  return kind === 'woman' ? (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M7.2 10.4a4.8 4.8 0 1 1 9.6 0c0 1.9.5 3 1.2 4.1-1.5.6-2.6.8-4 .8h-4c-1.4 0-2.5-.2-4-.8.7-1.1 1.2-2.2 1.2-4.1Z" />
      <path d="M9.1 7.6c1.8 1 3.8 1 5.8 0M9 18.3c.8-.8 1.8-1.2 3-1.2s2.2.4 3 1.2M12 17.1v4" />
    </svg>
  ) : (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="9" r="4.5" />
      <path d="M7.5 8.2c.8-2.8 2.4-4.2 4.8-4.2 2.1 0 3.6 1.1 4.2 3.2M8.8 13c.5 1.1 1.6 1.8 3.2 1.8s2.7-.7 3.2-1.8M6.5 21c.5-3 2.5-4.8 5.5-4.8s5 1.8 5.5 4.8" />
    </svg>
  )
}

export function voiceKindForSpeaker(speaker = ''): 'man' | 'woman' {
  return /نورة|نوره|female|woman|أنثى|امرأة|المتحدثة/i.test(speaker) ? 'woman' : 'man'
}
