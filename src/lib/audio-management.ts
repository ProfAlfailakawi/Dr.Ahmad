type TokenUser = { getIdToken: (forceRefresh?: boolean) => Promise<string> }

export type ArticleAudioMode = 'reading' | 'dialogue'
export type ArticleAudioAction = 'clear' | 'regenerate'

export type ArticleAudioManageResult = {
  ok: boolean
  mode: ArticleAudioMode
  action: ArticleAudioAction
  workflow?: string
  requestId?: string
  message?: string
}

async function payload(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function manageArticleAudio({
  user,
  slug,
  mode,
  action,
}: {
  user: TokenUser | null
  slug: string
  mode: ArticleAudioMode
  action: ArticleAudioAction
}): Promise<ArticleAudioManageResult> {
  if (!user) throw new Error('انتهت جلسة المشرف؛ سجّل الدخول من جديد.')
  const token = await user.getIdToken(true)
  const response = await fetch('/api/admin/audio/manage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ slug, mode, action }),
  })
  const data = await payload(response)
  if (!response.ok) {
    const detail = String(data.detail || data.error || '').trim()
    throw new Error(detail || 'تعذّر تنفيذ أمر الصوت من لوحة التحكم.')
  }
  return {
    ok: data.ok === true,
    mode,
    action,
    workflow: typeof data.workflow === 'string' ? data.workflow : undefined,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
  }
}
