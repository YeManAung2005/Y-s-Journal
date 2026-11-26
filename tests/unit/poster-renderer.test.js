import { describe, expect, it } from 'vitest'
import { POSTER_DIMENSIONS, POSTER_TEMPLATES } from '../../src/server/services/poster-service.js'
import {
  drawPoster,
  formatValue,
  posterFileName,
  wrapLines,
} from '../../src/client/features/posters/poster-renderer.js'

function createContext(width = 1080, height = 1080) {
  const text = []
  const context = {
    canvas: { width, height },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    clearRect() {},
    save() {},
    restore() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    fillText(value) {
      text.push(String(value))
    },
    measureText(value) {
      return { width: String(value).length * 9 }
    },
    createRadialGradient() {
      return { addColorStop() {} }
    },
  }
  return { context, text }
}

const config = {
  name: 'Focus poster',
  type: 'trading',
  template: 'midnight',
  dimension: 'square',
  accentColor: '#8b5cf6',
  headline: 'Discipline pays',
  subtitle: 'A focused month',
  footer: 'Private review',
  logoPosition: 'top-left',
  days: 30,
  basis: 'gross',
}

const data = {
  type: 'trading',
  from: '2026-10-28',
  to: '2026-11-26',
  days: 30,
  basis: 'gross',
  title: 'Trading performance',
  metrics: [
    { id: 'trades', label: 'Trades', kind: 'integer', value: 24 },
    { id: 'pnl', label: 'Gross P&L', kind: 'money', value: 1240500000 },
    { id: 'winRate', label: 'Win rate', kind: 'percent', value: '0.54' },
    { id: 'averageR', label: 'Average R', kind: 'multiple', value: '1.8' },
  ],
  note: null,
}

describe('poster renderer', () => {
  it('draws each template and dimension without throwing', () => {
    for (const template of POSTER_TEMPLATES) {
      for (const dimension of POSTER_DIMENSIONS) {
        const { context, text } = createContext(dimension.width, dimension.height)
        expect(() => drawPoster(context, { config, data, template, dimension })).not.toThrow()
        expect(text).toContain('Discipline pays')
        expect(text).toContain('Private review')
        expect(text).toContain('TRADES')
        expect(text).toContain('$1,240.50')
      }
    }
  })

  it('renders a single-trade ROI poster with its own subtitle and percent ROI', () => {
    const tradeData = {
      type: 'trade',
      from: '2026-11-26',
      to: '2026-11-26',
      days: 1,
      basis: 'net',
      title: 'NQ Long',
      subtitle: 'Nov 26, 2026 · Entry 25000 → Exit 25010 · 1 qty',
      metrics: [
        { id: 'roi', label: 'ROI on risk', kind: 'percent', value: '0.975' },
        { id: 'pnl', label: 'Net P&L', kind: 'money', value: 195000000 },
        { id: 'r', label: 'R multiple', kind: 'multiple', value: '0.975' },
        { id: 'risk', label: 'Risked', kind: 'money', value: 200000000 },
      ],
      note: null,
    }

    const { context, text } = createContext()
    drawPoster(context, {
      config: { ...config, headline: '', subtitle: '', footer: '' },
      data: tradeData,
      template: POSTER_TEMPLATES[0],
      dimension: POSTER_DIMENSIONS[0],
    })

    expect(text).toContain('NQ Long')
    expect(text).toContain('Nov 26, 2026 · Entry 25000 → Exit 25010 · 1 qty')
    expect(text).toContain('ROI ON RISK')
    expect(text).toContain('97.5%')
    expect(text).toContain('$195.00')
    expect(text).toContain('$200.00')
  })

  it('shows unavailable ROI without inventing a value', () => {
    expect(formatValue({ kind: 'percent', value: null })).toBe('—')
    expect(formatValue({ kind: 'money', value: null })).toBe('Unavailable')
  })

  it('formats unavailable and null values without inventing zeroes', () => {
    expect(formatValue({ kind: 'money', value: null })).toBe('Unavailable')
    expect(formatValue({ kind: 'percent', value: null })).toBe('—')
    expect(formatValue({ kind: 'minutes', value: 45 })).toBe('45 min')
    expect(formatValue({ kind: 'days', value: 3 })).toBe('3 days')
  })

  it('wraps and truncates long text', () => {
    const { context } = createContext()
    context.font = '700 40px sans-serif'
    const lines = wrapLines(context, 'One two three four five six seven eight', 120, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })

  it('builds safe PNG file names', () => {
    expect(posterFileName({ name: '  Focus / Poster  ' })).toBe('focus-poster.png')
    expect(posterFileName({ name: '***' })).toBe('poster.png')
  })
})
