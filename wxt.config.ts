import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'
import { loadEnv } from 'vite'

function hostPermission(value: string | undefined): string | null {
  if (!value) return null
  try {
    return `${new URL(value).origin}/*`
  } catch {
    return null
  }
}

export default defineConfig({
  srcDir: 'extension',
  alias: { '@app': 'src' },
  manifestVersion: 3,
  manifest: ({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const hostPermissions = [
      hostPermission(env.VITE_SUPABASE_URL),
      hostPermission(env.VITE_HUB_API_BASE),
    ].filter((value): value is string => value !== null)
    return {
      name: 'Rep',
      description: 'Work the day beside a WhatsApp chat.',
      version: '0.1.0',
      permissions: ['sidePanel', 'storage', 'alarms', 'notifications', 'tabs'],
      host_permissions: hostPermissions,
    }
  },
  vite: () => ({
    plugins: [react()],
  }),
})
