import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../app/panel.css'
import App from '../../app/App'
import { installPanelClient } from '../../lib/session'
import { markWideSurface } from '../../lib/surface'
import { followTheme } from '../../lib/theme'

// The ONE line that makes this mount different from the side panel. Set before
// render so the first paint is already wide — flipping it afterwards would show
// the rep the 380px column for a frame, mid-call.
markWideSurface()

installPanelClient()
followTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
