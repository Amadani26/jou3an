/**
 * Canvas-drawn textures for the tunnel's restaurant cards.
 *
 * REAL DATA ONLY (the page-wide rule): real name, cuisine · area, and the
 * real Google rating with attribution — or no score line at all. No photos
 * in the tunnel (they'd cost 40+ texture fetches for cards that are on
 * screen for a second); the cuisine tone field does the colour work,
 * exactly like the problem wall's live cards.
 *
 * 14 unique textures (one per wall row), shared across all tunnel meshes.
 */
import * as THREE from 'three'
import type { LivePick } from '../lib/live'
import { cuisineTone } from '../lib/live'

const W = 512
const H = 288

export function makeCardTexture(pick: LivePick): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Card ground + a cuisine-toned field on top, like the wall's live cards.
  ctx.fillStyle = '#121212'
  ctx.fillRect(0, 0, W, H)
  const tone = cuisineTone(pick.cuisine)
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, tone + 'E6')
  grad.addColorStop(1, '#101010')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H * 0.52)
  ctx.strokeStyle = '#2E2E2E'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, W - 4, H - 4)

  // Name (up to 2 lines), DM Sans is already loaded by the page.
  ctx.fillStyle = '#F2EDE8'
  ctx.font = '700 34px "DM Sans Variable", "DM Sans", sans-serif'
  ctx.textBaseline = 'top'
  const words = pick.name.split(' ')
  let line = ''
  let y = H * 0.56
  let lines = 0
  for (const w of words) {
    const probe = line ? line + ' ' + w : w
    if (ctx.measureText(probe).width > W - 56 && line) {
      ctx.fillText(line, 28, y)
      y += 42
      lines++
      line = w
      if (lines === 2) { line = ''; break }
    } else line = probe
  }
  if (line) { ctx.fillText(line, 28, y); y += 42 }

  // cuisine · area
  ctx.fillStyle = '#8A847E'
  ctx.font = '500 24px "DM Sans Variable", "DM Sans", sans-serif'
  ctx.fillText(`${pick.cuisine} · ${pick.area}`, 28, y + 4)

  // Real rating with attribution, or nothing (null is a real answer).
  if (pick.rating != null) {
    ctx.fillStyle = '#FFB547'
    ctx.font = '600 24px "DM Sans Variable", "DM Sans", sans-serif'
    ctx.fillText(`★ ${pick.rating.toFixed(1)} · Google`, 28, y + 40)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 2
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const PW = 512
const PH = 232

/** Wider, rank-carrying texture for the three ANSWER cards (ch4's orbit).
 *  Same no-invented-data rules as the tunnel cards; the matching HTML card
 *  takes over at the handoff, so this face only needs to read mid-flight. */
export function makePickTexture(pick: LivePick, rank: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = PW
  canvas.height = PH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, PW, PH)
  const tone = cuisineTone(pick.cuisine)
  const grad = ctx.createLinearGradient(0, 0, PW, 0)
  grad.addColorStop(0, tone + 'B3')
  grad.addColorStop(0.55, '#121212')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, PW, PH)
  ctx.strokeStyle = '#2E2E2E'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, PW - 4, PH - 4)

  // rank numeral, brand red
  ctx.fillStyle = '#FE0000'
  ctx.font = '800 64px "Syne Variable", Syne, sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(String(rank), 26, 20)

  ctx.fillStyle = '#F2EDE8'
  ctx.font = '700 30px "DM Sans Variable", "DM Sans", sans-serif'
  const name = pick.name.length > 26 ? pick.name.slice(0, 25).trimEnd() + '…' : pick.name
  ctx.fillText(name, 92, 34)

  ctx.fillStyle = '#8A847E'
  ctx.font = '500 22px "DM Sans Variable", "DM Sans", sans-serif'
  ctx.fillText(`${pick.cuisine} · ${pick.area}`, 92, 76)

  if (pick.rating != null) {
    ctx.fillStyle = '#FFB547'
    ctx.font = '600 22px "DM Sans Variable", "DM Sans", sans-serif'
    ctx.fillText(`★ ${pick.rating.toFixed(1)} · Google`, 92, 110)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 2
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
