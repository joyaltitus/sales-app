export type VisibilityModePreview = 'full_board' | 'top_three' | 'private'
export type SprintCadencePreview = 'weekly' | 'biweekly' | 'monthly'
export type ScoreSourceKeyPreview = 'behaviors' | 'outcomes' | 'improvement' | 'team_goal'

export type TeamGameConfigPreview = {
  clientId: string
  teamId: string
  visibility: VisibilityModePreview
  sprint: SprintCadencePreview
  weights: Record<ScoreSourceKeyPreview, number>
  quietHours: { timezone: string; workdayStart: string; workdayEnd: string; weekendsProtected: boolean; holidaysProtected: boolean }
  freezeTokensPerMonth: number
  updatedBy: string
  sample: true
}

export type ScoreEventPreview = {
  id: string
  repId: string
  source: ScoreSourceKeyPreview
  behavior?: 'follow_up_on_time' | 'fast_first_response' | 'call_logged' | 'objection_logged' | 'booking_made'
  points: number
  capped: boolean
  entityRef?: { kind: 'call' | 'objection' | 'booking' | 'deal' | 'follow_up'; id: string }
  occurredAt: string
  sample: true
}

export type BadgeDefinitionPreview = {
  id: string
  name: string
  description: string
  criteria: { metric: string; threshold: number; window: string }
  earnedAt: string | null
  sample: true
}

export type ChallengeDefinitionPreview = {
  id: string
  template: 'most_x' | 'first_to_n' | 'team_total' | 'beat_own_best'
  name: string
  metric: 'follow_ups' | 'bookings' | 'calls' | 'revenue' | 'objections_logged'
  target: number
  startsAt: string
  endsAt: string
  participant: { kind: 'team' | 'subset'; ids: string[] }
  visibility: VisibilityModePreview
  prize?: { imageUrl: string; title: string; caption: string }
  sample: true
}

export type ScoreSourcePreview = {
  key: ScoreSourceKeyPreview
  label: string
  weight: number
  points: number
  explanation: string
  sample: true
}

export type BehaviorScorePreview = {
  key: ScoreEventPreview['behavior']
  label: string
  points: number
  dailyCap: number
  capped: boolean
  sample: true
}

export type BoardRowPreview = {
  id: string
  name: string
  position: number
  points: number
  revenue: number
  improvementPct: number
  framing: string
  sample: true
}

export type WellbeingFlagPreview = {
  id: string
  rep: string
  signal: 'late_night_pattern' | 'quality_drift' | 'no_break' | 'streak_anxiety'
  context: string
  suggestedAction: 'Suggest a day off' | 'Rebalance leads' | 'Check in'
  sample: true
}

export type StreakProtectionPreview = {
  repId: string
  month: string
  manualTokensRemaining: number
  protectedDates: { date: string; reason: 'leave' | 'weekend' | 'holiday' | 'manual' }[]
  sample: true
}

export type MoodPulseResponsePreview = {
  id: string
  repId: string
  week: string
  response: 'heavy' | 'steady' | 'good' | null
  privateToAggregate: true
  dismissedForever: boolean
  sample: true
}

export const TEAM_GAME_CONFIG: TeamGameConfigPreview = {
  clientId: 'preview-client',
  teamId: 'admissions-west',
  visibility: 'full_board',
  sprint: 'biweekly',
  weights: { behaviors: 40, outcomes: 35, improvement: 15, team_goal: 10 },
  quietHours: { timezone: 'Asia/Kolkata', workdayStart: '09:00', workdayEnd: '18:30', weekendsProtected: true, holidaysProtected: true },
  freezeTokensPerMonth: 2,
  updatedBy: 'Meera Nair',
  sample: true,
}

export const SCORE_SOURCES: ScoreSourcePreview[] = [
  { key: 'behaviors', label: 'Behaviors', weight: 40, points: 514, explanation: 'Work within your control: timely follow-ups, response quality, logged calls, objections and bookings.', sample: true },
  { key: 'outcomes', label: 'Outcomes', weight: 35, points: 450, explanation: 'Closed deals and revenue, balanced so one large account does not erase consistent work.', sample: true },
  { key: 'improvement', label: 'Improvement', weight: 15, points: 193, explanation: 'Progress against your own recent baseline—not comparison with another rep.', sample: true },
  { key: 'team_goal', label: 'Team goal', weight: 10, points: 128, explanation: 'Shared contribution when the team moves toward its agreed target.', sample: true },
]

