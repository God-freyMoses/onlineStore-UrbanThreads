import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { auth, db } from './firebase.js'

export function onUserChanged(cb) {
  return onAuthStateChanged(auth, cb)
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  await ensureUserDoc(cred.user)
  return cred.user
}

export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await ensureUserDoc(cred.user)
  return cred.user
}

export async function signOutUser() {
  await signOut(auth)
}

export async function ensureUserDoc(user) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data()
  const payload = {
    email: user.email || null,
    displayName: user.displayName || null,
    isAdmin: false,
    defaultAddress: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, payload)
  return payload
}

export async function setDisplayName(name) {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  await updateProfile(user, { displayName: name || null })
  const ref = doc(db, 'users', user.uid)
  await setDoc(ref, { displayName: name || null, updatedAt: serverTimestamp() }, { merge: true })
}

