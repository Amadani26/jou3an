import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

const RED = '#E8272A'

async function makeIcon(size, outFile) {
  const fontSize = Math.round(size * 0.6)

  // Render the Arabic letter "jeem" in white using Pango markup.
  const text = await sharp({
    text: {
      text: `<span foreground="#FFFFFF">ج</span>`,
      font: `Geeza Pro Bold ${fontSize}`,
      rgba: true,
      align: 'center',
    },
  })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: RED,
    },
  })
    .composite([{ input: text, gravity: 'center' }])
    .png()
    .toFile(join(publicDir, outFile))

  console.log(`✓ ${outFile} (${size}x${size})`)
}

await makeIcon(192, 'icon-192.png')
await makeIcon(512, 'icon-512.png')
console.log('Done.')
