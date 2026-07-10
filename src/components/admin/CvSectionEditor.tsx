import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  cvSectionLabels,
  type CvItem,
  type CvSectionKey,
  type SaveCvSection,
} from '../../lib/cv'

type FieldKey = 'text' | 'degree' | 'org' | 'note' | 'role' | 'items' | 'title' | 'place'
type Field = { key: FieldKey; label: string; required?: boolean; multiline?: boolean; hint?: string }

const fieldsBySection: Record<CvSectionKey, Field[]> = {
  education: [
    { key: 'degree', label: 'الدرجة والتخصص', required: true },
    { key: 'org', label: 'الجامعة أو الجهة', required: true },
    { key: 'note', label: 'ملاحظة', hint: 'مثال: بامتياز مع مرتبة الشرف' },
  ],
  teaching: [
    { key: 'role', label: 'الصفة أو المنصب', required: true },
    { key: 'org', label: 'الجهة', required: true },
  ],
  work: [
    { key: 'role', label: 'الصفة أو المنصب', required: true },
    { key: 'org', label: 'الجهة', required: true },
    { key: 'items', label: 'تفاصيل إضافية', multiline: true, hint: 'اكتب كل تفصيل في سطر مستقل.' },
  ],
  committees: [{ key: 'text', label: 'اللجنة أو العضوية', required: true, multiline: true }],
  memberships: [{ key: 'text', label: 'العضوية الدولية', required: true, multiline: true }],
  conferences: [
    { key: 'title', label: 'اسم المؤتمر أو الزيارة', required: true },
    { key: 'place', label: 'المكان', required: true },
  ],
  workshops: [{ key: 'text', label: 'اسم الورشة أو المحاضرة', required: true, multiline: true }],
  certifications: [{ key: 'text', label: 'الشهادة أو الدورة', required: true, multiline: true }],
  skills: [{ key: 'text', label: 'المهارة', required: true }],
}

const inputClass = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.94rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'

const cloneItems = (items: readonly CvItem[]): CvItem[] => items.map((item) => {
  if ('items' in item) return { ...item, items: [...item.items] }
  return { ...item }
})

const newId = (section: CvSectionKey) => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `new:${section}:${random}`
}

const emptyItem = (section: CvSectionKey): CvItem => {
  const id = newId(section)
  switch (section) {
    case 'education': return { id, degree: '', org: '', note: '' }
    case 'teaching': return { id, role: '', org: '' }
    case 'work': return { id, role: '', org: '', items: [] }
    case 'conferences': return { id, title: '', place: '' }
    default: return { id, text: '' }
  }
}

const editableRecord = (item: CvItem) => item as unknown as Record<string, unknown>

const fieldValue = (item: CvItem, key: FieldKey) => {
  const value = editableRecord(item)[key]
  if (key === 'items') return Array.isArray(value) ? value.join('\n') : ''
  return typeof value === 'string' ? value : ''
}

type Props = {
  section: CvSectionKey
  items: readonly CvItem[]
  isAdmin: boolean
  onSave: SaveCvSection
  children: ReactNode
}

export function CvSectionEditor({ section, items, isAdmin, onSave, children }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CvItem[]>(() => cloneItems(items))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fields = fieldsBySection[section]
  const label = cvSectionLabels[section]

  useEffect(() => {
    if (!editing) setDraft(cloneItems(items))
  }, [editing, items])

  const invalid = useMemo(() => draft.some((item) => fields.some((field) => (
    field.required && !fieldValue(item, field.key).trim()
  ))), [draft, fields])

  if (!isAdmin) return <>{children}</>

  const startEditing = () => {
    setDraft(cloneItems(items))
    setError('')
    setEditing(true)
  }

  const cancel = () => {
    setDraft(cloneItems(items))
    setError('')
    setEditing(false)
  }

  const change = (index: number, key: FieldKey, value: string) => {
    setDraft((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item
      const next = { ...item } as unknown as Record<string, unknown>
      next[key] = key === 'items' ? value.split('\n') : value
      return next as unknown as CvItem
    }))
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.length) return
    setDraft((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const save = async () => {
    if (invalid || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(section, draft)
      setEditing(false)
    } catch {
      setError('تعذّر الحفظ. تحقق من الاتصال ثم حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-2 text-[.82rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
            aria-label={`تحرير قسم ${label}`}
          >
            <span aria-hidden="true">✎</span>
            <span>تحرير {label}</span>
          </button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <section className="my-4 rounded-2xl border border-accent/40 bg-wash p-4 sm:p-6" aria-label={`محرر قسم ${label}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase tracking-[.1em] text-accent">تحرير موضعي</p>
          <h3 className="mt-1 font-display text-[1.25rem] font-semibold text-ink">{label}</h3>
          <p className="mt-1 text-[.82rem] text-soft">رتّب البنود وعدّلها، ثم اضغط «حفظ القسم».</p>
        </div>
        <button type="button" onClick={cancel} disabled={busy} className="rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
          إلغاء
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {draft.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-hair bg-canvas p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hair pb-3">
              <span className="text-[.8rem] font-semibold text-soft">البند {index + 1}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0 || busy} aria-label={`رفع البند ${index + 1}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === draft.length - 1 || busy} aria-label={`خفض البند ${index + 1}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-30">↓</button>
                <button type="button" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={busy} className="min-h-9 rounded-full border border-hair px-3 text-[.78rem] text-soft transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-50">
                  حذف
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const value = fieldValue(item, field.key)
                const common = {
                  value,
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(index, field.key, event.target.value),
                  placeholder: field.hint,
                  'aria-label': field.label,
                }
                return (
                  <label key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
                    <span className="mb-1.5 block text-[.8rem] font-semibold text-ink">
                      {field.label}{field.required && <span className="ms-1 text-accent">*</span>}
                    </span>
                    {field.multiline ? (
                      <textarea {...common} rows={field.key === 'items' ? 4 : 2} className={`${inputClass} resize-y leading-relaxed`} />
                    ) : (
                      <input {...common} type="text" className={inputClass} />
                    )}
                    {field.hint && <span className="mt-1 block text-[.72rem] text-soft">{field.hint}</span>}
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        {draft.length === 0 && (
          <div className="rounded-xl border border-dashed border-hair bg-canvas p-6 text-center text-[.88rem] text-soft">
            لا توجد بنود في هذا القسم. يمكنك إضافة أول بند الآن.
          </div>
        )}
      </div>

      <button type="button" onClick={() => setDraft((current) => [...current, emptyItem(section)])} disabled={busy} className="mt-4 rounded-full border border-accent px-5 py-2.5 text-[.84rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50">
        + إضافة بند جديد
      </button>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hair pt-5">
        <button type="button" onClick={save} disabled={busy || invalid} className="rounded-full bg-accent px-7 py-2.5 font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-40">
          {busy ? 'جارٍ الحفظ…' : 'حفظ القسم'}
        </button>
        <button type="button" onClick={cancel} disabled={busy} className="rounded-full border border-hair px-5 py-2.5 text-[.86rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
          تجاهل التغييرات
        </button>
        {invalid && <span className="text-[.78rem] text-soft">أكمل الحقول المعلّمة بنجمة.</span>}
        {error && <span role="alert" className="text-[.8rem] text-red-600">{error}</span>}
      </div>
    </section>
  )
}
