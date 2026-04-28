import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { initShell } from '../ui/shell.js'
import { app, db, isFirebaseConfigured } from '../firebase.js'
import { ensureUserDoc, onUserChanged } from '../auth.js'
import { escapeHtml, formatMoney, placeholderImageUrl, qs, toPlainErrorMessage } from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const adminGate = qs('#adminGate')
const adminContent = qs('#adminContent')
const adminProjectId = qs('#adminProjectId')
const adminEmail = qs('#adminEmail')
const adminUid = qs('#adminUid')
const adminIsAdmin = qs('#adminIsAdmin')
const adminRecheckBtn = qs('#adminRecheckBtn')

const tabProducts = qs('#tabProducts')
const tabOrders = qs('#tabOrders')
const productsPanel = qs('#productsPanel')
const ordersPanel = qs('#ordersPanel')

const productSearch = qs('#productSearch')
const newProductBtn = qs('#newProductBtn')
const seedBtn = qs('#seedBtn')
const importFakeStoreBtn = qs('#importFakeStoreBtn')
const repairImagesBtn = qs('#repairImagesBtn')
const productsTbody = qs('#productsTbody')

const productFormTitle = qs('#productFormTitle')
const productForm = qs('#productForm')
const imagesList = qs('#imagesList')
const variantsList = qs('#variantsList')
const addImageBtn = qs('#addImageBtn')
const addVariantBtn = qs('#addVariantBtn')
const deleteProductBtn = qs('#deleteProductBtn')
const productMessage = qs('#productMessage')

const ordersTbody = qs('#ordersTbody')
const adminOrderDialog = qs('#adminOrderDialog')
const adminOrderMeta = qs('#adminOrderMeta')
const adminOrderBody = qs('#adminOrderBody')

let currentUser = null
let products = []
let orders = []
let editingProductId = null

function renderGateInfo(user, status) {
  adminProjectId.textContent = String(app?.options?.projectId || '—')
  adminEmail.textContent = String(user?.email || '—')
  adminUid.textContent = String(user?.uid || '—')
  if (!status) {
    adminIsAdmin.textContent = '—'
    return
  }
  adminIsAdmin.textContent = `${String(status.value)} (${status.type})`
}

function setTab(tab) {
  const isProducts = tab === 'products'
  tabProducts.classList.toggle('is-active', isProducts)
  tabOrders.classList.toggle('is-active', !isProducts)
  tabProducts.setAttribute('aria-selected', isProducts ? 'true' : 'false')
  tabOrders.setAttribute('aria-selected', !isProducts ? 'true' : 'false')
  productsPanel.hidden = !isProducts
  ordersPanel.hidden = isProducts
}

tabProducts.addEventListener('click', () => setTab('products'))
tabOrders.addEventListener('click', () => setTab('orders'))

function newImageRow(value = '') {
  const row = document.createElement('div')
  row.style.display = 'grid'
  row.style.gridTemplateColumns = '1fr auto'
  row.style.gap = '10px'
  row.style.alignItems = 'center'
  const input = document.createElement('input')
  input.className = 'input'
  input.type = 'url'
  input.placeholder = 'https://…'
  input.value = value
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'iconBtn'
  remove.textContent = '×'
  remove.addEventListener('click', () => {
    row.remove()
  })
  row.appendChild(input)
  row.appendChild(remove)
  return row
}

function newVariantRow(v = {}) {
  const row = document.createElement('div')
  row.style.display = 'grid'
  row.style.gridTemplateColumns = '1fr 1fr auto auto'
  row.style.gap = '10px'
  row.style.alignItems = 'center'
  row.style.flexWrap = 'wrap'

  const sku = document.createElement('input')
  sku.className = 'input'
  sku.placeholder = 'SKU'
  sku.value = v.sku || ''

  const size = document.createElement('input')
  size.className = 'input'
  size.placeholder = 'Size (S/M/L)'
  size.value = v.size || ''

  const inStock = document.createElement('select')
  inStock.className = 'select'
  inStock.innerHTML = '<option value="true">In stock</option><option value="false">Out</option>'
  inStock.value = v.inStock === false ? 'false' : 'true'

  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'iconBtn'
  remove.textContent = '×'
  remove.addEventListener('click', () => row.remove())

  row.appendChild(sku)
  row.appendChild(size)
  row.appendChild(inStock)
  row.appendChild(remove)
  return row
}

