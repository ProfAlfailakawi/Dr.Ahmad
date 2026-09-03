import { useEffect, useState } from 'react'
import { WhatsAppAgentPanel } from './admin/WhatsAppAgentPanel'

export interface WhatsAppSupportInboxProps {
  className?: string
}

export function WhatsAppSupportInbox({ className = '' }: WhatsAppSupportInboxProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className={`w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="mb-6 flex items-center justify-between border-b border-hair pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">صندوق دعم واتساب والجسر المحلي</h1>
          <p className="mt-1 text-sm text-soft">
            متابعة حالة الربط المباشر مع واتساب، استلام الرسائل وإدارة الردود الآلية وقواعد الدعم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            LocalAuth Active
          </span>
        </div>
      </div>

      <WhatsAppAgentPanel />
    </div>
  )
}

export default WhatsAppSupportInbox
