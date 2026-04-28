import { qs } from '../utils.js'

export function toast(title, desc, options = {}) {
  const root = qs('#toast-root')
  const node = document.createElement('div')
  node.className = 'toast'

  const left = document.createElement('div')
  const t = document.createElement('div')
  t.className = 'toast__title'
  t.textContent = title
  left.appendChild(t)

  if (desc) {
    const d = document.createElement('div')
    d.className = 'toast__desc'
    d.textContent = desc
    left.appendChild(d)
  }

  const close = document.createElement('button')
  close.className = 'iconBtn'
  close.type = 'button'
  close.setAttribute('aria-label', 'Dismiss')
  close.textContent = '×'
  close.addEventListener('click', () => {
    node.remove()
  })

  node.appendChild(left)
  node.appendChild(close)
  root.appendChild(node)

  const ttl = Number(options.ttlMs ?? 3200)
  if (ttl > 0) {
    window.setTimeout(() => {
      if (node.isConnected) node.remove()
    }, ttl)
  }
}

