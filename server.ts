import express from 'express'
import path from 'path'
import { createViteServer } from 'vite'
import { createWhatsAppController } from './src/server/whatsapp-controller.mjs'
import {
  getEncyclopediaTranscriptProgress,
  loadEncyclopediaVideoCatalog,
  loadEncyclopediaVideoMoment,
  scheduleEncyclopediaTranscriptWarmup,
  searchEncyclopediaVideoMoments,
} from './src/server/encyclopedia-videos.mjs'

async function startServer() {
  const app = express()
  const PORT = 3000

  app.use(express.json({ limit: '5mb' }))

  const handleWhatsAppRequest = createWhatsAppController({
    getFirestore: async () => {
      // Return firestore reference if available
      return { db: null }
    },
    verifyAdminRequest: async (req) => {
      const authHeader = req.headers.authorization || ''
      return authHeader.startsWith('Bearer ')
    },
  })

  // WhatsApp Bridge API Proxy
  app.all('/api/whatsapp/*', async (req, res, next) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const handled = await handleWhatsAppRequest(req, res, url, req.method)
      if (!handled && !res.headersSent) next()
    } catch (err) {
      next(err)
    }
  })

  app.all('/api/admin/whatsapp/*', async (req, res, next) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
      const handled = await handleWhatsAppRequest(req, res, url, req.method)
      if (!handled && !res.headersSent) next()
    } catch (err) {
      next(err)
    }
  })

  // Encyclopedia Video API Endpoints
  app.get('/api/encyclopedia/videos', async (req, res) => {
    try {
      const catalog = await loadEncyclopediaVideoCatalog()
      scheduleEncyclopediaTranscriptWarmup(catalog.videos)
      res.setHeader('cache-control', 'public, max-age=1800, stale-while-revalidate=21600')
      res.json({ ...catalog, transcriptIndex: getEncyclopediaTranscriptProgress(catalog.videos) })
    } catch (err) {
      res.status(500).json({ error: (err as Error)?.message || 'Failed to load video catalog' })
    }
  })

  app.get('/api/encyclopedia/video-moment', async (req, res) => {
    try {
      const topic = String(req.query.topic || '').trim().slice(0, 180)
      const videoId = String(req.query.video || '').trim().slice(0, 24)
      const doorNumber = Math.min(Math.max(Number(req.query.door) || 0, 0), 5)
      const hints = Array.isArray(req.query.hint)
        ? req.query.hint.map((v) => String(v || '').trim().slice(0, 120)).filter(Boolean).slice(0, 8)
        : typeof req.query.hint === 'string' && req.query.hint
        ? [req.query.hint.trim().slice(0, 120)]
        : []
      if (!topic && !videoId) {
        res.status(400).json({ error: 'Topic or video is required' })
        return
      }
      if (videoId && !/^[\w-]{6,20}$/.test(videoId)) {
        res.status(400).json({ error: 'Video id is invalid' })
        return
      }
      const moment = await loadEncyclopediaVideoMoment({ topic, doorNumber, videoId, hints })
      if (!moment) {
        res.status(404).json({ error: 'No matching video moment' })
        return
      }
      res.setHeader('cache-control', 'public, max-age=3600, stale-while-revalidate=86400')
      res.json(moment)
    } catch (err) {
      res.status(500).json({ error: (err as Error)?.message || 'Failed to load video moment' })
    }
  })

  app.get('/api/encyclopedia/video-search', async (req, res) => {
    try {
      const query = String(req.query.q || '').trim().slice(0, 180)
      const doorNumber = Math.min(Math.max(Number(req.query.door) || 0, 0), 5)
      const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 10)
      if (query.length < 2) {
        res.status(400).json({ error: 'Search query is too short' })
        return
      }
      const result = await searchEncyclopediaVideoMoments({ query, doorNumber, limit })
      res.setHeader('cache-control', 'public, max-age=1800, stale-while-revalidate=21600')
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: (err as Error)?.message || 'Failed to search video moments' })
    }
  })

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`)
  })
}

startServer()
