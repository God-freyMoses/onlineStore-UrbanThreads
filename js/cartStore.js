import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { db } from './firebase.js'
import { clampInt } from './utils.js'

const KEY = 'ut_cart_v1'

function readLocal() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return { items: [] }
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] }
    return { items: parsed.items }
  } catch {
    return { items: [] }
  }
}

function writeLocal(cart) {
  window.localStorage.setItem(KEY, JSON.stringify({ items: cart.items }))
  window.dispatchEvent(new CustomEvent('ut:cart_changed'))
}

export function getCart() {
  return readLocal()
}

export function cartCount(cart = readLocal()) {
  return cart.items.reduce((sum, it) => sum + Number(it.qty || 0), 0)
}

export function cartSubtotalCents(cart = readLocal()) {
  return cart.items.reduce((sum, it) => sum + Number(it.priceCents || 0) * Number(it.qty || 0), 0)
}

export function setCartItems(items) {
  writeLocal({ items: Array.isArray(items) ? items : [] })
}

export function addToCart(item, qty = 1) {
  const cart = readLocal()
  const safeQty = clampInt(qty, 1, 99)
  const idx = cart.items.findIndex((x) => x.productId === item.productId && x.sku === item.sku)
  if (idx >= 0) {
    cart.items[idx] = { ...cart.items[idx], qty: clampInt(cart.items[idx].qty + safeQty, 1, 99) }
  } else {
    cart.items.push({ ...item, qty: safeQty })
  }
  writeLocal(cart)
}

export function updateQty(productId, sku, qty) {
  const cart = readLocal()
  const safeQty = clampInt(qty, 1, 99)
  cart.items = cart.items.map((it) => {
    if (it.productId === productId && it.sku === sku) return { ...it, qty: safeQty }
    return it
  })
  writeLocal(cart)
}

export function removeItem(productId, sku) {
  const cart = readLocal()
  cart.items = cart.items.filter((it) => !(it.productId === productId && it.sku === sku))
  writeLocal(cart)
}

export function clearCart() {
  writeLocal({ items: [] })
}

export async function persistCartForUser(uid) {
  const cart = readLocal()
  const ref = doc(db, 'carts', uid)
  await setDoc(ref, { items: cart.items, updatedAt: serverTimestamp() }, { merge: true })
}

export async function loadCartForUser(uid) {
  const ref = doc(db, 'carts', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await persistCartForUser(uid)
    return readLocal()
  }
  const data = snap.data()
  const remoteItems = Array.isArray(data?.items) ? data.items : []
  if (remoteItems.length > 0) setCartItems(remoteItems)
  else await persistCartForUser(uid)
  return readLocal()
}

