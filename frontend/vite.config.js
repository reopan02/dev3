import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function loadBackendEnv() {
  const envPath = path.resolve(__dirname, '../.env')

  if (!fs.existsSync(envPath)) {
    return {}
  }

  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf-8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const [key, ...rest] = line.split('=')
        const value = rest.join('=').trim().replace(/^['"]|['"]$/g, '')
        return [key.trim(), value]
      })
  )
}

const backendEnv = loadBackendEnv()
const backendHost = backendEnv.HOST || '127.0.0.1'
const backendPort = backendEnv.PORT || '8000'
const proxyHost = backendHost === '0.0.0.0' ? '127.0.0.1' : backendHost
const backendTarget = `http://${proxyHost}:${backendPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/app-config.js': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
    rollupOptions: {
      external: (id) => id === '/app-config.js'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
