import { ensureUserDoc, onUserChanged, signOutUser } from '../auth.js'
import { cartCount, loadCartForUser, persistCartForUser } from '../cartStore.js'
import { qs } from '../utils.js'

function navItem(href, label) {
  const a = document.createElement('a')
  a.href = href
  a.textContent = label
  if (window.location.pathname === href) a.classList.add('is-active')
  return a
}

function renderShell() {
  const root = qs('#app-shell')
  root.innerHTML = ''

  const top = document.createElement('header')
  top.className = 'topbar'

  const inner = document.createElement('div')
  inner.className = 'topbar__inner'

  const brand = document.createElement('a')
  brand.href = '/index.html'
  brand.className = 'brand'
  brand.innerHTML = '<span class="brandMark" aria-hidden="true"></span><span>Urban Threads</span>'

  const nav = document.createElement('nav')
  nav.className = 'nav'
  nav.appendChild(navItem('/index.html', 'Shop'))
  nav.appendChild(navItem('/cart.html', 'Cart'))
  nav.appendChild(navItem('/account.html', 'Account'))

  const right = document.createElement('div')
  right.className = 'navRight'

  const authLink = document.createElement('a')
  authLink.href = `/auth.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`
  authLink.textContent = 'Sign in'
  authLink.className = 'btn btn--secondary'

  const signOutBtn = document.createElement('button')
  signOutBtn.type = 'button'
  signOutBtn.textContent = 'Sign out'
  signOutBtn.className = 'btn btn--secondary'
  signOutBtn.hidden = true
  signOutBtn.addEventListener('click', async () => {
    await signOutUser()
  })

  const cartLink = document.createElement('a')
  cartLink.href = '/cart.html'
  cartLink.className = 'btn btn--secondary'
  cartLink.innerHTML = `<span>Cart</span> <span id="ut-cart-badge" class="cartBadge">0</span>`

  right.appendChild(cartLink)
  right.appendChild(authLink)
  right.appendChild(signOutBtn)

  inner.appendChild(brand)
  inner.appendChild(nav)
  inner.appendChild(right)
  top.appendChild(inner)
  root.appendChild(top)

  const updateBadge = () => {
    const badge = document.getElementById('ut-cart-badge')
    if (badge) badge.textContent = String(cartCount())
  }

  updateBadge()
  window.addEventListener('ut:cart_changed', updateBadge)

  let currentUid = null
  let persistTimer = 0
  const schedulePersist = () => {
    if (!currentUid) return
    window.clearTimeout(persistTimer)
    persistTimer = window.setTimeout(async () => {
      try {
        await persistCartForUser(currentUid)
      } catch {
        return
      }
    }, 250)
  }

  window.addEventListener('ut:cart_changed', schedulePersist)

  onUserChanged(async (user) => {
    authLink.hidden = Boolean(user)
    signOutBtn.hidden = !user
    currentUid = user ? user.uid : null
    if (user) {
      try {
        await ensureUserDoc(user)
        await loadCartForUser(user.uid)
      } catch {
        return
      } finally {
        updateBadge()
      }
    }
  })
}

export function initShell() {
  renderShell()
}

