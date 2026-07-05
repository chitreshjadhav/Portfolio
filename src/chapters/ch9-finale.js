import * as THREE from 'three'
import { PALETTE, wireMat, glowSprite, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'

// CH9 — FINALE. A sakura petal storm. Mid-chapter the petals converge to
// trace the rotated-diamond logo mark, then release. The icosahedron core
// rises one last time — the story loops back to its opening shot.

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const center = new THREE.Vector3(0, 4, station)

  const N = tier === 2 ? 1500 : 650
  const petals = makeDynamicPoints(N, { color: PALETTE.sakura, size: 0.14, opacity: 0.85 })
  const ppos = petals.geometry.attributes.position.array
  const seed = new Float32Array(N * 4) // x0, z0, phase, speed
  for (let i = 0; i < N; i++) {
    seed[i * 4] = (Math.random() - 0.5) * 70
    seed[i * 4 + 1] = (Math.random() - 0.5) * 50
    seed[i * 4 + 2] = Math.random() * Math.PI * 2
    seed[i * 4 + 3] = 0.5 + Math.random() * 1.1
  }
  group.add(petals)

  // diamond targets: points along the perimeter of the rotated square
  const diamond = new Float32Array(N * 3)
  const D = 5
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 4
    const edge = Math.floor(t)
    const f = t - edge
    let x = 0, y = 0
    if (edge === 0) { x = f * D; y = (1 - f) * D }
    else if (edge === 1) { x = (1 - f) * D; y = -f * D }
    else if (edge === 2) { x = -f * D; y = -(1 - f) * D }
    else { x = -(1 - f) * D; y = f * D }
    diamond[i * 3] = center.x + x
    diamond[i * 3 + 1] = center.y + y + 2
    diamond[i * 3 + 2] = center.z
  }

  // the core, rising home
  const core = new THREE.Group()
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), wireMat(PALETTE.pink, 0.8)))
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), wireMat(PALETTE.violet, 0.5)))
  const coreGlow = glowSprite(PALETTE.pink, 7)
  group.add(core, coreGlow)

  // distant city shimmer on the horizon — the CH0 skyline, far away
  const horizon = glowSprite(PALETTE.cyan, 40)
  horizon.material.opacity = 0.1
  horizon.position.set(0, 2, station - 60)
  group.add(horizon)

  let active = false

  return {
    group,
    continuous: () => active,
    update(dt, t, p) {
      // converge window: petals trace the logo diamond, then let go
      const converge = smooth((p - 0.42) / 0.12) * (1 - smooth((p - 0.66) / 0.12))
      for (let i = 0; i < N; i++) {
        const ph = seed[i * 4 + 2]
        const sp = seed[i * 4 + 3]
        const fall = ((t * sp * 1.4 + ph * 3) % 26)
        const fx = center.x + seed[i * 4] + Math.sin(t * sp + ph) * 2.2
        const fy = center.y + 14 - fall
        const fz = center.z + seed[i * 4 + 1] + Math.cos(t * sp * 0.7 + ph) * 1.6
        ppos[i * 3] = fx + (diamond[i * 3] - fx) * converge
        ppos[i * 3 + 1] = fy + (diamond[i * 3 + 1] - fy) * converge
        ppos[i * 3 + 2] = fz + (diamond[i * 3 + 2] - fz) * converge
      }
      petals.geometry.attributes.position.needsUpdate = true

      const rise = smooth((p - 0.55) / 0.4)
      core.position.set(0, -2 + rise * 8, station - 4)
      core.rotation.y += dt * 0.4
      core.scale.setScalar(0.4 + rise * 0.6)
      coreGlow.position.copy(core.position)
      coreGlow.material.opacity = 0.3 + rise * 0.5
    },
    setActive(on) { active = on },
    dispose() { disposeGroup(group) }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
