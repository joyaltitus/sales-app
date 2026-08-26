import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'extension',
  manifestVersion: 3,
  manifest: {
    name: 'Rep',
    description: 'Work the day beside a WhatsApp chat.',
    version: '0.1.0',
    permissions: ['sidePanel', 'storage', 'alarms', 'notifications', 'tabs'],
  },
  vite: () => ({
    plugins: [react()],
    resolve: {
      alias: {
        '@app': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }),
})
