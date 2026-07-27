import express from 'express'
import path from 'path'
import { createViteServer } from 'vite'
import { createWhatsAppController } from './src/server/whatsapp-controller.mjs'

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
