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
  error: '#aa4b4b',
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export function AdminTaskFavicon() {
  const [task, setTask] = useState<AdminTaskDetail>(() => getAdminTaskState())
  const phase = useRef(0)

  useEffect(() => subscribeAdminTaskState(setTask), [])

  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    const link = existing || Object.assign(document.createElement('link'), { rel: 'icon' })
    if (!existing) document.head.appendChild(link)
    const originalHref = link.getAttribute('href') || '/favicon.png'

    if (task.status === 'idle') {
      link.href = originalHref
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
      ctx.drawImage(image, 5, 5, 54, 54)

      const color = STATUS_COLOR[task.status]
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = task.status === 'working' ? 4.5 : 5
      ctx.lineCap = 'round'
      if (task.status === 'working') {
        ctx.setLineDash([14, 8])
        ctx.lineDashOffset = -phase.current
      }
      roundRect(ctx, 2.5, 2.5, 59, 59, 13)
      ctx.stroke()
      ctx.restore()

      link.href = canvas.toDataURL('image/png')
    }

    const start = () => {
      draw()
      if (task.status !== 'working') return
      timer = window.setInterval(() => {
        phase.current = (phase.current + 3) % 44
        draw()
      }, 240)
    }

    if (image.complete) start()
    else image.addEventListener('load', start, { once: true })

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      image.removeEventListener('load', start)
      link.href = originalHref
    }
  }, [task.status, task.changedAt])

  return null
}
