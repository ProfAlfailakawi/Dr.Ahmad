import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function encyclopediaApiPlugin(): Plugin {
  return {
    name: 'encyclopedia-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/encyclopedia/')) return next()
        try {
          const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
          const { loadEncyclopediaVideoCatalog, loadEncyclopediaVideoMoment, searchEncyclopediaVideoMoments, getEncyclopediaTranscriptProgress } = await import('./src/server/encyclopedia-videos.mjs')

          if (url.pathname === '/api/encyclopedia/videos') {
            const catalog = await loadEncyclopediaVideoCatalog()
            const payload = JSON.stringify({ ...catalog, transcriptIndex: getEncyclopediaTranscriptProgress(catalog.videos) })
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(payload)
            return
          }
          if (url.pathname === '/api/encyclopedia/video-moment') {
            const topic = String(url.searchParams.get('topic') || '').trim().slice(0, 180)
            const videoId = String(url.searchParams.get('video') || '').trim().slice(0, 24)
            const doorNumber = Math.max(0, Math.min(5, Number(url.searchParams.get('door')) || 0))
            const hints = url.searchParams.getAll('hint').slice(0, 8).map((v) => String(v || '').trim().slice(0, 120)).filter(Boolean)
            const moment = await loadEncyclopediaVideoMoment({ topic, doorNumber, videoId, hints })
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = moment ? 200 : 404
            res.end(JSON.stringify(moment || { error: 'No matching video moment' }))
            return
          }
          if (url.pathname === '/api/encyclopedia/video-search') {
            const query = String(url.searchParams.get('q') || '').trim().slice(0, 180)
            const doorNumber = Math.max(0, Math.min(5, Number(url.searchParams.get('door')) || 0))
            const limit = Math.max(1, Math.min(10, Number(url.searchParams.get('limit')) || 6))
            const result = await searchEncyclopediaVideoMoments({ query, doorNumber, limit })
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(result))
            return
          }
          next()
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), encyclopediaApiPlugin()],
  server: {
    /* ٣٠٠٠ هو المنفذ الوحيد المسموح بالاتصال به خارجياً في بيئة AI Studio. */
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
  },
  /* الملفات الضخمة (المتون، مقاطع الكتب، تفريغات الأرشيف) تُخبَّأ نصّاً وتُفكّ بـJSON.parse
     بدل أن تُترجَم كائناتٍ حرفية في الحزمة: المحرّك يقرأها أسرع بمرّتين إلى ثلاث،
     والناتج نفسه حرفاً بحرف. لا استيراد مسمّى من أي ملف JSON في المشروع فلا شيء ينكسر. */
  json: { stringify: true },
  build: {
    rollupOptions: {
      output: {
        // تقسيم الحزم: المكتبات الثابتة تُخزَّن مؤقتاً في المتصفح
        // وتحديثات الموقع لا تعيد تنزيلها
        manualChunks(id) {
          if (id.includes('/src/data/private-book-links.json')) return 'admin-private-memory'
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'vendor-firebase'
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-router')) return 'vendor-react'
        },
      },
    },
  },
})
