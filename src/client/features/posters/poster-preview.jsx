import { useEffect } from 'react'
import { drawPoster } from './poster-renderer'

export function PosterPreview({ canvasRef, config, data, template, dimension }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data || !template || !dimension) return

    canvas.width = dimension.width
    canvas.height = dimension.height
    const context = canvas.getContext('2d')
    if (!context) return

    let cancelled = false
    const render = () => {
      if (cancelled) return
      drawPoster(context, { config, data, template, dimension })
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(render).catch(render)
    } else {
      render()
    }

    return () => {
      cancelled = true
    }
  }, [canvasRef, config, data, template, dimension])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${config.name || 'Poster'} live preview`}
      className="mx-auto h-auto max-h-[68vh] w-auto max-w-full rounded-xl border border-border/70 shadow-[0_24px_70px_-36px_rgb(0_0_0/1)]"
    />
  )
}
