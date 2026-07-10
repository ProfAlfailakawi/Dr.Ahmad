import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // تقسيم الحزم: المكتبات الثابتة تُخزَّن مؤقتاً في المتصفح
        // وتحديثات الموقع لا تعيد تنزيلها
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'vendor-firebase'
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-router-dom')) return 'vendor-react'
        },
      },
    },
  },
})
