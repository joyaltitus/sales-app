import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  MOCK_CAMPAIGNS,
  MOCK_FAQS,
  MOCK_PROFILE,
  MOCK_PRODUCTS,
  MOCK_RULES,
} from '../preview/preview-mocks'

// Rendered through the `preview` prop — no session, no network, no Supabase.
// This is the same door the /preview gallery uses, so it doubles as the check
// that the gallery's three new sections actually paint.
//
// What is asserted is the TIER LINE: the columns 069 locks are rendered as
// facts the owner can read, never as fields they can type into. The wall itself
// is the database's (a locked column raises on a browser write however this
// component behaves) — this proves the screen tells the truth about it.
vi.mock('../../lib/team-data', () => ({
  useTeam: () => ({ items: [], loading: false, error: null, reload: vi.fn() }),
}))

const { ManageView } = await import('./ManageView')

const ALL = {
  products: MOCK_PRODUCTS,
  faqs: MOCK_FAQS,
  profile: MOCK_PROFILE,
  rules: MOCK_RULES,
  campaigns: MOCK_CAMPAIGNS,
}

function renderTab(tab: 'products' | 'faqs' | 'profile' | 'replies' | 'campaigns') {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ManageView designData={{ ...ALL, tab }} />
    </MemoryRouter>,
  )
}

describe('Products tab', () => {
  it('shows the slug as a fact, with no field to change it', () => {
    renderTab('products')
    expect(screen.getByText('weekend-intensive')).toBeInTheDocument()
    // Editable fields are labelled; the slug is not one of them.
    expect(screen.getAllByLabelText(/^Name$/i).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument()
  })

  it('warns on a guest-facing promise without blocking the save', () => {
    renderTab('products')
    // The second mock product's description says "We guarantee a seat". The
    // lint names the FAMILY next to it — that named warning is what is under
    // test, not the copy that provoked it.
    expect(screen.getByText('guarantee')).toBeInTheDocument()
    expect(screen.getByText(/promise of outcome/i)).toBeInTheDocument()
    const saves = screen.getAllByRole('button', { name: /save changes/i })
    // Nothing typed yet, so the button is idle — but it is present and is not
    // gated on the lint. The guardrail on the send path is the real authority.
    expect(saves.length).toBe(MOCK_PRODUCTS.length)
  })
})

describe('Profile tab', () => {
  it('renders the handover words read-only, and says who owns them', () => {
    renderTab('profile')
    expect(screen.getByText('Handover words')).toBeInTheDocument()
    expect(screen.getByText('complaint')).toBeInTheDocument()
    expect(screen.queryByLabelText(/handover words/i)).not.toBeInTheDocument()
    expect(screen.getByText(/ask us to change it/i)).toBeInTheDocument()
  })

  it('separates saving a draft from publishing it', () => {
    // A greeting is the first thing every customer reads and there is exactly
    // one, so this surface stages rather than going live on keystroke.
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ManageView designData={{ ...ALL, tab: 'profile' }} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Saving a draft changes nothing customers see/i)).toBeInTheDocument()
  })
})

describe('Objection replies tab', () => {
  it('states the trigger as a sentence rather than an editable field', () => {
    renderTab('replies')
    expect(screen.getByText(/This reply fires when someone says “too costly”/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/trigger/i)).not.toBeInTheDocument()
    // What the client DOES own on this row.
    expect(screen.getAllByLabelText(/^Reply$/i).length).toBe(MOCK_RULES.length)
  })
})

describe('Campaigns tab', () => {
  it('gives code words and spend their own save, separate from the details', () => {
    renderTab('campaigns')
    // Three doors, because 069 locks two of this table's columns and each has
    // its own gate behind it.
    expect(screen.getByRole('button', { name: /save details/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save code words/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save spend/i })).toBeInTheDocument()
  })

  it('shows spend in major units from a minor-unit row', () => {
    renderTab('campaigns')
    // 4200000 paise is ₹42,000.
    expect(screen.getByDisplayValue('42000')).toBeInTheDocument()
  })
})

describe('the tab bar', () => {
  it('offers exactly the client-tier sections', () => {
    renderTab('products')
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual([
      'Products',
      'Answers',
      'Profile',
      'Objection replies',
      'Campaigns',
      'Lead sources',
      'Import',
    ])
  })
})
