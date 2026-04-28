import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { initShell } from '../ui/shell.js'
import { db, isFirebaseConfigured } from '../firebase.js'
import { onUserChanged, ensureUserDoc } from '../auth.js'
import { cartSubtotalCents, clearCart, getCart, persistCartForUser, removeItem, updateQty } from '../cartStore.js'
import { clampInt, escapeHtml, formatMoney, placeholderImageUrl, qs, toPlainErrorMessage } from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const cartList = qs('#cartList')
const cartEmpty = qs('#cartEmpty')
const subtotalEl = qs('#subtotal')
const shippingEl = qs('#shipping')
const totalEl = qs('#total')
const authGate = qs('#authGate')
const authGateLink = qs('#authGateLink')
const checkoutForm = qs('#checkoutForm')
const placeOrderBtn = qs('#placeOrderBtn')
const checkoutMessage = qs('#checkoutMessage')

let uid = null

function shippingCentsForSubtotal(subtotalCents) {
  if (subtotalCents >= 12000) return 0
  return 799
}

function renderTotals() {
  const subtotal = cartSubtotalCents()
  const ship = shippingCentsForSubtotal(subtotal)
  const total = subtotal + ship
  subtotalEl.textContent = formatMoney(subtotal)
  shippingEl.textContent = ship === 0 ? 'Free' : formatMoney(ship)
  totalEl.textContent = formatMoney(total)
}

function renderCart() {
  const cart = getCart()
  const items = cart.items
  cartList.innerHTML = ''
  renderTotals()
  cartEmpty.hidden = items.length !== 0
  if (items.length === 0) return

  for (const it of items) {
    const row = document.createElement('div')
    row.className = 'cartItem'

    const imgWrap = document.createElement('div')
    imgWrap.className = 'cartItem__img'
    const img = document.createElement('img')
    img.alt = it.title || 'Item'
    img.loading = 'lazy'
    img.src =
      it.imageUrl || placeholderImageUrl(it.title || 'Urban Threads', 800, 600)
    img.addEventListener('error', () => {
      img.src = placeholderImageUrl(it.title || 'Urban Threads', 800, 600)
    })
    imgWrap.appendChild(img)

    const info = document.createElement('div')
    info.className = 'cartItem__info'
    const top = document.createElement('div')
    top.className = 'cartItem__top'
    const meta = document.createElement('div')
    meta.innerHTML = `<div style="font-weight:900">${escapeHtml(it.title || 'Item')}</div><div class="muted" style="font-size:12px;margin-top:3px">Size: ${escapeHtml(it.size || '—')}</div>`
    const price = document.createElement('div')
    price.className = 'price'
    price.textContent = formatMoney(Number(it.priceCents || 0))
    top.appendChild(meta)
    top.appendChild(price)

    const actions = document.createElement('div')
    actions.className = 'cartItem__actions'
    const qty = document.createElement('div')
    qty.className = 'qty'
    const minus = document.createElement('button')
    minus.type = 'button'
    minus.textContent = '−'
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '1'
    input.max = '99'
    input.value = String(clampInt(it.qty, 1, 99))
    const plus = document.createElement('button')
    plus.type = 'button'
    plus.textContent = '+'
    const sync = async (nextQty) => {
      const q = clampInt(nextQty, 1, 99)
      input.value = String(q)
      updateQty(it.productId, it.sku, q)
      renderTotals()
      if (uid) await persistCartForUser(uid)
    }
    minus.addEventListener('click', () => sync(Number(input.value) - 1))
    plus.addEventListener('click', () => sync(Number(input.value) + 1))
    input.addEventListener('change', () => sync(input.value))
    qty.appendChild(minus)
    qty.appendChild(input)
    qty.appendChild(plus)

    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'iconBtn'
    removeBtn.textContent = '×'
    removeBtn.setAttribute('aria-label', 'Remove item')
    removeBtn.addEventListener('click', async () => {
      removeItem(it.productId, it.sku)
      renderCart()
      if (uid) await persistCartForUser(uid)
    })

    actions.appendChild(qty)
    actions.appendChild(removeBtn)

    info.appendChild(top)
    info.appendChild(actions)

    row.appendChild(imgWrap)
    row.appendChild(info)
    cartList.appendChild(row)
  }
}

