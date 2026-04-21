import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const manualChunks = (id) => {
    if (!id.includes('node_modules')) return undefined

    if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/')) return 'react-core'
    if (id.includes('@supabase') || id.includes('@tanstack/react-query')) return 'data-core'
    if (id.includes('framer-motion')) return 'motion'
    if (id.includes('@radix-ui')) return 'radix-ui'
    if (id.includes('react-leaflet') || id.includes('/leaflet/')) return 'maps'
    if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('qrcode')) return 'capture-share'
    if (id.includes('recharts')) return 'charts'
    if (id.includes('canvas-confetti')) return 'celebration'
    if (id.includes('three')) return 'three-core'
    return undefined
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
    },
    // Bridge: les vars Vercel n'ont plus le préfixe VITE_ (sécurité),
    // on les ré-expose explicitement pour le client React.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
    },
  }
})
