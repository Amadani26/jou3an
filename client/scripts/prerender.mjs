/**
 * Prerender "/" into dist/index.html, post-build.
 *
 * WHY: the page is a client-rendered SPA, so its LCP has always been "wait
 * for React to boot" — 84% of the LCP was render delay in every audit. This
 * puts the hero's real HTML in the document so it paints on first byte.
 *
 * HOW: pure node, no browsers — `vite build --ssr src/entry-server.tsx`
 * compiles the app into one node module (same React instance throughout),
 * and this script renders it and injects the markup into the built
 * index.html's #root. Runs as part of `npm run build`, so Vercel gets it
 * with no extra configuration.
 *
 * THE CLIENT STILL BOOTS WITH createRoot (replace), NOT hydrateRoot — on
 * purpose. Several components intentionally render differently with a DOM
 * present (useReveal starts "shown" where IntersectionObserver is missing,
 * the screen loop starts at a timer-driven phase), so hydration would log
 * mismatches and stitch half-states together. A replace of identical layout
 * costs no CLS and keeps every component honest. The prerender is paint-first
 * content, not a hydration contract.
 *
 * Lazy sections render their Suspense fallbacks (fixed-height reservations),
 * which is exactly what the client's first render produces too.
 *
 * Only "/" is prerendered: /privacy and /terms are reading pages reached by
 * navigation; prerendering them would need per-route files plus server
 * config — complication for no LCP story.
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ssrOut = resolve(root, 'dist-ssr')

await build({
  root,
  logLevel: 'error',
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-ssr',
    emptyOutDir: true,
  },
})

const { render } = await import(resolve(ssrOut, 'entry-server.js'))
const html = render('/')

const file = resolve(root, 'dist/index.html')
const doc = readFileSync(file, 'utf8')
const marker = '<div id="root"></div>'
if (!doc.includes(marker)) {
  throw new Error('dist/index.html has no empty #root — already prerendered?')
}
writeFileSync(file, doc.replace(marker, `<div id="root">${html}</div>`))
rmSync(ssrOut, { recursive: true, force: true })
console.log(`[prerender] / -> dist/index.html (+${(html.length / 1024).toFixed(1)} KB of markup)`)
