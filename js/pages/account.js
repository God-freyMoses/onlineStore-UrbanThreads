import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { initShell } from '../ui/shell.js'
import { db, isFirebaseConfigured } from '../firebase.js'
import { onUserChanged, setDisplayName, signOutUser } from '../auth.js'
import { escapeHtml, formatMoney, qs, toPlainErrorMessage } from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const accountGate = qs('#accountGate')
const accountGateLink = qs('#accountGateLink')
const accountContent = qs('#accountContent')
const acctEmail = qs('#acctEmail')
const acctSignOut = qs('#acctSignOut')
const profileForm = qs('#profileForm')
const profileMessage = qs('#profileMessage')
const addressForm = qs('#addressForm')
const addressMessage = qs('#addressMessage')
const ordersList = qs('#ordersList')
const ordersEmpty = qs('#ordersEmpty')
const orderDialog = qs('#orderDialog')
const orderDialogMeta = qs('#orderDialogMeta')
const orderDialogBody = qs('#orderDialogBody')

let user = null
let userDoc = null

function gate(isAuthed) {
  accountGate.hidden = isAuthed
  accountContent.hidden = !isAuthed
  if (!isAuthed) accountGateLink.href = `/auth.html?returnTo=${encodeURIComponent('/account.html')}`
}

function setFormValue(form, name, value) {
  const el = form.elements.namedItem(name)
  if (el && typeof el.value !== 'undefined') el.value = value ? String(value) : ''
}

async function loadUserDoc(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  userDoc = snap.exists() ? snap.data() : null
  return userDoc
}

function renderProfile() {
  acctEmail.textContent = user?.email || '—'
  setFormValue(profileForm, 'displayName', userDoc?.displayName || user?.displayName || '')

  const addr = userDoc?.defaultAddress || {}
  setFormValue(addressForm, 'fullName', addr.fullName || '')
  setFormValue(addressForm, 'phone', addr.phone || '')
  setFormValue(addressForm, 'line1', addr.line1 || '')
  setFormValue(addressForm, 'line2', addr.line2 || '')
  setFormValue(addressForm, 'city', addr.city || '')
  setFormValue(addressForm, 'state', addr.state || '')
  setFormValue(addressForm, 'postalCode', addr.postalCode || '')
  setFormValue(addressForm, 'country', addr.country || '')
}

function statusTag(status) {
  const s = String(status || 'pending')
  if (s === 'shipped') return `<span class="tag tag--success">shipped</span>`
  if (s === 'cancelled') return `<span class="tag tag--danger">cancelled</span>`
  if (s === 'paid') return `<span class="tag tag--accent">paid</span>`
  return `<span class="tag">pending</span>`
}

function orderDateText(order) {
  const t = order?.createdAt
  const ms = typeof t?.toMillis === 'function' ? t.toMillis() : typeof order?.createdAtMs === 'number' ? order.createdAtMs : 0
  if (!ms) return '—'
  return new Date(ms).toLocaleString()
}

