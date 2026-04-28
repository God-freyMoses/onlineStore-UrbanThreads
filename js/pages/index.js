import { collection, getDocs, limit, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { initShell } from '../ui/shell.js'
import { db, isFirebaseConfigured } from '../firebase.js'
import { addToCart } from '../cartStore.js'
import { debounce, escapeHtml, formatMoney, placeholderImageUrl, qs, toPlainErrorMessage } from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const categorySelect = qs('#categorySelect')
const sortSelect = qs('#sortSelect')
const searchInput = qs('#searchInput')
const clearFiltersBtn = qs('#clearFiltersBtn')
const emptyClearBtn = qs('#emptyClearBtn')
const productGrid = qs('#productGrid')
const statusBar = qs('#statusBar')
const emptyState = qs('#emptyState')

let allProducts = []
let filtered = []

function normalize(s) {
  return String(s || '').trim().toLowerCase()
}

function getPrimaryImage(p) {
  const url = Array.isArray(p.imageUrls) ? p.imageUrls.find(Boolean) : null
  return url || placeholderImageUrl(p?.title || 'Urban Threads', 800, 600)
}

function firstInStockVariant(p) {
  const v = Array.isArray(p.variants) ? p.variants.find((x) => x && x.inStock) : null
  return v || null
}

function setCategoryOptions(products) {
  const cats = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  categorySelect.innerHTML = ''
  const all = document.createElement('option')
  all.value = 'all'
  all.textContent = 'All'
  categorySelect.appendChild(all)
  for (const c of cats) {
    const opt = document.createElement('option')
    opt.value = c
    opt.textContent = c
    categorySelect.appendChild(opt)
  }
}

function applyFilters() {
  const cat = categorySelect.value
  const s = normalize(searchInput.value)
  const sort = sortSelect.value

  let arr = allProducts.slice()
  if (cat && cat !== 'all') arr = arr.filter((p) => p.category === cat)
  if (s) {
    arr = arr.filter((p) => {
      const hay = `${p.title || ''} ${p.description || ''} ${p.category || ''}`.toLowerCase()
      return hay.includes(s)
    })
  }

  if (sort === 'priceAsc') arr.sort((a, b) => Number(a.priceCents || 0) - Number(b.priceCents || 0))
  if (sort === 'priceDesc') arr.sort((a, b) => Number(b.priceCents || 0) - Number(a.priceCents || 0))
  if (sort === 'newest') arr.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))

  filtered = arr
  render()
}

function render() {
  statusBar.textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'} shown`

  productGrid.innerHTML = ''
  emptyState.hidden = filtered.length > 0
  if (filtered.length === 0) return

  for (const p of filtered) {
    const card = document.createElement('article')
    card.className = 'card'

    const imgWrap = document.createElement('a')
    imgWrap.className = 'card__img'
    imgWrap.href = `/product.html?id=${encodeURIComponent(p.id)}`
    const img = document.createElement('img')
    img.alt = p.title || 'Product image'
    img.loading = 'lazy'
    img.src = getPrimaryImage(p)
    img.addEventListener('error', () => {
      img.src = placeholderImageUrl(p?.title || 'Urban Threads', 800, 600)
    })
    imgWrap.appendChild(img)

    const body = document.createElement('div')
    body.className = 'card__body'

    const titleRow = document.createElement('div')
    titleRow.className = 'card__titleRow'
    const title = document.createElement('div')
    title.innerHTML = `<div style="font-weight:900">${escapeHtml(p.title || 'Untitled')}</div><div class="muted" style="font-size:12px;margin-top:3px">${escapeHtml(p.category || '—')}</div>`
    const price = document.createElement('div')
    price.className = 'price'
    price.textContent = formatMoney(p.priceCents)
    titleRow.appendChild(title)
    titleRow.appendChild(price)

    const meta = document.createElement('div')
    meta.className = 'card__meta'
    const pill = document.createElement('span')
    pill.className = 'pill'
    const v = firstInStockVariant(p)
    pill.textContent = v ? `In stock • ${v.size || v.sku || 'Variant'}` : 'Out of stock'

    const actions = document.createElement('div')
    actions.className = 'card__actions'
    const view = document.createElement('a')
    view.className = 'btn btn--secondary'
    view.href = `/product.html?id=${encodeURIComponent(p.id)}`
    view.textContent = 'View'
    const add = document.createElement('button')
    add.className = 'btn btn--primary'
    add.type = 'button'
    add.textContent = 'Add'
    add.disabled = !v
    add.addEventListener('click', () => {
      const chosen = firstInStockVariant(p)
      if (!chosen) return
      addToCart(
        {
          productId: p.id,
          sku: chosen.sku || `${p.id}-${chosen.size || 'default'}`,
          title: p.title,
          size: chosen.size || 'One size',
          priceCents: Number(p.priceCents || 0),
          imageUrl: getPrimaryImage(p),
        },
        1,
      )
      toast('Added to cart', `${p.title || 'Item'} • ${chosen.size || 'Variant'}`)
    })
    actions.appendChild(view)
    actions.appendChild(add)

    meta.appendChild(pill)
    meta.appendChild(actions)

    body.appendChild(titleRow)
    body.appendChild(meta)
    card.appendChild(imgWrap)
    card.appendChild(body)
    productGrid.appendChild(card)
  }
}

async function loadProducts() {
  statusBar.textContent = 'Loading products…'
  if (!isFirebaseConfigured) {
    statusBar.textContent = 'Store is temporarily unavailable.'
    emptyState.hidden = false
    return
  }
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(200))
    const snap = await getDocs(q)
    allProducts = snap.docs.map((d) => {
      const data = d.data()
      const createdAtMs = typeof data?.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0
      return { id: d.id, ...data, createdAtMs }
    })
    allProducts = allProducts.filter((p) => p.isActive !== false)
    setCategoryOptions(allProducts)
    applyFilters()
    if (allProducts.length === 0) statusBar.textContent = 'No products found. Create some in Admin.'
  } catch (e) {
    statusBar.textContent = 'Failed to load products.'
    toast('Failed to load products', toPlainErrorMessage(e))
  }
}

categorySelect.addEventListener('change', applyFilters)
sortSelect.addEventListener('change', applyFilters)
searchInput.addEventListener('input', debounce(applyFilters, 120))
clearFiltersBtn.addEventListener('click', () => {
  categorySelect.value = 'all'
  sortSelect.value = 'newest'
  searchInput.value = ''
  applyFilters()
})
emptyClearBtn.addEventListener('click', () => {
  clearFiltersBtn.click()
})

loadProducts()

