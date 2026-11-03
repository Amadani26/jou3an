import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { Shell } from './App'

/**
 * SSR entry for scripts/prerender.mjs — built with `vite build --ssr` so
 * React, the router and the app all come from ONE compiled module graph
 * (loading the app through vite while taking react-dom/server from node
 * splits React into two instances and breaks hooks).
 */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <Shell />
    </StaticRouter>,
  )
}
