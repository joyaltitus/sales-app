import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../app/panel.css'
import App from '../../app/App'
import { installPanelClient } from '../../lib/session'
import { followTheme } from '../../lib/theme'

installPanelClient()
followTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
