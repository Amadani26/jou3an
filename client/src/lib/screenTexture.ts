/**
 * Canvas-drawn textures for the 3D hero: the app's results screen and the
 * floating result cards, rendered in the app's real design language with
 * GENERIC content.
 *
 * Why drawn and not photographed: the real app screens carry Google Places
 * photography and real restaurant names, which the zero-risk rule keeps out
 * of marketing. These are our own pixels — the app's visual system (dark
 * ground, #111 cards, red rank numerals, reason pills) applied to generic
 * dishes — so the texture is faithful to the product without borrowing
 * anyone's content. Drawing happens once, after the page fonts are ready, so
 * Syne and DM Sans render on the texture exactly as they do on the page.
 */
import { DISHES, SURVIVOR_INDEXES, SURVIVOR_REASONS } from './dishes'

const RED = '#FE0000'
const INK = '#F2EDE8'
const MUTED = '#8A847E'

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Subtle two-tone field standing in for the card's photo slot. */
function toneField(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: string, r: number) {
  rr(ctx, x, y, w, h, r)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = tone
  ctx.globalAlpha = 0.32
  ctx.fillRect(x, y, w, h)
  ctx.globalAlpha = 0.16
  ctx.fillStyle = '#000'
  // A diagonal cut gives the field some composition without pretending to be a photo.
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x + w, y + h * 0.25)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * The results screen, 512x1061 (the device face's aspect) at 1x — crisp on the
 * phone mesh at any size it renders on a 393pt screen.
 */
export function drawResultsScreen(): HTMLCanvasElement {
  const W = 512
  const H = 1061
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  ctx.fillStyle = '#080808'
  ctx.fillRect(0, 0, W, H)

  // Header
  ctx.fillStyle = MUTED
  ctx.font = '600 20px "DM Sans", sans-serif'
  ctx.fillText('×', 36, 74)
  ctx.fillStyle = RED
  ctx.font = '700 15px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('D E C I D E D   F O R   Y O U', W / 2, 70)
  ctx.fillStyle = INK
  ctx.font = '700 24px "DM Sans", sans-serif'
  ctx.fillText('Nearby · Lebanese · Casual', W / 2, 108)
  ctx.textAlign = 'left'

  // Three cards
  const cardX = 26
  const cardW = W - 52
  let y = 140
  const cardH = 262
  for (let i = 0; i < 3; i++) {
    const d = DISHES[SURVIVOR_INDEXES[i]]
    rr(ctx, cardX, y, cardW, cardH, 18)
    ctx.fillStyle = '#111111'
    ctx.fill()

    toneField(ctx, cardX, y, cardW, 150, d.tone, 18)
    // square off the field's bottom corners
    ctx.fillStyle = '#111111'
    ctx.fillRect(cardX, y + 132, cardW, 18)

    // rank
    ctx.fillStyle = RED
    ctx.font = '800 56px "Syne", sans-serif'
    ctx.fillText(String(i + 1), cardX + 22, y + 138)
    // our own score chip, top right of the field
    const chipW = 64
    rr(ctx, cardX + cardW - chipW - 16, y + 16, chipW, 30, 15)
    ctx.fillStyle = 'rgba(8,8,8,0.72)'
    ctx.fill()
    ctx.fillStyle = INK
    ctx.font = '700 17px "DM Sans", sans-serif'
    ctx.fillText(d.score.toFixed(1), cardX + cardW - chipW + 2, y + 37)

    ctx.fillStyle = INK
    ctx.font = '700 23px "DM Sans", sans-serif'
    ctx.fillText(d.dish, cardX + 22, y + 186)
    ctx.fillStyle = MUTED
    ctx.font = '400 17px "DM Sans", sans-serif'
    ctx.fillText(`${d.cuisine} · ${d.area} · ${d.price}`, cardX + 22, y + 214)

    const reason = SURVIVOR_REASONS[i]
    ctx.font = '600 15px "DM Sans", sans-serif'
    const rw = ctx.measureText(reason).width + 28
    rr(ctx, cardX + 22, y + 228, rw, 26, 13)
    ctx.fillStyle = 'rgba(254,0,0,0.14)'
    ctx.fill()
    ctx.fillStyle = RED
    ctx.fillText(reason, cardX + 36, y + 246)

    y += cardH + 18
  }

  // Footer hint
  ctx.fillStyle = '#555'
  ctx.font = '400 15px "DM Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Tap to select · Hold for details', W / 2, y + 26)
  ctx.textAlign = 'left'

  return c
}

/**
 * One floating result card, 460x172 at 1x — drawn big enough that the closest
 * card in the scene still resolves crisply at dpr 2.
 */
export function drawFloatCard(index: number): HTMLCanvasElement {
  const d = DISHES[SURVIVOR_INDEXES[index]]
  const W = 460
  const H = 172
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  rr(ctx, 0, 0, W, H, 26)
  ctx.fillStyle = '#121212'
  ctx.fill()
  rr(ctx, 1, 1, W - 2, H - 2, 25)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 2
  ctx.stroke()

  // rank panel
  toneField(ctx, 18, 18, 104, H - 36, d.tone, 16)
  ctx.fillStyle = RED
  ctx.font = '800 52px "Syne", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(index + 1), 70, H / 2 + 18)
  ctx.textAlign = 'left'

  ctx.fillStyle = INK
  ctx.font = '700 28px "DM Sans", sans-serif'
  ctx.fillText(d.dish, 142, 62)
  ctx.fillStyle = MUTED
  ctx.font = '400 20px "DM Sans", sans-serif'
  ctx.fillText(`${d.cuisine} · ${d.area}`, 142, 94)

  const reason = SURVIVOR_REASONS[index]
  ctx.font = '600 18px "DM Sans", sans-serif'
  const rw = Math.min(ctx.measureText(reason).width + 32, W - 160)
  rr(ctx, 142, 112, rw, 34, 17)
  ctx.fillStyle = 'rgba(254,0,0,0.15)'
  ctx.fill()
  ctx.fillStyle = RED
  ctx.fillText(reason, 158, 135)

  return c
}

/** Soft radial glow sprite — bloom without a postprocessing pass. */
export function drawGlow(): HTMLCanvasElement {
  const S = 256
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(254,0,0,0.55)')
  g.addColorStop(0.45, 'rgba(254,0,0,0.16)')
  g.addColorStop(1, 'rgba(254,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return c
}
