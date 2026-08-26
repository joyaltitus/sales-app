import { defineBackground } from '#imports'

export default defineBackground(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  // C2: alarms, notifications, badge, tab reuse go here
})
