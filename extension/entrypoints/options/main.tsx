import React from 'react'
import ReactDOM from 'react-dom/client'
import '../../app/panel.css'
import OptionsPage from '../../app/OptionsPage'
import { installPanelClient } from '../../lib/session'

// The options page reads memberships under the rep's own session, so it needs
// the same client the panel installs. Sign-in itself stays on the panel — an
// options page that could take a password would be a second credential surface
// for no gain.
installPanelClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
)
