import { useEffect, useRef, useState } from 'react'
import {
  getAdminTaskState,
  subscribeAdminTaskState,
  type AdminTaskDetail,
} from '../../lib/admin-task-state'

const STATUS_COLOR: Record<Exclude<AdminTaskDetail['status'], 'idle'>, string> = {
  working: '#2f6da3',
  'needs-input': '#c27b25',
  completed: '#2f8b61',
  error: '#c27b25',
}

const STATUS_LABEL: Record<Exclude<AdminTaskDetail['status'], 'idle'>, string> = {
  working: 'جارٍ التنفيذ',
  'needs-input': 'يحتاج تدخلك',
  completed: 'اكتمل',
  error: 'يحتاج تدخلك',
}

export function AdminTaskFavicon() {
  const [task, setTask] = useState<AdminTaskDetail>(() => getAdminTaskState())
  const phase = useRef(0)
  const originalHref = useRef<string | null>(null)

  useEffect(() => subscribeAdminTaskState(setTask), [])

  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    const link = existing || Object.assign(document.createElement('link'), { rel: 'icon' })
    if (!existing) document.head.appendChild(link)
    if (!originalHref.current || originalHref.current.startsWith('data:')) {
      originalHref.current = link.getAttribute('href') || '/favicon.png'
    }

    if (task.status === 'idle') {
      link.href = originalHref.current || '/favicon.png'
      return () => undefined
    }

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return () => undefined

    let cancelled = false
    let timer = 0
    const image = new Image()
    image.decoding = 'async'
    image.src = '/favicon.png'

    const draw = () => {
      if (cancelled || !image.complete) return
      ctx.clearRect(0, 0, 64, 64)
      ctx.drawImage(image, 4, 4, 56, 56)

      const color = STATUS_COLOR[task.status]
      ctx.save()
      const pulse = task.status === 'working' ? (Math.sin(phase.current) + 1) / 2 : 0
      const x = 48
      const y = 16
      const radius = task.status === 'working' ? 9.5 + pulse * 1.8 : 10
      if (task.status === 'working') {
        ctx.beginPath()
        ctx.arc(x, y, radius + 6 + pulse * 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(47, 109, 163, ${0.16 + pulse * 0.12})`
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(x, y, radius + 2.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, .96)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, .96)'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.restore()

      link.href = canvas.toDataURL('image/png')
    }

    const start = () => {
      draw()
      if (task.status !== 'working') return
      timer = window.setInterval(() => {
        phase.current = (phase.current + 0.55) % (Math.PI * 2)
        draw()
      }, 180)
    }

    if (image.complete) start()
    else image.addEventListener('load', start, { once: true })

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      image.removeEventListener('load', start)
      link.href = originalHref.current || '/favicon.png'
    }
  }, [task.status, task.changedAt])

  return null
}

export function AdminTaskIndicator() {
  const [task, setTask] = useState<AdminTaskDetail>(() => getAdminTaskState())

  useEffect(() => subscribeAdminTaskState(setTask), [])

  if (task.status === 'idle') return null

  const label = STATUS_LABEL[task.status]
  const color =
    task.status === 'completed'
      ? 'bg-emerald-500'
      : task.status === 'working'
        ? 'bg-accent'
        : 'bg-amber-500'

  return (
    <div
      className="inline-flex h-10 items-center gap-2 rounded-full border border-hair bg-canvas/85 px-3 text-[.72rem] font-semibold text-soft shadow-sm backdrop-blur-md"
      role="status"
      aria-live="polite"
      title={task.label || label}
    >
      <span className={`h-2 w-2 rounded-full ${color} ${task.status === 'working' ? 'animate-pulse' : ''}`} aria-hidden />
      <span>{label}</span>
    </div>
  )
}
