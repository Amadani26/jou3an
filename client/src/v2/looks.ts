/**
 * The three premium material looks for the 3D "3" (?look=1|2|3).
 * All MeshPhysicalMaterial; the scroll story drives each look differently
 * (updateForStory), because "ignition" means something different to glass,
 * metal and lacquer.
 *
 *   1 — dark glass: red light refracting INSIDE (transmission + thickness +
 *       IOR + red attenuation that deepens as it ignites), clearcoat shell
 *   2 — polished dark metal: near-black chrome that picks up the studio
 *       panels; ignition arrives as red reflections (rim light + red
 *       lightformer), not as self-glow
 *   3 — glossy red lacquer: deep red clearcoat body with an emissive inner
 *       glow that the bloom pass turns into the light-up
 */
import * as THREE from 'three'

export type LookId = '1' | '2' | '3'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function materialPropsFor(look: LookId): THREE.MeshPhysicalMaterialParameters {
  switch (look) {
    case '1':
      return {
        color: '#0b0b0d',
        transmission: 1,
        thickness: 1.35,
        ior: 1.5,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        attenuationColor: '#FE0000',
        attenuationDistance: 6,
        emissive: '#FE0000',
        emissiveIntensity: 0,
        envMapIntensity: 1,
      }
    case '2':
      return {
        color: '#17171a',
        metalness: 1,
        roughness: 0.16,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        emissive: '#FE0000',
        emissiveIntensity: 0,
        envMapIntensity: 0.5,
      }
    case '3':
    default:
      return {
        color: '#7A0202',
        metalness: 0.05,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.07,
        emissive: '#FE0000',
        emissiveIntensity: 0,
        envMapIntensity: 0.9,
      }
  }
}

/** Per-frame story drive: ignite ∈ [0,1] (ch1 ramp), flight ∈ [0,1] (ch2
 *  recede), burst ∈ [0,1] (ch3 flash bell). Mutates the material. */
export function updateForStory(
  look: LookId,
  mat: THREE.MeshPhysicalMaterial,
  ignite: number,
  flight: number,
  burst: number,
): void {
  if (look === '1') {
    // Glass ignites from clear-and-dark to red-saturated: the attenuation
    // distance closes in, so light travelling inside turns red.
    mat.attenuationDistance = lerp(6, 0.45, ignite)
    mat.emissiveIntensity = 0.12 * ignite * (1 - flight * 0.6) + burst * 1.6
    mat.envMapIntensity = lerp(0.6, 1.2, ignite)
  } else if (look === '2') {
    // Metal never self-glows (except the burst flash): ignition is the
    // studio waking up around it — rising env + the red point light.
    mat.envMapIntensity = lerp(0.35, 1.5, ignite) * (1 - flight * 0.3)
    mat.emissiveIntensity = burst * 1.1
  } else {
    // Lacquer: inner glow. Kept below blowout — the bloom pass does the rest.
    mat.emissiveIntensity = lerp(0.02, 0.55, ignite) * lerp(1, 0.45, flight) + burst * 1.8
    mat.envMapIntensity = lerp(0.5, 1.1, ignite)
  }
}

/** The red point light's peak intensity differs per look: glass carries the
 *  light inside, metal wants a stronger red to mirror, lacquer sits between. */
export function redLightScale(look: LookId): number {
  return look === '2' ? 22 : look === '1' ? 12 : 14
}
