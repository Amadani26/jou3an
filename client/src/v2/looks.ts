/**
 * THE look — glossy red lacquer (chosen by the owner, 2026-11-03, from the
 * three ?look= candidates; the glass and metal paths were removed with the
 * decision). MeshPhysicalMaterial: deep red body under a hard clearcoat,
 * with an emissive inner glow that the bloom pass turns into the light-up.
 *
 * The scroll story drives it:
 *   ignite  — ch1: the inner glow ramps from ember-dark to lit
 *   flight  — ch2: dims while the 3 recedes down the tunnel
 *   burst   — ch3: the collapse flash (one-shot envelope)
 *   split   — ch4: steps back while the three answers take the stage
 *   taste   — ch5: the lacquer LEARNS — hue warms toward the brand red,
 *             the coat tightens, the glow steadies. Taste made visible.
 */
import * as THREE from 'three'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const LACQUER_BASE = '#7A0202'
export const LACQUER_LEARNED = '#B80E06'

const baseColor = new THREE.Color(LACQUER_BASE)
const learnedColor = new THREE.Color(LACQUER_LEARNED)

export function lacquerProps(): THREE.MeshPhysicalMaterialParameters {
  return {
    color: LACQUER_BASE,
    metalness: 0.05,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.07,
    emissive: '#FE0000',
    emissiveIntensity: 0,
    envMapIntensity: 0.9,
  }
}

export function updateLacquer(
  mat: THREE.MeshPhysicalMaterial,
  s: { ignite: number; flight: number; burst: number; split: number; taste: number },
): void {
  const chapterDim = lerp(1, 0.45, s.flight) * lerp(1, 0.62, s.split)
  mat.emissiveIntensity =
    lerp(0.1, 0.55, s.ignite) * chapterDim + s.burst * 1.8 + s.taste * 0.38
  mat.envMapIntensity = lerp(0.68, 1.1, s.ignite)
  // ch5: the material itself shifts as taste builds
  mat.color.lerpColors(baseColor, learnedColor, s.taste)
  mat.clearcoatRoughness = lerp(0.07, 0.035, s.taste)
  mat.roughness = lerp(0.3, 0.24, s.taste)
}

/** Peak intensity of the red point light that rides with the 3. */
export const RED_LIGHT_PEAK = 14
