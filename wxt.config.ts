import react from '@vitejs/plugin-react'
import { defineConfig } from 'wxt'
import { loadEnv } from 'vite'

// A missing or unparseable value here used to yield null, which filtered out to an
// EMPTY host_permissions array — and an extension with no host permission for the API
// loads cleanly, passes every gate, then fails every request at runtime with an opaque
// CORS error. These values come from .env.production, which is gitignored, so the main
// checkout builds correctly while every worktree, CI runner and fresh clone builds a
// silently broken extension. Fail the build instead; a red build beats a green one that
// ships a dead extension.
function hostPermission(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `wxt.config.ts: ${name} is not set, so the extension would build with no host ` +
        `permission for that origin and every request to it would fail at runtime. ` +
        `Set it in .env.production (or the shell) before running ext:build.`,
    )
  }
  try {
    return `${new URL(value).origin}/*`
  } catch {
    throw new Error(`wxt.config.ts: ${name} is not a valid absolute URL: ${value}`)
  }
}

export default defineConfig({
  srcDir: 'extension',
  alias: { '@app': 'src' },
  manifestVersion: 3,
  manifest: ({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const hostPermissions = [
      hostPermission('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL),
      hostPermission('VITE_HUB_API_BASE', env.VITE_HUB_API_BASE),
    ]
    return {
      // Pins the extension ID to this public key instead of letting Chrome derive
      // it from the unpacked directory path. chrome.storage is scoped PER ID, so a
      // path-derived ID means the rep's session and cached queue vanish whenever the
      // folder moves or another machine loads it. Public half of a keypair kept
      // outside the repo; safe to commit. ID: glhojoghohlfcmnlloheamccpapamhai
      // NOTE: the Chrome Web Store assigns its OWN id on first publish and rejects
      // `key` on a first upload — when we publish, copy the store's key back here.
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtBZlAz1W5dO40W9VKQbe8/o5Lq0Ro56KhZhgWTK94q/Y2ISQwYx7uB/z3Bw72rHRjBQkfi96kGXPEtVNM1kd0WC2w1tv9h6+FMVjyCI8YIjK5Ln/0frZxIQbQJ4GzYt5zcm5cagS242/xen87G31dnGISIU8M2TiEhH0/jxbkO5WYJq2sx/9vI/a3tDeByK7U+WIq6L5T7e71+gN4WgJm8Unsr5s/GJwJzVPTwFV6wFTqdnhlSNt9nUDYTrZxUGhx0eCrQdJ0w8q9Ns8aU0oKmWpnq4+1fNY2fIqi5BEOfWb5dj6shfgZrfWpC8dyuFveffXEK8XEKNjTy5q6vEwzwIDAQAB',
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
