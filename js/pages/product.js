import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
import { initShell } from '../ui/shell.js'
import { db, isFirebaseConfigured } from '../firebase.js'
import { addToCart } from '../cartStore.js'
import {
  clampInt,
  formatMoney,
  getSearchParam,
  placeholderImageUrl,
  qs,
  setMetaDescription,
  setPageTitle,
  toPlainErrorMessage,
} from '../utils.js'
import { toast } from '../ui/toast.js'

initShell()

const id = getSearchParam('id')
const gallery = qs('#gallery')
const panel = qs('#productPanel')
const crumbTitle = qs('#crumbTitle')
const crumbCategory = qs('#crumbCategory')

function imageUrls(p) {
  const list = Array.isArray(p.imageUrls) ? p.imageUrls.filter(Boolean) : []
  if (list.length > 0) return list
  return [placeholderImageUrl(p?.title || 'Urban Threads', 800, 600)]
}

function hasStock(p) {
  const variants = Array.isArray(p.variants) ? p.variants : []
  if (variants.length === 0) return true
  return variants.some((v) => v && v.inStock !== false)
}

function renderGallery(images) {
  gallery.innerHTML = ''
  gallery.setAttribute('aria-busy', 'false')

  const main = document.createElement('div')
  main.className = 'gallery__main'
  const mainImg = document.createElement('img')
  mainImg.src = images[0]
  mainImg.alt = 'Product image'
  mainImg.addEventListener('error', () => {
    mainImg.src = placeholderImageUrl('Urban Threads', 800, 600)
  })
  main.appendChild(mainImg)

  const thumbs = document.createElement('div')
  thumbs.className = 'thumbs'

  const setActive = (idx) => {
    mainImg.src = images[idx]
    for (const [i, el] of thumbs.childNodes.entries()) {
      if (el instanceof HTMLElement) el.classList.toggle('is-active', i === idx)
    }
  }

  images.forEach((url, idx) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'thumb' + (idx === 0 ? ' is-active' : '')
    const img = document.createElement('img')
    img.alt = 'Thumbnail'
    img.loading = 'lazy'
    img.src = url
    img.addEventListener('error', () => {
      img.src = placeholderImageUrl('Urban Threads', 800, 600)
    })
    b.appendChild(img)
    b.addEventListener('click', () => setActive(idx))
    thumbs.appendChild(b)
  })

  gallery.appendChild(main)
  gallery.appendChild(thumbs)
}

