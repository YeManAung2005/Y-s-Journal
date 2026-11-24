// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HealthPill } from '../../src/client/components/health-pill.jsx'

describe('HealthPill', () => {
  it('shows the healthy state', () => {
    render(<HealthPill state="healthy" />)
    expect(screen.getByText('Operational')).toBeInTheDocument()
  })

  it('shows the offline state', () => {
    render(<HealthPill state="offline" />)
    expect(screen.getByText('API unreachable')).toBeInTheDocument()
  })

  it('falls back to checking for an unknown state', () => {
    render(<HealthPill state="unknown" />)
    expect(screen.getByText('Checking')).toBeInTheDocument()
  })
})