function gateCheckout(isAuthed) {
  authGate.hidden = isAuthed
  checkoutForm.hidden = !isAuthed
  if (!isAuthed) authGateLink.href = `/auth.html?returnTo=${encodeURIComponent('/cart.html')}`
}

async function prefillFromProfile(user) {
  try {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const data = snap.data()
    const email = user.email || data.email || ''
    const addr = data.defaultAddress || null
    const form = checkoutForm

    const set = (name, value) => {
      const el = form.elements.namedItem(name)
      if (el && typeof el.value !== 'undefined' && !el.value) el.value = String(value || '')
    }

    set('email', email)
    if (addr) {
      set('fullName', addr.fullName)
      set('phone', addr.phone)
      set('line1', addr.line1)
      set('line2', addr.line2)
      set('city', addr.city)
      set('state', addr.state)
      set('postalCode', addr.postalCode)
      set('country', addr.country)
    }
  } catch {
    return
  }
}

async function placeOrder(user) {
  if (!isFirebaseConfigured) {
    toast('Firebase not configured', 'Update js/firebase.js with your Firebase config.')
    return
  }
  const cart = getCart()
  if (cart.items.length === 0) {
    toast('Cart is empty', 'Add items before checking out.')
    return
  }

  const form = checkoutForm
  const get = (name) => {
    const el = form.elements.namedItem(name)
    return el && typeof el.value !== 'undefined' ? String(el.value || '').trim() : ''
  }

  const payload = {
    fullName: get('fullName'),
    email: get('email'),
    phone: get('phone') || null,
    line1: get('line1'),
    line2: get('line2') || null,
    city: get('city'),
    state: get('state') || null,
    postalCode: get('postalCode'),
    country: get('country'),
  }

  const required = ['fullName', 'email', 'line1', 'city', 'postalCode', 'country']
  for (const key of required) {
    if (!payload[key]) {
      toast('Missing info', 'Fill all required shipping fields.')
      const el = form.elements.namedItem(key)
      if (el && typeof el.focus === 'function') el.focus()
      return
    }
  }

  const subtotal = cartSubtotalCents(cart)
  const shippingCents = shippingCentsForSubtotal(subtotal)
  const totalCents = subtotal + shippingCents

  placeOrderBtn.disabled = true
  checkoutMessage.textContent = 'Placing order…'
  try {
    await ensureUserDoc(user)
    const orderRef = await addDoc(collection(db, 'orders'), {
      userId: user.uid,
      items: cart.items,
      subtotalCents: subtotal,
      shippingCents,
      totalCents,
      status: 'pending',
      shippingAddress: payload,
      createdAt: serverTimestamp(),
    })
    await setDoc(doc(db, 'users', user.uid), { defaultAddress: payload, updatedAt: serverTimestamp() }, { merge: true })
    clearCart()
    await persistCartForUser(user.uid)
    renderCart()
    checkoutMessage.textContent = `Order placed: ${orderRef.id}`
    toast('Order placed', `Order ID: ${orderRef.id}`)
  } catch (e) {
    checkoutMessage.textContent = 'Failed to place order.'
    toast('Checkout failed', toPlainErrorMessage(e))
  } finally {
    placeOrderBtn.disabled = false
  }
}

onUserChanged(async (user) => {
  uid = user ? user.uid : null
  gateCheckout(Boolean(user))
  if (user) await prefillFromProfile(user)
})

window.addEventListener('ut:cart_changed', () => {
  renderCart()
})

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const user = await new Promise((resolve) => {
    const unsub = onUserChanged((u) => {
      unsub()
      resolve(u)
    })
  })
  if (!user) {
    gateCheckout(false)
    toast('Sign in required', 'Sign in to place your order.')
    return
  }
  await placeOrder(user)
})

renderCart()

