export type OwnerReportPeriod = 'week' | 'month'

export type OwnerReportPreview = {
  period: OwnerReportPeriod
  label: string
  range: string
  comparisonLabel: string
  generatedAt: string
  revenue: {
    closed: number
    target: number
    priorClosed: number
    weeklyClosed: number[]
    weeklyTarget: number[]
  }
  pipeline: {
    value: number
    coverage: number
    priorCoverage: number
    stages: { label: string; value: number }[]
  }
  activity: {
    conversationsHandled: number
    conversationsPrior: number
    followUpsCompleted: number
    followUpsPrior: number
    onTimePct: number
    priorOnTimePct: number
  }
  bookings: {
    total: number
    priorTotal: number
    attendedPct: number
    priorAttendedPct: number
    series: number[]
  }
  objections: {
    label: string
    count: number
    priorCount: number
    wonAfterScriptPct: number
    series: number[]
  }[]
  readout: string
  nextDecision: string
  sample: true
}

export const OWNER_REPORTS: Record<OwnerReportPeriod, OwnerReportPreview> = {
  month: {
    period: 'month',
    label: 'Monthly summary',
    range: '1–31 July 2026',
    comparisonLabel: 'vs June 2026',
    generatedAt: '2 Aug 2026 · 08:30 IST',
    revenue: {
      closed: 1280000,
      target: 1500000,
      priorClosed: 1100000,
      weeklyClosed: [240000, 310000, 270000, 460000],
      weeklyTarget: [375000, 375000, 375000, 375000],
    },
    pipeline: {
      value: 3140000,
      coverage: 2.1,
      priorCoverage: 1.8,
      stages: [
        { label: 'Qualified', value: 1240000 },
        { label: 'Demo / visit', value: 860000 },
        { label: 'Proposal', value: 690000 },
        { label: 'Verbal yes', value: 350000 },
      ],
    },
    activity: {
      conversationsHandled: 684,
      conversationsPrior: 621,
      followUpsCompleted: 312,
      followUpsPrior: 276,
      onTimePct: 94,
      priorOnTimePct: 89,
    },
    bookings: {
      total: 42,
      priorTotal: 36,
      attendedPct: 83,
      priorAttendedPct: 78,
      series: [8, 10, 11, 13],
    },
    objections: [
      { label: 'Price / fees', count: 38, priorCount: 43, wonAfterScriptPct: 32, series: [13, 10, 8, 7] },
      { label: 'Timing', count: 24, priorCount: 22, wonAfterScriptPct: 29, series: [4, 5, 7, 8] },
      { label: 'Needs approval', count: 17, priorCount: 18, wonAfterScriptPct: 35, series: [6, 4, 4, 3] },
    ],
    readout: 'Revenue reached 85% of target and grew 16% month over month. Bookings and follow-up discipline improved together.',
    nextDecision: '₹4.2L in proposal-stage deals needs a decision by 7 August to protect next month’s target.',
    sample: true,
  },
  week: {
    period: 'week',
    label: 'Weekly summary',
    range: '27 July–2 August 2026',
    comparisonLabel: 'vs prior week',
    generatedAt: '2 Aug 2026 · 08:30 IST',
    revenue: {
      closed: 460000,
      target: 375000,
      priorClosed: 270000,
      weeklyClosed: [40000, 85000, 60000, 110000, 165000],
      weeklyTarget: [75000, 75000, 75000, 75000, 75000],
    },
    pipeline: {
      value: 3140000,
      coverage: 2.1,
      priorCoverage: 2,
      stages: [
        { label: 'Qualified', value: 1240000 },
        { label: 'Demo / visit', value: 860000 },
        { label: 'Proposal', value: 690000 },
        { label: 'Verbal yes', value: 350000 },
      ],
    },
    activity: {
      conversationsHandled: 181,
      conversationsPrior: 164,
      followUpsCompleted: 88,
      followUpsPrior: 76,
      onTimePct: 96,
      priorOnTimePct: 92,
    },
    bookings: {
      total: 13,
      priorTotal: 11,
      attendedPct: 85,
      priorAttendedPct: 82,
      series: [2, 3, 1, 3, 4],
    },
    objections: [
      { label: 'Price / fees', count: 7, priorCount: 8, wonAfterScriptPct: 36, series: [2, 1, 2, 1, 1] },
      { label: 'Timing', count: 8, priorCount: 7, wonAfterScriptPct: 25, series: [1, 2, 1, 2, 2] },
      { label: 'Needs approval', count: 3, priorCount: 4, wonAfterScriptPct: 33, series: [1, 0, 1, 0, 1] },
    ],
    readout: 'The team closed above weekly pace while improving response discipline. Bookings finished 18% above the prior week.',
    nextDecision: 'Three verbal-yes deals worth ₹3.5L need owner confirmation before Friday.',
    sample: true,
  },
}
