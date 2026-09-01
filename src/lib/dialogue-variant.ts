export type DialogueAudioVariant = 'standard' | 'kuwaiti'

const KEY = 'dialogue-audio-variant-v1'

export function dialogueVariantPreference(): DialogueAudioVariant {
  if (typeof window === 'undefined') return 'kuwaiti'
  try { return window.localStorage.getItem(KEY) === 'standard' ? 'standard' : 'kuwaiti' }
  catch { return 'kuwaiti' }
}

export function rememberDialogueVariant(variant: DialogueAudioVariant) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY, variant) } catch { /* تفضيل اختياري */ }
}

export const dialogueVariantKey = (variant: DialogueAudioVariant) => variant === 'kuwaiti' ? 'dialogue-kuwaiti' : 'dialogue'
export const dialogueVariantSuffix = (variant: DialogueAudioVariant) => variant === 'kuwaiti' ? '.dialogue-kw' : '.dialogue'
