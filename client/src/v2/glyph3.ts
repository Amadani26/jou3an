/**
 * The 3D "3" — THREE geometry extruded from the Syne wght-800 "3" outline
 * (src/generated/syne-3-glyph.json, written by scripts/extract-glyph3.mjs).
 *
 * Font path commands are y-up in font units (1000 upem), which matches
 * three's y-up world — no flip needed. The geometry is normalised so the
 * glyph is ~1.4 world units tall and centred on its bbox.
 */
import * as THREE from 'three'
import GLYPH from '../generated/syne-3-glyph.json'

interface GlyphCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'
  args: number[]
}

export function buildGlyphGeometry(): THREE.ExtrudeGeometry {
  const path = new THREE.ShapePath()
  for (const c of GLYPH.commands as GlyphCommand[]) {
    const a = c.args
    if (c.command === 'moveTo') path.moveTo(a[0], a[1])
    else if (c.command === 'lineTo') path.lineTo(a[0], a[1])
    else if (c.command === 'quadraticCurveTo') path.quadraticCurveTo(a[0], a[1], a[2], a[3])
    else if (c.command === 'bezierCurveTo') path.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5])
    // closePath: ShapePath closes subpaths implicitly when shapes are built
  }

  // toShapes() sorts outer contours from holes by winding.
  const shapes = path.toShapes()

  const upem = GLYPH.unitsPerEm
  // Premium pass: high curve/bevel segment counts so no facet survives at
  // DPR 2 / 1440 — the glyph is ONE mesh, so the vertex cost is cheap, and
  // the extra bevel segments are what let the studio reflections roll
  // smoothly around the edge instead of stepping.
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: upem * 0.22,
    bevelEnabled: true,
    bevelThickness: upem * 0.03,
    bevelSize: upem * 0.024,
    bevelSegments: 10,
    curveSegments: 28,
  })

  // Normalise: centre on the glyph bbox, scale so the outline is ~1.4 units tall.
  const { minX, maxX, minY, maxY } = GLYPH.bbox
  const h = maxY - minY
  const s = 1.4 / h
  geo.translate(-(minX + maxX) / 2, -(minY + maxY) / 2, -(upem * 0.22) / 2)
  geo.scale(s, s, s)
  return geo
}