function resetForm() {
  editingProductId = null
  productFormTitle.textContent = 'Create product'
  productForm.reset()
  productForm.elements.namedItem('price').value = ''
  imagesList.innerHTML = ''
  variantsList.innerHTML = ''
  imagesList.appendChild(newImageRow(''))
  variantsList.appendChild(newVariantRow({ size: 'S', inStock: true }))
  variantsList.appendChild(newVariantRow({ size: 'M', inStock: true }))
  variantsList.appendChild(newVariantRow({ size: 'L', inStock: true }))
  deleteProductBtn.hidden = true
  productMessage.textContent = ''
}

addImageBtn.addEventListener('click', () => {
  imagesList.appendChild(newImageRow(''))
})

addVariantBtn.addEventListener('click', () => {
  variantsList.appendChild(newVariantRow({}))
})

newProductBtn.addEventListener('click', () => {
  resetForm()
})

function filteredProducts() {
  const s = String(productSearch.value || '').trim().toLowerCase()
  if (!s) return products
  return products.filter((p) => `${p.title || ''} ${p.category || ''}`.toLowerCase().includes(s))
}

function renderProductsTable() {
  productsTbody.innerHTML = ''
  for (const p of filteredProducts()) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${escapeHtml(p.title || 'Untitled')}</td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td class="right">${escapeHtml(formatMoney(Number(p.priceCents || 0)))}</td>
      <td>${p.isActive ? '<span class="tag tag--success">active</span>' : '<span class="tag">archived</span>'}</td>
      <td class="right"><button class="btn btn--secondary" type="button">Edit</button></td>
    `
    const btn = tr.querySelector('button')
    btn.addEventListener('click', () => loadIntoForm(p.id))
    productsTbody.appendChild(tr)
  }
}

function formValue(name) {
  const el = productForm.elements.namedItem(name)
  return el && typeof el.value !== 'undefined' ? String(el.value || '').trim() : ''
}

function randomSkuBase() {
  return `UT-${Math.random().toString(16).slice(2, 6).toUpperCase()}`
}

function collectProductFromForm() {
  const title = formValue('title')
  const category = formValue('category')
  const price = Number(formValue('price') || '0')
  const description = formValue('description')
  const isActive = Boolean(productForm.elements.namedItem('isActive')?.checked)
  if (!title || !category || !description || !Number.isFinite(price)) throw new Error('Fill all required fields')

  const imageUrls = Array.from(imagesList.querySelectorAll('input'))
    .map((i) => String(i.value || '').trim())
    .filter(Boolean)

  const baseSku = randomSkuBase()
  const variants = Array.from(variantsList.children)
    .map((row, idx) => {
      const inputs = row.querySelectorAll('input,select')
      const sku = String(inputs[0]?.value || '').trim() || `${baseSku}-${idx + 1}`
      const size = String(inputs[1]?.value || '').trim() || `V${idx + 1}`
      const inStock = String(inputs[2]?.value || 'true') !== 'false'
      return { sku, size, inStock }
    })
    .filter((v) => v && v.sku)

  return {
    title,
    category,
    description,
    priceCents: Math.round(price * 100),
    currency: 'ZAR',
    imageUrls: imageUrls.length > 0 ? imageUrls : [placeholderImageUrl(title, 800, 600)],
    variants,
    isActive,
  }
}

async function loadProducts() {
  const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(250))
  const snap = await getDocs(q)
  products = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  renderProductsTable()
}

async function loadOrders() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(250))
  const snap = await getDocs(q)
  orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  renderOrdersTable()
}

function renderOrderDetails(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const addr = order.shippingAddress || {}
  adminOrderMeta.textContent = `${order.id} • ${order.status || 'pending'}`
  adminOrderBody.innerHTML = `
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
  `
  adminOrderDialog.showModal()
}

function renderOrdersTable() {
  ordersTbody.innerHTML = ''
  for (const o of orders) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td class="mono">${escapeHtml(o.id)}</td>
      <td class="mono">${escapeHtml(o.userId || '—')}</td>
      <td class="right">${escapeHtml(formatMoney(Number(o.totalCents || 0)))}</td>
      <td>
        <select class="select" style="min-width:140px">
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="shipped">shipped</option>
          <option value="cancelled">cancelled</option>
        </select>
      </td>
      <td class="right" style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn btn--secondary" type="button">View</button>
        <button class="btn btn--primary" type="button">Update</button>
      </td>
    `
    const select = tr.querySelector('select')
    select.value = String(o.status || 'pending')
    const [viewBtn, updateBtn] = tr.querySelectorAll('button')
    viewBtn.addEventListener('click', () => renderOrderDetails(o))
    updateBtn.addEventListener('click', async () => {
      try {
        const next = String(select.value)
        await setDoc(doc(db, 'orders', o.id), { status: next }, { merge: true })
        o.status = next
        toast('Order updated', `${o.id} → ${next}`)
      } catch (e) {
        toast('Update failed', toPlainErrorMessage(e))
      }
    })
    ordersTbody.appendChild(tr)
  }
}

