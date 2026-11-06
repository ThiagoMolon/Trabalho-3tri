import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxyTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Dev Tunnels (and similar) hit Vite with a public Host header.
    allowedHosts: ['.devtunnels.ms', '.brs.devtunnels.ms'],
    proxy: {
      '/auth': { target: apiProxyTarget, changeOrigin: true },
      '/produtos': { target: apiProxyTarget, changeOrigin: true },
      '^/quiz/(perguntas|resultado|admin)(/|$)': { target: apiProxyTarget, changeOrigin: true },
      '/planos': { target: apiProxyTarget, changeOrigin: true },
      '/assinaturas': { target: apiProxyTarget, changeOrigin: true },
      '/health': { target: apiProxyTarget, changeOrigin: true },
    },
  },
})