function renderOrderDialog(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const addr = order.shippingAddress || {}
  orderDialogMeta.textContent = `${order.id} • ${orderDateText(order)} • ${order.status || 'pending'}`
  orderDialogBody.innerHTML = `
    <div class="panel panel--soft" style="padding:12px">
      <div style="font-weight:900;margin-bottom:10px">Items</div>
      <div style="display:grid;gap:8px">
        ${items
          .map(
            (it) =>
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                <div>
                  <div style="font-weight:800">${escapeHtml(it.title || 'Item')}</div>
                  <div class="muted" style="font-size:12px">${escapeHtml(it.size || '—')} • Qty ${Number(it.qty || 0)}</div>
                </div>
                <div class="mono">${escapeHtml(formatMoney(Number(it.priceCents || 0)))}</div>
              </div>`,
          )
          .join('')}
      </div>
    </div>
    <div class="panel panel--soft" style="padding:12px">
      <div style="font-weight:900;margin-bottom:10px">Shipping</div>
      <div class="muted" style="line-height:1.45">
        ${escapeHtml(addr.fullName || '')}<br />
        ${escapeHtml(addr.email || '')}${addr.phone ? `<br />${escapeHtml(addr.phone)}` : ''}<br />
        ${escapeHtml(addr.line1 || '')}${addr.line2 ? `<br />${escapeHtml(addr.line2)}` : ''}<br />
        ${escapeHtml(addr.city || '')}${addr.state ? `, ${escapeHtml(addr.state)}` : ''} ${escapeHtml(addr.postalCode || '')}<br />
        ${escapeHtml(addr.country || '')}
      </div>
    </div>
    <div class="panel panel--soft" style="padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div class="muted">Total</div>
        <div style="font-weight:900">${escapeHtml(formatMoney(Number(order.totalCents || 0)))}</div>
      </div>
    </div>
  `
  orderDialog.showModal()
}

function renderOrders(orders) {
  ordersList.innerHTML = ''
  ordersEmpty.hidden = orders.length !== 0
  if (orders.length === 0) return

  for (const o of orders) {
    const row = document.createElement('div')
    row.className = 'orderCard'
    row.innerHTML = `
      <div class="orderCard__meta">
        <div class="orderCard__title">${escapeHtml(o.id)}</div>
        <div class="muted" style="font-size:12px">${escapeHtml(orderDateText(o))}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${statusTag(o.status)}
        <div style="font-weight:900">${escapeHtml(formatMoney(Number(o.totalCents || 0)))}</div>
        <button class="btn btn--secondary" type="button">View</button>
      </div>
    `
    const viewBtn = row.querySelector('button')
    viewBtn.addEventListener('click', () => renderOrderDialog(o))
    ordersList.appendChild(row)
  }
}

async function loadOrders(uid) {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(25))
    const snap = await getDocs(q)
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    renderOrders(orders)
  } catch (e) {
    try {
      const q2 = query(collection(db, 'orders'), where('userId', '==', uid), limit(50))
      const snap2 = await getDocs(q2)
      const orders = snap2.docs
        .map((d) => {
          const data = d.data()
          const createdAtMs = typeof data?.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
          return { id: d.id, ...data, createdAtMs }
        })
        .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
        .slice(0, 25)
      renderOrders(orders)
    } catch (e2) {
      toast('Failed to load orders', toPlainErrorMessage(e2))
      renderOrders([])
    }
  }
}

acctSignOut.addEventListener('click', async () => {
  await signOutUser()
})

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!user) return
  const fd = new FormData(profileForm)
  const displayName = String(fd.get('displayName') || '').trim()
  profileMessage.textContent = 'Saving…'
  try {
    await setDisplayName(displayName)
    await loadUserDoc(user.uid)
    renderProfile()
    profileMessage.textContent = 'Saved.'
    toast('Profile updated', 'Your display name was saved.')
  } catch (err) {
    profileMessage.textContent = toPlainErrorMessage(err)
    toast('Save failed', toPlainErrorMessage(err))
  }
})

addressForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!user) return
  const fd = new FormData(addressForm)
  const payload = {
    fullName: String(fd.get('fullName') || '').trim() || null,
    phone: String(fd.get('phone') || '').trim() || null,
    line1: String(fd.get('line1') || '').trim() || null,
    line2: String(fd.get('line2') || '').trim() || null,
    city: String(fd.get('city') || '').trim() || null,
    state: String(fd.get('state') || '').trim() || null,
    postalCode: String(fd.get('postalCode') || '').trim() || null,
    country: String(fd.get('country') || '').trim() || null,
  }
  addressMessage.textContent = 'Saving…'
  try {
    await setDoc(doc(db, 'users', user.uid), { defaultAddress: payload, updatedAt: serverTimestamp() }, { merge: true })
    await loadUserDoc(user.uid)
    renderProfile()
    addressMessage.textContent = 'Saved.'
    toast('Address updated', 'Default shipping address saved.')
  } catch (err) {
    addressMessage.textContent = toPlainErrorMessage(err)
    toast('Save failed', toPlainErrorMessage(err))
  }
})

onUserChanged(async (u) => {
  user = u
  gate(Boolean(user))
  if (!user) return
  if (!isFirebaseConfigured) {
    toast('Firebase not configured', 'Update js/firebase.js with your Firebase config.')
    return
  }
  profileMessage.textContent = ''
  addressMessage.textContent = ''
  try {
    await loadUserDoc(user.uid)
    renderProfile()
    await loadOrders(user.uid)
  } catch (e) {
    toast('Account error', toPlainErrorMessage(e))
  }
})

