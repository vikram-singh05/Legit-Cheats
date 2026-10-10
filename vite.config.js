import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import handler from './api/verify-payment.js'
import createOrderHandler from './api/create-order.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env = { ...process.env, ...env }

  return {
    server: {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
    },
    plugins: [
      react(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res) => {
            const path = req.originalUrl || req.url;
            if (path.startsWith('/api/verify-payment') && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  req.body = JSON.parse(body || '{}')
                } catch {
                  req.body = {}
                }
                const mockRes = {
                  setHeader: (k, v) => res.setHeader(k, v),
                  status: (code) => {
                    res.statusCode = code
                    return {
                      json: (data) => {
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify(data))
                      },
                    }
                  },
                }
                await handler(req, mockRes)
              })
            } else if (path.startsWith('/api/create-order') && req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk
              })
              req.on('end', async () => {
                try {
                  req.body = JSON.parse(body || '{}')
                } catch {
                  req.body = {}
                }
                const mockRes = {
                  setHeader: (k, v) => res.setHeader(k, v),
                  status: (code) => {
                    res.statusCode = code
                    return {
                      json: (data) => {
                        res.setHeader('Content-Type', 'application/json')
                        res.end(JSON.stringify(data))
                      },
                    }
                  },
                }
                await createOrderHandler(req, mockRes)
              })
            } else {
              res.statusCode = 405
              res.end('Method Not Allowed')
            }
          })
        },
      },
    ],
  }
})
