import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const root = process.cwd()

const contentTypeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function safePathnameToFilePath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname)
  const rel = decoded === '/' ? '/index.html' : decoded
  const resolved = path.resolve(root, '.' + rel)
  if (!resolved.startsWith(root)) return null
  return resolved
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', 'http://localhost')
    const filePath = safePathnameToFilePath(reqUrl.pathname)
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Bad request')
      return
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = contentTypeByExt[ext] || 'application/octet-stream'
    const body = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(body)
  } catch (e) {
    const notFound = typeof e?.code === 'string' && e.code === 'ENOENT'
    res.writeHead(notFound ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(notFound ? 'Not found' : 'Server error')
  }
})

const basePort = Number(process.env.PORT || 5173)
const maxTries = 15

async function listenOnPort(port) {
  await new Promise((resolve, reject) => {
    const onError = (e) => {
      cleanup()
      reject(e)
    }
    const onListening = () => {
      cleanup()
      resolve()
    }
    const cleanup = () => {
      server.off('error', onError)
      server.off('listening', onListening)
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port)
  })
}

async function start() {
  for (let i = 0; i <= maxTries; i++) {
    const port = basePort + i
    try {
      await listenOnPort(port)
      process.stdout.write('Urban Threads dev server\n')
      process.stdout.write(`- Root: ${root}\n`)
      process.stdout.write(`- URL: http://localhost:${port}/\n`)
      return
    } catch (e) {
      if (e && e.code === 'EADDRINUSE') continue
      throw e
    }
  }
  throw new Error(`No available port found from ${basePort} to ${basePort + maxTries}.`)
}

start()

