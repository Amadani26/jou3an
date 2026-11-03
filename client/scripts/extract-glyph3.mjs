/**
 * Extract the Syne ExtraBold "3" glyph outline → src/generated/syne-3-glyph.json
 *
 * The 3D "3" (web v2's persistent hero object) is EXTRUDED FROM OUR OWN BRAND
 * FONT rather than modelled by hand or generated: Syne is OFL-licensed, so the
 * outline is ours to extrude, and the glyph can never drift from the wordmark.
 *
 * The committed woff2 in public/fonts is a hand subset that fontkit's
 * variation API chokes on, so this script pulls the official variable TTF
 * from the google/fonts repo (OFL) into a local cache, instances it at
 * wght 800, and writes the path commands in font units (y-up, 1000 upem).
 * The TTF itself is NOT committed — only the generated JSON is.
 *
 * Run once (or after a font upgrade):  node scripts/extract-glyph3.mjs
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const fontkit = createRequire(import.meta.url)('fontkit')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cache = resolve(root, 'node_modules/.cache/syne-var.ttf')
const out = resolve(root, 'src/generated/syne-3-glyph.json')

const TTF_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/syne/Syne%5Bwght%5D.ttf'

if (!existsSync(cache)) {
  mkdirSync(dirname(cache), { recursive: true })
  execFileSync('curl', ['-sL', TTF_URL, '-o', cache], { stdio: 'inherit' })
}

const font = fontkit.openSync(cache)
const instance = font.getVariation({ wght: 800 })
const glyph = instance.glyphForCodePoint(0x33) // "3"

const data = {
  font: 'Syne wght 800 (OFL)',
  unitsPerEm: font.unitsPerEm,
  advanceWidth: glyph.advanceWidth,
  bbox: glyph.bbox,
  // fontkit commands: {command: 'moveTo'|'lineTo'|'quadraticCurveTo'|'bezierCurveTo'|'closePath', args: [...]}
  commands: glyph.path.commands,
}

writeFileSync(out, JSON.stringify(data))
console.log(
  `[glyph3] wrote ${out}: ${data.commands.length} commands, bbox ${JSON.stringify(data.bbox)}`,
)
