import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { startSingleWriter } from './lib/singleWriter.js'

const container = document.getElementById('root')
const stop = startSingleWriter({
  mount: () => {
    container.replaceChildren()
    const root = createRoot(container)
    root.render(<StrictMode><App /></StrictMode>)
    return () => root.unmount()
  },
  showStatus: message => {
    const status = document.createElement('p')
    status.setAttribute('role', 'status')
    status.className = 'p-6 text-slate-800'
    status.textContent = message
    container.replaceChildren(status)
  }
})
window.addEventListener('pagehide', stop, { once: true })
window.addEventListener('pageshow', event => {
  if (event.persisted) window.location.reload()
})
if (import.meta.hot) import.meta.hot.dispose(stop)
