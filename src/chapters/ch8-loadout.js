import * as THREE from 'three'
import { PALETTE, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'
import { SKILLS } from '../content/resume.js'

// CH8 — LOADOUT. The recovery beat: a dim skill constellation drifting in a
// starfield. Four gold stars mark the certifications. Mostly a DOM chapter —
// the world breathes out here.

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const center = new THREE.Vector3(0, 3, station)
  const cluster = new THREE.Group()
  cluster.position.copy(center)
  group.add(cluster)

  const stars = []
  SKILLS.forEach((skill, i) => {
    // a loose spiral shell so labels rarely overlap
    const a = i * 2.39996 // golden angle
    const r = 6 + (i % 5) * 2.2
    const y = ((i % 7) - 3) * 1.7
    const star = glowSprite(i % 4 === 0 ? PALETTE.pink : PALETTE.cyan, 0.9)
    star.position.set(Math.cos(a) * r, y, Math.sin(a) * r * 0.6)
    cluster.add(star)
    const label = textSprite(skill, { color: '#a6acd1', px: 22, font: 'Rajdhani' })
    label.position.copy(star.position).add(new THREE.Vector3(0, 0.9, 0))
    label.material.opacity = 0.75
    cluster.add(label)
    stars.push(star.position)
  })

  // constellation lines between neighbors
  const verts = []
  for (let i = 0; i < stars.length; i++) {
    let best = -1, bd = Infinity
    for (let j = 0; j < stars.length; j++) {
      if (i === j) continue
      const d = stars[i].distanceToSquared(stars[j])
      if (d < bd) { bd = d; best = j }
    }
    if (best > i) verts.push(...stars[i].toArray(), ...stars[best].toArray())
  }
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
  cluster.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
    color: 0x3a4a9f, transparent: true, opacity: 0.4
  })))

  // certification stars — gold, brighter, above the cloud
  for (let i = 0; i < 4; i++) {
    const gold = glowSprite(PALETTE.gold, 1.6)
    gold.position.set(-6 + i * 4, 9.5, -2)
    cluster.add(gold)
  }

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      cluster.rotation.y = p * 0.9 + t * 0.008
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}
