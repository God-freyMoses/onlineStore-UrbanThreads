export function qs(sel, root = document) {
  const el = root.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el
}

export function getSearchParam(name) {
  const url = new URL(window.location.href)
  return url.searchParams.get(name)
}

export function setPageTitle(title) {
  document.title = title
  const og = document.querySelector('meta[property="og:title"]')
  if (og) og.setAttribute('content', title)
}

export function setMetaDescription(desc) {
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', desc)
  const og = document.querySelector('meta[property="og:description"]')
  if (og) og.setAttribute('content', desc)
}

export function formatMoney(cents, currency = 'ZAR') {
  const amount = Number(cents || 0) / 100
  const code = String(currency || 'ZAR')
    .trim()
    .toUpperCase()
  const normalized = code === 'R' ? 'ZAR' : code || 'ZAR'
  const locale = normalized === 'ZAR' ? 'en-ZA' : undefined
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalized,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `R ${amount.toFixed(2)}`
  }
}

export function clampInt(n, min, max) {
  const x = Math.trunc(Number(n))
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

export function debounce(fn, ms) {
  let t = 0
  return (...args) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }
}

export function toPlainErrorMessage(e) {
  const msg = typeof e?.message === 'string' ? e.message : String(e)
  return msg.replace(/^Firebase:\s*/i, '').trim()
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function placeholderImageUrl(label = 'Urban Threads', w = 800, h = 600) {
  const safe = String(label || 'Urban Threads').trim() || 'Urban Threads'
  const seed = safe
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48)
  const s = seed || 'urban-threads'
  const ww = Number(w) || 800
  const hh = Number(h) || 600
  return `https://picsum.photos/seed/${encodeURIComponent(s)}/${ww}/${hh}`
}