function renderProduct(p) {
  panel.innerHTML = ''
  panel.setAttribute('aria-busy', 'false')

  const header = document.createElement('div')
  header.innerHTML = `<h2 style="margin-bottom:6px">${p.title || 'Untitled'}</h2><div class="muted">${p.category || '—'}</div>`

  const price = document.createElement('div')
  price.className = 'price'
  price.style.fontSize = '22px'
  price.textContent = formatMoney(p.priceCents)

  const desc = document.createElement('p')
  desc.className = 'muted'
  desc.textContent = p.description || ''

  const variants = Array.isArray(p.variants) ? p.variants : []
  const stock = document.createElement('div')
  stock.className = 'tag ' + (hasStock(p) ? 'tag--success' : 'tag--danger')
  stock.textContent = hasStock(p) ? 'In stock' : 'Out of stock'

  const variantField = document.createElement('label')
  variantField.className = 'field'
  variantField.innerHTML = '<span class="field__label">Size</span>'
  const select = document.createElement('select')
  select.className = 'select'
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select a size'
  select.appendChild(placeholder)
  if (variants.length === 0) {
    const opt = document.createElement('option')
    opt.value = 'default'
    opt.textContent = 'One size'
    select.appendChild(opt)
  } else {
    for (const v of variants) {
      const opt = document.createElement('option')
      opt.value = v?.sku || v?.size || ''
      const label = v?.size || v?.sku || 'Variant'
      opt.textContent = v?.inStock === false ? `${label} (out of stock)` : label
      opt.disabled = v?.inStock === false
      select.appendChild(opt)
    }
  }
  variantField.appendChild(select)

  const qtyWrap = document.createElement('div')
  qtyWrap.className = 'field'
  qtyWrap.innerHTML = '<span class="field__label">Quantity</span>'
  const qty = document.createElement('div')
  qty.className = 'qty'
  const minus = document.createElement('button')
  minus.type = 'button'
  minus.textContent = '−'
  const input = document.createElement('input')
  input.type = 'number'
  input.value = '1'
  input.min = '1'
  input.max = '99'
  const plus = document.createElement('button')
  plus.type = 'button'
  plus.textContent = '+'
  const syncQty = (next) => {
    input.value = String(clampInt(next, 1, 99))
  }
  minus.addEventListener('click', () => syncQty(Number(input.value) - 1))
  plus.addEventListener('click', () => syncQty(Number(input.value) + 1))
  input.addEventListener('change', () => syncQty(input.value))
  qty.appendChild(minus)
  qty.appendChild(input)
  qty.appendChild(plus)
  qtyWrap.appendChild(qty)

  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'btn btn--primary btn--full'
  add.textContent = 'Add to cart'
  add.disabled = !hasStock(p)

  const goCart = document.createElement('a')
  goCart.className = 'btn btn--secondary btn--full'
  goCart.href = '/cart.html'
  goCart.textContent = 'Go to cart'

  add.addEventListener('click', () => {
    const selected = select.value
    let chosen = null
    if (variants.length === 0) chosen = { sku: 'default', size: 'One size', inStock: true }
    else chosen = variants.find((v) => (v?.sku || v?.size || '') === selected) || null

    if (!chosen) {
      toast('Pick a size', 'Select a variant before adding to cart.')
      select.focus()
      return
    }
    if (chosen.inStock === false) {
      toast('Out of stock', 'Choose another variant.')
      return
    }

    const q = clampInt(input.value, 1, 99)
    const img = imageUrls(p)[0]
    addToCart(
      {
        productId: p.id,
        sku: chosen.sku || `${p.id}-${chosen.size || 'default'}`,
        title: p.title,
        size: chosen.size || 'One size',
        priceCents: Number(p.priceCents || 0),
        imageUrl: img,
      },
      q,
    )
    toast('Added to cart', `${p.title || 'Item'} × ${q}`)
  })

  panel.appendChild(header)
  panel.appendChild(price)
  panel.appendChild(desc)
  panel.appendChild(stock)
  panel.appendChild(variantField)
  panel.appendChild(qtyWrap)
  panel.appendChild(add)
  panel.appendChild(goCart)
}

async function load() {
  if (!id) {
    crumbTitle.textContent = 'Missing product id'
    gallery.setAttribute('aria-busy', 'false')
    panel.setAttribute('aria-busy', 'false')
    toast('Missing product id', 'Open a product from the shop page.')
    return
  }
  if (!isFirebaseConfigured) {
    crumbTitle.textContent = 'Firebase not configured'
    gallery.setAttribute('aria-busy', 'false')
    panel.setAttribute('aria-busy', 'false')
    toast('Firebase not configured', 'Update js/firebase.js with your Firebase config.')
    return
  }
  try {
    const ref = doc(db, 'products', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      crumbTitle.textContent = 'Not found'
      gallery.setAttribute('aria-busy', 'false')
      panel.setAttribute('aria-busy', 'false')
      toast('Product not found', 'This item may be archived or deleted.')
      return
    }
    const p = { id: snap.id, ...snap.data() }
    crumbTitle.textContent = p.title || 'Product'
    crumbCategory.textContent = p.category || 'Shop'
    setPageTitle(`${p.title || 'Product'} | Urban Threads`)
    setMetaDescription(`Details, sizes, and availability for ${p.title || 'Urban Threads product'}.`)
    renderGallery(imageUrls(p))
    renderProduct(p)
  } catch (e) {
    crumbTitle.textContent = 'Error'
    gallery.setAttribute('aria-busy', 'false')
    panel.setAttribute('aria-busy', 'false')
    toast('Failed to load product', toPlainErrorMessage(e))
  }
}

load()

