import {
  formatInteger,
  formatMoney,
  formatMultiple,
  formatPercent,
} from '@/features/analytics/analytics-format'

const FONT_SANS = '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif'
const FONT_MONO = '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace'

function hexToRgba(hex, alpha) {
  const value = String(hex).replace('#', '')
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : value
  const number = Number.parseInt(normalized, 16)
  if (Number.isNaN(number)) return `rgba(139, 92, 246, ${alpha})`
  const red = (number >> 16) & 255
  const green = (number >> 8) & 255
  const blue = number & 255
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, r)
    return
  }

  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function truncateWithEllipsis(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value.trimEnd()}…`
}

function wrapLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return []

  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word

    if (lines.length === maxLines) break
  }

  if (lines.length < maxLines && current) {
    lines.push(current)
  } else if (lines.length === maxLines && current) {
    lines[maxLines - 1] = truncateWithEllipsis(ctx, `${lines[maxLines - 1]}…`, maxWidth)
  }

  return lines.slice(0, maxLines)
}

function formatRange(from, to) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${formatter.format(new Date(`${from}T00:00:00Z`))} – ${formatter.format(
    new Date(`${to}T00:00:00Z`),
  )}`
}

function formatValue(metric) {
  if (metric.value === null || metric.value === undefined) {
    return metric.kind === 'money' ? 'Unavailable' : '—'
  }

  switch (metric.kind) {
    case 'money':
      return formatMoney(metric.value)
    case 'percent':
      return formatPercent(metric.value)
    case 'multiple':
      return formatMultiple(metric.value)
    case 'minutes':
      return `${formatInteger(metric.value)} min`
    case 'days':
      return `${formatInteger(metric.value)} days`
    default:
      return formatInteger(metric.value)
  }
}

function valueColor(metric, palette) {
  if (
    !['money', 'percent', 'multiple'].includes(metric.kind) ||
    metric.value === null ||
    metric.value === undefined
  ) {
    return palette.foreground
  }
  const numeric = Number(metric.value)
  if (!Number.isFinite(numeric)) return palette.foreground
  if (numeric > 0) return palette.background === '#f6f3ec' ? '#15803d' : '#4ade80'
  if (numeric < 0) return palette.background === '#f6f3ec' ? '#dc2626' : '#f87171'
  return palette.foreground
}

function drawBackground(ctx, width, height, palette, accent) {
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)

  const topGlow = ctx.createRadialGradient(
    width * 0.82,
    height * 0.08,
    0,
    width * 0.82,
    height * 0.08,
    width * 0.78,
  )
  topGlow.addColorStop(0, hexToRgba(accent, 0.26))
  topGlow.addColorStop(1, hexToRgba(accent, 0))
  ctx.fillStyle = topGlow
  ctx.fillRect(0, 0, width, height)

  const bottomGlow = ctx.createRadialGradient(
    width * 0.12,
    height * 0.92,
    0,
    width * 0.12,
    height * 0.92,
    width * 0.62,
  )
  bottomGlow.addColorStop(0, hexToRgba(palette.glow, 0.14))
  bottomGlow.addColorStop(1, hexToRgba(palette.glow, 0))
  ctx.fillStyle = bottomGlow
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = hexToRgba(palette.border, 0.42)
  ctx.lineWidth = 1
  const step = Math.round(width / 12)
  for (let x = step; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
    ctx.stroke()
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
    ctx.stroke()
  }
}

