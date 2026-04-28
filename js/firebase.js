import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { initializeFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'

const firebaseConfig = {
  apiKey: "AIzaSyCuABuaZYAVO8Gm2seBn9WPwDCLONlCY34",
  authDomain: "urban-threads-a34b3.firebaseapp.com",
  projectId: "urban-threads-a34b3",
  storageBucket: "urban-threads-a34b3.firebasestorage.app",
  messagingSenderId: "7945800427",
  appId: "1:7945800427:web:8a40bafe86a2cd23d78cae"
};

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

