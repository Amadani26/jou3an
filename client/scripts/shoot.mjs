import { webkit } from 'playwright'

const URL = process.argv[2] || 'http://localhost:4317/'
const OUT = process.argv[3] || '/tmp/jou3an-audit/baseline'
const TAG = process.argv[4] || 'base'

// iPhone Safari is the primary target: WebKit, three real widths + desktop.
const VIEWPORTS = [
  { name: 'iphone-se-375', width: 375, height: 667, dsf: 2, mobile: true },
  { name: 'iphone-15pro-393', width: 393, height: 852, dsf: 3, mobile: true },
  { name: 'iphone-promax-430', width: 430, height: 932, dsf: 3, mobile: true },
  { name: 'desktop-1440', width: 1440, height: 900, dsf: 2, mobile: false },
]

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const browser = await webkit.launch()
const report = []

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    userAgent: vp.mobile ? IPHONE_UA : undefined,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(1200)

  // Measure horizontal overflow + page height before scrolling.
  const metrics = await page.evaluate(() => {
    const de = document.documentElement
    const over = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > window.innerWidth + 1 || r.left < -1) {
        over.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 60),
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
      }
    }
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      scrollH: de.scrollHeight,
      innerW: window.innerWidth,
      overflowCount: over.length,
      overflow: over.slice(0, 8),
    }
  })

  await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-fold.png` })
  await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-full.png`, fullPage: true })

  report.push({ viewport: vp.name, ...metrics, consoleErrors: errors })
  await ctx.close()
}

await browser.close()
console.log(JSON.stringify(report, null, 2))
