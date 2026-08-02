export type AuthFailureKind = 'invalid_credentials' | 'rate_limited' | 'network'

export type InvitePreview = {
  company: string
  role: string
  invitedEmail: string
  invitedBy: string
  sample: true
}

export type PasswordRecoveryPreview = {
  email: string
  expiresInMinutes: number
  sample: true
}

export type SessionExpiredPreview = {
  email: string
  contextLabel: string
  sample: true
}

export const INVITE_PREVIEW: InvitePreview = {
  company: 'Northstar Learning',
  role: 'Sales manager',
  invitedEmail: 'meera@northstar.example',
  invitedBy: 'Arjun Rao',
  sample: true,
}

export const RECOVERY_PREVIEW: PasswordRecoveryPreview = {
  email: 'meera@northstar.example',
  expiresInMinutes: 30,
  sample: true,
}

export const SESSION_EXPIRED_PREVIEW: SessionExpiredPreview = {
  email: 'meera@northstar.example',
  contextLabel: 'Anjali Ramesh · Quotation v3',
  sample: true,
}

export const AUTH_FAILURE_COPY: Record<AuthFailureKind, { title: string; body: string }> = {
  invalid_credentials: {
    title: 'That email and password don’t match.',
    body: 'Check both fields or reset your password. Your workspace is unchanged.',
  },
  rate_limited: {
    title: 'Too many attempts. Try again shortly.',
    body: 'We paused sign-in attempts to protect your account. Wait a few minutes before retrying.',
  },
  network: {
    title: 'We couldn’t reach the sign-in service.',
    body: 'Check your connection and try again. Nothing you entered was submitted.',
  },
}
