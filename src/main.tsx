window.addEventListener('error', e => {
  const el = document.createElement('pre'); el.textContent = 'Error: ' + (e.error?.message ?? e.message);
  el.style.cssText='white-space:pre-wrap;padding:12px;margin:12px;background:#fee;border:1px solid #f99;font:12px ui-monospace'; document.body.prepend(el);
});
window.addEventListener('unhandledrejection', e => {
  const el = document.createElement('pre'); el.textContent = 'Promise error: ' + String((e as any).reason);
  el.style.cssText='white-space:pre-wrap;padding:12px;margin:12px;background:#fee;border:1px solid #f99;font:12px ui-monospace'; document.body.prepend(el);
});

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
