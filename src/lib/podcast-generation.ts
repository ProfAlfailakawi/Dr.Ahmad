type TokenUser = { getIdToken: (forceRefresh?: boolean) => Promise<string> }

type DialogueProof = {
  contentSha256: string
  revisionSha256: string
  revisionId: string
  turnCount: number
}

export type PodcastGenerationVariant = 'standard' | 'kuwaiti'

type DispatchResult = {
  ok: boolean
  duplicate?: boolean
  workflowRunId?: number | string
  workflowRunUrl?: string
  message?: string
}

async function responsePayload(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * يبدأ GitHub Actions من خادم الموقع بعد التحقق من Firebase admin.
 * لا يصل رمز GitHub إلى المتصفح إطلاقاً.
 */
export async function dispatchPodcastGeneration({
  user,
  slug,
  proof,
  variant = 'standard',
  regenerate = false,
}: {
  user: TokenUser | null
  slug: string
  proof: DialogueProof
  variant?: PodcastGenerationVariant
  /* إعادة توليدٍ فوق مرشّحٍ ينتظر الاعتماد — طلبٌ صريح من المشرف لا افتراض. */
  regenerate?: boolean
}): Promise<DispatchResult> {
  if (!user) throw new Error('انتهت جلسة المشرف؛ سجّل الدخول من جديد.')
  const token = await user.getIdToken(true)
  const response = await fetch('/api/admin/podcast/dispatch', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      slug,
      expectedDialogueContentSha256: proof.contentSha256,
      expectedDialogueRevisionSha256: proof.revisionSha256,
      expectedDialogueRevisionId: proof.revisionId,
      expectedTurnCount: proof.turnCount,
      variant,
      regenerate,
    }),
  })
  const payload = await responsePayload(response)
  if (!response.ok) {
    const detail = String(payload.detail || payload.error || '').trim()
    throw new Error(detail || 'تعذّر بدء التوليد الآلي من لوحة التحكم.')
  }
  return {
    ok: payload.ok === true,
    duplicate: payload.duplicate === true,
    workflowRunId: typeof payload.workflowRunId === 'number' || typeof payload.workflowRunId === 'string' ? payload.workflowRunId : undefined,
    workflowRunUrl: typeof payload.workflowRunUrl === 'string' ? payload.workflowRunUrl : undefined,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  }
}

export async function approveKuwaitiPodcastCandidate({
  user,
  slug,
  revisionId,
}: {
  user: TokenUser | null
  slug: string
  revisionId: string
}): Promise<DispatchResult> {
  if (!user) throw new Error('انتهت جلسة المشرف؛ سجّل الدخول من جديد.')
  const token = await user.getIdToken(true)
  const response = await fetch('/api/admin/podcast/approve-kuwaiti', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ slug, revisionId }),
  })
  const payload = await responsePayload(response)
  if (!response.ok) {
    const detail = String(payload.detail || payload.error || '').trim()
    throw new Error(detail || 'تعذّر اعتماد النسخة الكويتية للنشر.')
  }
  return {
    ok: payload.ok === true,
    duplicate: payload.duplicate === true,
    message: typeof payload.message === 'string' ? payload.message : undefined,
  }
}

