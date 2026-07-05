import * as THREE from 'three'
import { PALETTE, wireMat, glowSprite, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'

// CH1 — EP00, THE PHYSICS YEARS. A particle interference field and an atom
// whose nucleus is the same icosahedron core (the recurring motif). At the
// chapter's end the atom collapses into a wireframe shipping box: physics
// becomes cargo, and the career begins.

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const center = new THREE.Vector3(0, 2, station)

  // ---- standing-wave interference field ----
  const COLS = tier === 2 ? 70 : 44
  const ROWS = tier === 2 ? 34 : 22
  const field = makeDynamicPoints(COLS * ROWS, { color: PALETTE.cyan, size: 0.07, opacity: 0.55 })
  const fpos = field.geometry.attributes.position.array
  group.add(field)

  // ---- the atom ----
  const atom = new THREE.Group()
  const nucleus = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), wireMat(PALETTE.pink, 0.9))
  atom.add(nucleus)
  atom.add(glowSprite(PALETTE.pink, 2.4))
  const shells = []
  const electrons = []
  for (let i = 0; i < 3; i++) {
    const shell = new THREE.Mesh(new THREE.TorusGeometry(2 + i * 0.9, 0.02, 6, 80), wireMat(PALETTE.cyan, 0.5))
    shell.rotation.x = Math.PI / 2
    shell.rotation.y = (i * Math.PI) / 3.2
    atom.add(shell)
    shells.push(shell)
    const e = glowSprite(PALETTE.gold, 0.7)
    atom.add(e)
    electrons.push({ sprite: e, r: 2 + i * 0.9, speed: 1.6 - i * 0.35, phase: i * 2.1, tilt: shell.rotation.y })
  }
  atom.position.copy(center)
  group.add(atom)

  // the grade, floating like a small gold moon
  const grade = glowSprite(PALETTE.gold, 1.4)
  grade.position.set(4.5, 4.2, station - 6)
  group.add(grade)

  // ---- the collapse target: a listing box ----
  const box = new THREE.Group()
  const geo = new THREE.BoxGeometry(1.4, 1, 1.4)
  box.add(new THREE.Mesh(geo, wireMat(PALETTE.cyan, 0.9)))
  box.position.copy(center)
  box.scale.setScalar(0.001)
  group.add(box)

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      // waves ripple with scroll progress so the field feels alive under scrub
      let i = 0
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = (c / (COLS - 1) - 0.5) * 60
          const z = station - 30 + (r / (ROWS - 1)) * 46
          const d1 = Math.hypot(x + 12, z - station + 10)
          const d2 = Math.hypot(x - 12, z - station + 10)
          const y = -3 + Math.sin(d1 * 0.55 - p * 14) * 0.5 + Math.sin(d2 * 0.55 - p * 14) * 0.5
          fpos[i++] = x; fpos[i++] = y; fpos[i++] = z
        }
      }
      field.geometry.attributes.position.needsUpdate = true

      nucleus.rotation.y += 0.5 * dt
      electrons.forEach(e => {
        const a = t * e.speed + e.phase + p * 6
        e.sprite.position.set(
          Math.cos(a) * e.r,
          Math.sin(a) * e.r * Math.sin(e.tilt) * 0.35,
          Math.sin(a) * e.r * Math.cos(e.tilt)
        )
      })

      // collapse beat: atom shrinks into the listing box as the chapter exits
      const collapse = smooth((p - 0.78) / 0.18)
      atom.scale.setScalar(Math.max(0.001, 1 - collapse))
      box.scale.setScalar(Math.max(0.001, collapse))
      box.rotation.y = collapse * 2.2
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
