import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../app/panel.css'
import App from '../../app/App'
import { installPanelClient } from '../../lib/session'

installPanelClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
