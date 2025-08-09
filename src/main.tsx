import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// show errors on page
function showErr(e: unknown) {
  const el = document.createElement('pre')
  el.style.whiteSpace = 'pre-wrap'
  el.style.font = '12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace'
  el.style.padding = '12px'
  el.style.margin = '12px'
  el.style.background = '#fee'
  el.style.border = '1px solid #f99'
  el.textContent = 'Runtime error:\\n' + String(e)
  document.body.prepend(el)
}
window.addEventListener('error', (ev) => showErr(ev.error || ev.message))
window.addEventListener('unhandledrejection', (ev: any) => showErr(ev.reason || ev))

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (e) {
  showErr(e)
}
