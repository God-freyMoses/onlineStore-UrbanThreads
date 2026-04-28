import { initShell } from '../ui/shell.js'
import { onUserChanged, signIn, signOutUser, signUp } from '../auth.js'
import { qs, toPlainErrorMessage } from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const tabLogin = qs('#tabLogin')
const tabRegister = qs('#tabRegister')
const authTitle = qs('#authTitle')
const authSubtitle = qs('#authSubtitle')
const authForm = qs('#authForm')
const confirmField = qs('#confirmField')
const authSubmit = qs('#authSubmit')
const signOutBtn = qs('#signOutBtn')
const authMessage = qs('#authMessage')

let mode = 'login'

function setMode(next) {
  mode = next
  const isLogin = mode === 'login'
  tabLogin.classList.toggle('is-active', isLogin)
  tabRegister.classList.toggle('is-active', !isLogin)
  tabLogin.setAttribute('aria-selected', isLogin ? 'true' : 'false')
  tabRegister.setAttribute('aria-selected', !isLogin ? 'true' : 'false')
  confirmField.hidden = isLogin
  authTitle.textContent = isLogin ? 'Sign in' : 'Create account'
  authSubtitle.textContent = isLogin ? 'Welcome back. Continue to your account or checkout.' : 'Create an account to save your cart and track orders.'
  authSubmit.textContent = isLogin ? 'Sign in' : 'Create account'
  authMessage.textContent = ''
}

function returnTo() {
  const url = new URL(window.location.href)
  return url.searchParams.get('returnTo') || '/account.html'
}

tabLogin.addEventListener('click', () => setMode('login'))
tabRegister.addEventListener('click', () => setMode('register'))

function friendlyAuthError(err) {
  const code = typeof err?.code === 'string' ? err.code : ''
  if (code === 'auth/configuration-not-found') {
    return (
      'Firebase Auth is not configured for this project. In Firebase Console: Authentication → Get started → Sign-in method → enable Email/Password. ' +
      'Also confirm js/firebase.js matches the same Firebase project and add localhost to Authentication → Settings → Authorized domains.'
    )
  }
  return toPlainErrorMessage(err)
}

signOutBtn.addEventListener('click', async () => {
  await signOutUser()
  toast('Signed out', 'You have been signed out.')
})

authForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const fd = new FormData(authForm)
  const email = String(fd.get('email') || '').trim()
  const password = String(fd.get('password') || '')
  const confirm = String(fd.get('confirmPassword') || '')

  if (!email || !password) {
    authMessage.textContent = 'Enter an email and password.'
    return
  }
  if (mode === 'register') {
    if (password.length < 8) {
      authMessage.textContent = 'Password must be at least 8 characters.'
      return
    }
    if (password !== confirm) {
      authMessage.textContent = 'Passwords do not match.'
      return
    }
  }

  authSubmit.disabled = true
  authMessage.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…'
  try {
    if (mode === 'login') {
      await signIn(email, password)
      toast('Signed in', 'Welcome back.')
    } else {
      await signUp(email, password)
      toast('Account created', 'You are now signed in.')
    }
    window.location.href = returnTo()
  } catch (err) {
    const msg = friendlyAuthError(err)
    authMessage.textContent = msg
    toast('Auth error', msg)
  } finally {
    authSubmit.disabled = false
  }
})

onUserChanged((user) => {
  signOutBtn.hidden = !user
  if (user) authMessage.textContent = `Signed in as ${user.email || 'user'}.`
})

setMode('login')

