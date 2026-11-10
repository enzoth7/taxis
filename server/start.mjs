import http from 'node:http'
import { createApiHandler } from './api.mjs'

const port = Number(process.env.PORT || 8787)
http.createServer(createApiHandler()).listen(port, '127.0.0.1', () => {
  console.log(`API local: http://127.0.0.1:${port}`)
})
