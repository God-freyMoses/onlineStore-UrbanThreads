import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

function readFirebaseConfig() {
  const fromWindow = globalThis?.__FIREBASE_CONFIG__
  if (fromWindow && typeof fromWindow === 'object') return fromWindow

  try {
    const raw = localStorage.getItem('ut_firebase_config')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    return null
  }
  return null
}

const firebaseConfig =
  readFirebaseConfig() || {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  }

export const isFirebaseConfigured = Object.values(firebaseConfig).every((v) => {
  const s = String(v || '').trim()
  return s.length > 0 && !s.includes('YOUR_')
})

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})

