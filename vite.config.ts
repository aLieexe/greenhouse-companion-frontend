import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target =
    env.VITE_API_BASE_URL || 'https://greenhouse-be.alieexe.my.id'

  return {
    plugins: [
      vue(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/auth': { target, changeOrigin: true },
        '/devices': { target, changeOrigin: true, ws: true },
        '/me': { target, changeOrigin: true },
      },
    },
  }
})