function drawBrandBadge(ctx, x, y, size, palette, accent) {
  roundedRect(ctx, x, y, size, size, size * 0.24)
  ctx.fillStyle = accent
  ctx.fill()

  ctx.fillStyle = palette.background
  ctx.font = `800 ${Math.round(size * 0.42)}px ${FONT_SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('YJ', x + size / 2, y + size / 2 + 1)
}

function drawHeader(ctx, { width, margin, palette, accent, logoPosition }) {
  const badgeSize = Math.round(width * 0.06)
  const badgeGap = Math.round(width * 0.022)
  const textX = margin
  const textY = margin + Math.round(width * 0.012)

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.foreground
  ctx.font = `700 ${Math.round(width * 0.019)}px ${FONT_SANS}`
  ctx.fillText("Y'S JOURNAL", textX, textY + badgeSize * 0.52)

  ctx.fillStyle = palette.muted
  ctx.font = `600 ${Math.round(width * 0.011)}px ${FONT_SANS}`
  ctx.fillText('PRIVATE WORKSPACE', textX, textY + badgeSize * 0.88)

  if (logoPosition === 'none') return

  if (logoPosition === 'top-left') {
    drawBrandBadge(
      ctx,
      textX + ctx.measureText('PRIVATE WORKSPACE').width + badgeGap * 1.6,
      margin,
      badgeSize,
      palette,
      accent,
    )
    return
  }

  const x =
    logoPosition === 'top-right' || logoPosition === 'bottom-right'
      ? width - margin - badgeSize
      : margin
  const footerLineY = ctx.canvas.height - margin - Math.round(width * 0.045)
  const y =
    logoPosition === 'bottom-left' || logoPosition === 'bottom-right'
      ? footerLineY - badgeSize - Math.round(width * 0.02)
      : margin
  drawBrandBadge(ctx, x, y, badgeSize, palette, accent)
}

function drawTextBlock(ctx, { data, config, width, height, margin, palette, accent }) {
  const contentWidth = width - margin * 2
  const isStory = height / width > 1.5
  const headlineSize = Math.round(width * (isStory ? 0.076 : 0.07))
  const headline = config.headline?.trim() || data.title
  const subtitle =
    config.subtitle?.trim() ||
    data.subtitle ||
    `${formatRange(data.from, data.to)} · ${formatInteger(data.days)} days`

  const barY = Math.round(height * (isStory ? 0.16 : 0.145))
  ctx.fillStyle = accent
  roundedRect(ctx, margin, barY, Math.round(width * 0.06), Math.round(width * 0.006), 99)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.foreground
  ctx.font = `700 ${headlineSize}px ${FONT_SANS}`
  const headlineLines = wrapLines(ctx, headline, contentWidth, 2)
  let y = barY + headlineSize + Math.round(width * 0.035)
  for (const line of headlineLines) {
    ctx.fillText(line, margin, y)
    y += headlineSize * 1.08
  }

  ctx.fillStyle = palette.muted
  ctx.font = `500 ${Math.round(width * 0.026)}px ${FONT_SANS}`
  const subtitleLines = wrapLines(ctx, subtitle, contentWidth, 2)
  y += Math.round(width * 0.004)
  for (const line of subtitleLines) {
    ctx.fillText(line, margin, y)
    y += Math.round(width * 0.032)
  }

  if (data.note) {
    ctx.fillStyle = hexToRgba(accent, 0.9)
    ctx.font = `600 ${Math.round(width * 0.018)}px ${FONT_SANS}`
    const noteLines = wrapLines(ctx, data.note, contentWidth, 2)
    for (const line of noteLines) {
      ctx.fillText(line, margin, y)
      y += Math.round(width * 0.024)
    }
  }
}

function drawMetricCard(ctx, { metric, x, y, width, height, palette, accent }) {
  const padding = Math.round(width * 0.07)
  const radius = Math.round(width * 0.045)

  roundedRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = palette.panel
  ctx.fill()
  ctx.strokeStyle = hexToRgba(palette.border, 0.95)
  ctx.lineWidth = Math.max(1, Math.round(width * 0.002))
  ctx.stroke()

  ctx.fillStyle = accent
  roundedRect(
    ctx,
    x + padding,
    y + padding,
    Math.round(width * 0.09),
    Math.round(width * 0.008),
    99,
  )
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.muted
  ctx.font = `700 ${Math.round(width * 0.04)}px ${FONT_SANS}`
  ctx.fillText(metric.label.toUpperCase(), x + padding, y + padding + Math.round(height * 0.18))

  const value = formatValue(metric)
  let valueSize = Math.round(width * 0.11)
  const maxValueWidth = width - padding * 2
  do {
    ctx.font = `700 ${valueSize}px ${FONT_MONO}`
    if (ctx.measureText(value).width <= maxValueWidth) break
    valueSize -= 2
  } while (valueSize > 24)

  ctx.fillStyle = valueColor(metric, palette)
  ctx.fillText(value, x + padding, y + height - padding - Math.round(height * 0.04))
}

function drawMetrics(ctx, { data, width, height, margin, palette, accent }) {
  const contentWidth = width - margin * 2
  const isStory = height / width > 1.5
  const isPortrait = height > width
  const top = Math.round(height * (isStory ? 0.45 : isPortrait ? 0.43 : 0.425))
  const blockHeight = Math.round(height * (isStory ? 0.28 : 0.3))
  const gap = Math.round(width * 0.026)
  const cardWidth = (contentWidth - gap) / 2
  const cardHeight = (blockHeight - gap) / 2
  const metrics = data.metrics.slice(0, 4)

  metrics.forEach((metric, index) => {
    const column = index % 2
    const row = Math.floor(index / 2)
    drawMetricCard(ctx, {
      metric,
      x: margin + column * (cardWidth + gap),
      y: top + row * (cardHeight + gap),
      width: cardWidth,
      height: cardHeight,
      palette,
      accent,
    })
  })
}

function drawFooter(ctx, { data, config, width, height, margin, palette }) {
  const lineY = height - margin - Math.round(width * 0.045)
  ctx.strokeStyle = hexToRgba(palette.border, 0.9)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin, lineY + 0.5)
  ctx.lineTo(width - margin, lineY + 0.5)
  ctx.stroke()

  const footer = config.footer?.trim() || 'Private by design · Generated locally'
  const asOf = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${data.to}T00:00:00Z`))

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = palette.muted
  ctx.font = `500 ${Math.round(width * 0.017)}px ${FONT_SANS}`
  ctx.fillText(footer, margin, height - margin)

  ctx.textAlign = 'right'
  ctx.fillText(`As of ${asOf}`, width - margin, height - margin)
}

export function drawPoster(ctx, { config, data, template, dimension }) {
  const width = dimension.width
  const height = dimension.height
  const palette = template.palette
  const accent = config.accentColor || palette.glow
  const margin = Math.round(width * 0.075)

  ctx.clearRect(0, 0, width, height)
  ctx.save()
  drawBackground(ctx, width, height, palette, accent)
  drawHeader(ctx, { width, margin, palette, accent, logoPosition: config.logoPosition })
  drawTextBlock(ctx, { data, config, width, height, margin, palette, accent })
  drawMetrics(ctx, { data, width, height, margin, palette, accent })
  drawFooter(ctx, { data, config, width, height, margin, palette })
  ctx.restore()
}

export function posterFileName(config) {
  const base = String(config.name || 'poster')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'poster'}.png`
}

export async function exportPosterPng(canvas, fileName) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The poster could not be exported as a PNG.')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { formatRange, formatValue, wrapLines }
