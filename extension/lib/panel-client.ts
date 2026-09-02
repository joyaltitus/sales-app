import { createPanelSupabase } from './supabase'

export const panelSupabase = createPanelSupabase()

/**
 * Sales Hub, where the company standard is written.
 *
 * Nobody edits a standard script from the extension — a script the whole team
 * says is a manager's decision, and an editor in the panel would make it a
 * mid-call one. The panel links out instead.
 */
export const HUB_URL =
  (import.meta.env?.VITE_WORKBENCH_URL as string | undefined) ?? 'https://sales-app-joyal.zeabur.app'

export const hubPlaybookUrl = (taxonomyId: string) =>
  `${HUB_URL}/docs?workspace=playbook&taxonomy=${encodeURIComponent(taxonomyId)}`