function loadIntoForm(productId) {
  const p = products.find((x) => x.id === productId)
  if (!p) return
  editingProductId = p.id
  productFormTitle.textContent = 'Edit product'
  productMessage.textContent = ''

  productForm.elements.namedItem('title').value = p.title || ''
  productForm.elements.namedItem('category').value = p.category || ''
  productForm.elements.namedItem('price').value = ((Number(p.priceCents || 0) / 100) || 0).toFixed(2)
  productForm.elements.namedItem('description').value = p.description || ''
  productForm.elements.namedItem('isActive').checked = Boolean(p.isActive)

  imagesList.innerHTML = ''
  const imgs = Array.isArray(p.imageUrls) && p.imageUrls.length > 0 ? p.imageUrls : ['']
  imgs.forEach((url) => imagesList.appendChild(newImageRow(url)))

  variantsList.innerHTML = ''
  const vars = Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : [{ size: 'One size', inStock: true }]
  vars.forEach((v) => variantsList.appendChild(newVariantRow(v)))

  deleteProductBtn.hidden = false
}

deleteProductBtn.addEventListener('click', async () => {
  if (!editingProductId) return
  deleteProductBtn.disabled = true
  try {
    await setDoc(doc(db, 'products', editingProductId), { isActive: false, updatedAt: serverTimestamp() }, { merge: true })
    toast('Archived', 'Product marked as inactive.')
    await loadProducts()
    resetForm()
  } catch (e) {
    toast('Archive failed', toPlainErrorMessage(e))
  } finally {
    deleteProductBtn.disabled = false
  }
})

productSearch.addEventListener('input', () => {
  renderProductsTable()
})

productForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  productMessage.textContent = 'Saving…'
  try {
    const data = collectProductFromForm()
    if (editingProductId) {
      await setDoc(doc(db, 'products', editingProductId), { ...data, updatedAt: serverTimestamp() }, { merge: true })
      toast('Saved', 'Product updated.')
    } else {
      await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      toast('Saved', 'Product created.')
    }
    await loadProducts()
    resetForm()
    productMessage.textContent = 'Saved.'
  } catch (e2) {
    productMessage.textContent = toPlainErrorMessage(e2)
    toast('Save failed', toPlainErrorMessage(e2))
  }
})

