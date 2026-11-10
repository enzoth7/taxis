import { defineConfig } from 'vite'
import { createApiHandler } from './server/api.mjs'

function localApi() {
  const handler = createApiHandler()
  const attach = server => {
    server.middlewares.use((request, response, next) => {
      if (!request.url?.startsWith('/api/') && !request.url?.startsWith('/mcp')) return next()
      void handler(request, response)
    })
  }
  return { name: 'taxi-control-local-api', configureServer: attach }
}

export default defineConfig({
  plugins: [localApi()],
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: { host: '127.0.0.1' },
})
