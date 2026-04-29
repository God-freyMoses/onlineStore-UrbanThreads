import fs from 'node:fs/promises'
import path from 'node:path'

function env(name) {
  return String(process.env[name] || '').trim()
}

const cfg = {
  apiKey: env('FIREBASE_API_KEY'),
  authDomain: env('FIREBASE_AUTH_DOMAIN'),
  projectId: env('FIREBASE_PROJECT_ID'),
  storageBucket: env('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('FIREBASE_APP_ID'),
}

const missing = Object.entries(cfg)
  .filter(([, v]) => !v)
  .map(([k]) => k)

const outFile = path.join(process.cwd(), 'js', 'runtime-config.generated.js')

if (missing.length > 0) {
  await fs.writeFile(outFile, 'globalThis.__FIREBASE_CONFIG__ = null\n', 'utf8')
  console.log(`Firebase config not generated. Missing: ${missing.join(', ')}`)
} else {
  const js = `globalThis.__FIREBASE_CONFIG__ = ${JSON.stringify(cfg, null, 2)}\n`
  await fs.writeFile(outFile, js, 'utf8')
  console.log('Firebase config generated.')
}