seedBtn.addEventListener('click', async () => {
  seedBtn.disabled = true
  try {
    const now = Date.now()
    const seeds = [
      { title: 'Midnight Hoodie', category: 'Tops', priceCents: 6900 },
      { title: 'Utility Cargo Pants', category: 'Bottoms', priceCents: 7900 },
      { title: 'Neon Edge Tee', category: 'Tops', priceCents: 3200 },
      { title: 'City Runner Jacket', category: 'Outerwear', priceCents: 9900 },
      { title: 'Minimal Cap', category: 'Accessories', priceCents: 2400 },
      { title: 'Streetline Sweats', category: 'Bottoms', priceCents: 5600 },
    ]
    for (const [i, s] of seeds.entries()) {
      const img = placeholderImageUrl(s.title, 800, 600)
      await addDoc(collection(db, 'products'), {
        title: s.title,
        category: s.category,
        description: `Urban Threads essential: ${s.title}.`,
        priceCents: s.priceCents,
        currency: 'ZAR',
        imageUrls: [img],
        variants: [
          { sku: `UT-${now}-${i}-S`, size: 'S', inStock: true },
          { sku: `UT-${now}-${i}-M`, size: 'M', inStock: true },
          { sku: `UT-${now}-${i}-L`, size: 'L', inStock: true },
        ],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    toast('Seeded', 'Demo products added to Firestore.')
    await loadProducts()
  } catch (e) {
    toast('Seeding failed', toPlainErrorMessage(e))
  } finally {
    seedBtn.disabled = false
  }
})

function mapFakeStoreCategory(c) {
  const s = String(c || '').toLowerCase()
  if (s.includes('clothing')) return 'Tops'
  if (s.includes('jewel')) return 'Accessories'
  return 'Shop'
}

async function importFromFakeStore() {
  importFakeStoreBtn.disabled = true
  try {
    const res = await fetch('https://fakestoreapi.com/products', { method: 'GET' })
    if (!res.ok) throw new Error(`Import failed (${res.status})`)
    const items = await res.json()
    const list = Array.isArray(items) ? items.slice(0, 20) : []
    if (list.length === 0) throw new Error('No products returned')

    const usdToZar = 18.5
    const now = Date.now()

    for (const [i, it] of list.entries()) {
      const title = String(it?.title || `Imported product ${i + 1}`)
      const category = mapFakeStoreCategory(it?.category)
      const description = String(it?.description || '')
      const price = Number(it?.price || 0)
      const priceCents = Math.round(price * usdToZar * 100)
      const image = String(it?.image || '').trim()
      const imageUrls = image ? [image] : [placeholderImageUrl(title, 800, 600)]

      await addDoc(collection(db, 'products'), {
        title,
        category,
        description,
        priceCents,
        currency: 'ZAR',
        imageUrls,
        variants: [
          { sku: `UT-FS-${now}-${i}-S`, size: 'S', inStock: true },
          { sku: `UT-FS-${now}-${i}-M`, size: 'M', inStock: true },
          { sku: `UT-FS-${now}-${i}-L`, size: 'L', inStock: true },
        ],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    toast('Imported', 'FakeStore products added.')
    await loadProducts()
  } catch (e) {
    toast('Import failed', toPlainErrorMessage(e))
  } finally {
    importFakeStoreBtn.disabled = false
  }
}

async function repairImages() {
  repairImagesBtn.disabled = true
  try {
    if (!Array.isArray(products) || products.length === 0) await loadProducts()
    const list = Array.isArray(products) ? products : []
    let updated = 0

    for (const p of list) {
      const urls = Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : []
      const hasAny = urls.length > 0
      const hasBad = hasAny && urls.every((u) => String(u).includes('placehold.co'))
      if (hasAny && !hasBad) continue
      await setDoc(
        doc(db, 'products', p.id),
        { imageUrls: [placeholderImageUrl(p.title || 'Urban Threads', 800, 600)], updatedAt: serverTimestamp() },
        { merge: true },
      )
      updated++
    }
    toast('Repair complete', `${updated} product${updated === 1 ? '' : 's'} updated.`)
    await loadProducts()
  } catch (e) {
    toast('Repair failed', toPlainErrorMessage(e))
  } finally {
    repairImagesBtn.disabled = false
  }
}

importFakeStoreBtn.addEventListener('click', importFromFakeStore)
repairImagesBtn.addEventListener('click', repairImages)

async function checkAdmin(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return { ok: false, value: undefined, type: 'missing' }
  const data = snap.data()
  return { ok: data?.isAdmin === true, value: data?.isAdmin, type: typeof data?.isAdmin }
}

async function initAdmin() {
  resetForm()
  setTab('products')
  await loadProducts()
  await loadOrders()
}

onUserChanged(async (u) => {
  currentUser = u
  if (!currentUser) {
    window.location.href = `/auth.html?returnTo=${encodeURIComponent('/admin.html')}`
    return
  }

  if (!isFirebaseConfigured) {
    toast('Firebase not configured', 'Update js/firebase.js with your Firebase config.')
    adminGate.hidden = false
    adminContent.hidden = true
    renderGateInfo(currentUser, null)
    return
  }

  try {
    await ensureUserDoc(currentUser)
    const status = await checkAdmin(currentUser.uid)
    renderGateInfo(currentUser, status)
    adminGate.hidden = status.ok
    adminContent.hidden = !status.ok
    if (!status.ok) return
    await initAdmin()
  } catch (e) {
    toast('Admin error', toPlainErrorMessage(e))
  }
})

adminRecheckBtn.addEventListener('click', async () => {
  if (!currentUser) return
  try {
    const status = await checkAdmin(currentUser.uid)
    renderGateInfo(currentUser, status)
    adminGate.hidden = status.ok
    adminContent.hidden = !status.ok
    if (status.ok) await initAdmin()
  } catch (e) {
    toast('Admin error', toPlainErrorMessage(e))
  }
})