export const BEHAVIOR_SCORES: BehaviorScorePreview[] = [
  { key: 'follow_up_on_time', label: 'On-time follow-ups', points: 180, dailyCap: 40, capped: true, sample: true },
  { key: 'fast_first_response', label: 'Fast first response', points: 116, dailyCap: 30, capped: false, sample: true },
  { key: 'call_logged', label: 'Calls logged', points: 108, dailyCap: 36, capped: true, sample: true },
  { key: 'objection_logged', label: 'Objections captured', points: 55, dailyCap: 25, capped: false, sample: true },
  { key: 'booking_made', label: 'Bookings made', points: 55, dailyCap: 30, capped: false, sample: true },
]

export const BADGES: BadgeDefinitionPreview[] = [
  { id: 'badge-1', name: 'Promise keeper', description: '25 follow-ups completed on time', criteria: { metric: 'follow_up_on_time', threshold: 25, window: 'sprint' }, earnedAt: '2026-08-01', sample: true },
  { id: 'badge-2', name: 'Clear listener', description: '10 useful objections captured', criteria: { metric: 'objections_logged', threshold: 10, window: 'sprint' }, earnedAt: '2026-08-02', sample: true },
  { id: 'badge-3', name: 'First ₹5L', description: '₹5L closed in one month', criteria: { metric: 'revenue', threshold: 500000, window: 'month' }, earnedAt: null, sample: true },
  { id: 'badge-4', name: 'Best week', description: 'Beat your own weekly baseline', criteria: { metric: 'improvement_pct', threshold: 15, window: 'week' }, earnedAt: null, sample: true },
]

export const ACTIVE_CHALLENGE: ChallengeDefinitionPreview = {
  id: 'challenge-1', template: 'beat_own_best', name: 'A cleaner follow-up week', metric: 'follow_ups', target: 32,
  startsAt: '2026-08-01T09:00:00+05:30', endsAt: '2026-08-07T18:30:00+05:30', participant: { kind: 'team', ids: ['admissions-west'] }, visibility: 'full_board',
  prize: { imageUrl: 'preview://team-lunch', title: 'Team lunch', caption: 'A long-table lunch at the team’s favourite place.' }, sample: true,
}

export const BOARD_ROWS: BoardRowPreview[] = [
  { id: 'r1', name: 'Priya Shah', position: 1, points: 1580, revenue: 480000, improvementPct: 12, framing: 'Strong outcome week', sample: true },
  { id: 'r2', name: 'Nikhil S.', position: 2, points: 1490, revenue: 390000, improvementPct: 21, framing: 'Best response pace', sample: true },
  { id: 'r3', name: 'Meera Iyer', position: 3, points: 1370, revenue: 310000, improvementPct: 9, framing: 'Consistent follow-through', sample: true },
  { id: 'r4', name: 'Asha Thomas', position: 4, points: 1285, revenue: 280000, improvementPct: 18, framing: 'On pace for a best week', sample: true },
  { id: 'r5', name: 'Rahul Das', position: 5, points: 1190, revenue: 250000, improvementPct: 14, framing: 'Calls-to-bookings improving', sample: true },
  { id: 'r6', name: 'Fathima K.', position: 6, points: 1095, revenue: 190000, improvementPct: 24, framing: 'Personal baseline +24%', sample: true },
  { id: 'r7', name: 'Vishnu K.', position: 7, points: 1010, revenue: 175000, improvementPct: 11, framing: 'Three promises kept today', sample: true },
  { id: 'r8', name: 'Jaya Menon', position: 8, points: 940, revenue: 120000, improvementPct: 27, framing: 'Best improvement pace', sample: true },
  { id: 'r9', name: 'Dev Patel', position: 9, points: 860, revenue: 95000, improvementPct: 16, framing: 'One good day within reach', sample: true },
]

export const WELLBEING_FLAGS: WellbeingFlagPreview[] = [
  { id: 'well-1', rep: 'Nikhil S.', signal: 'late_night_pattern', context: 'Activity after 9 pm on four of the last six workdays.', suggestedAction: 'Check in', sample: true },
  { id: 'well-2', rep: 'Asha Thomas', signal: 'streak_anxiety', context: 'Long streak is continuing while completed volume is tapering.', suggestedAction: 'Suggest a day off', sample: true },
  { id: 'well-3', rep: 'Rahul Das', signal: 'no_break', context: 'No protected weekday away in five weeks.', suggestedAction: 'Rebalance leads', sample: true },
]

export const STREAK_PROTECTION: StreakProtectionPreview = { repId: 'rep-asha', month: '2026-08', manualTokensRemaining: 2, protectedDates: [{ date: '2026-08-02', reason: 'weekend' }], sample: true }
export const MOOD_PULSE: MoodPulseResponsePreview = { id: 'mood-2026-w31', repId: 'rep-asha', week: '2026-W31', response: null, privateToAggregate: true, dismissedForever: false, sample: true }
