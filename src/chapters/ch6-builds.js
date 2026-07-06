import * as THREE from 'three'
import { PALETTE, wireMat, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'
import { PROJECTS } from '../content/resume.js'

// CH6 — SIDE QUESTS. An n8n-style node constellation: four project stations
// wired into a glowing graph, pulses travelling the edges, a gold Gemini
// octahedron at the heart.

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const center = new THREE.Vector3(0, 3, station)

  // four project stations at the compass points
  const stations = []
  const COLORS = [PALETTE.gold, PALETTE.cyan, PALETTE.pink, PALETTE.violet]
  const HEXCOLORS = ['#ffe14d', '#4fe3ff', '#ffb31e', '#8b5cf6']
  PROJECTS.forEach((proj, i) => {
    const a = (i / PROJECTS.length) * Math.PI * 2 + Math.PI / 4
    const node = new THREE.Group()
    node.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), wireMat(COLORS[i], 0.9)))
    node.add(glowSprite(COLORS[i], 2.6))
    const name = textSprite(proj.name, { color: HEXCOLORS[i], px: 30 })
    name.position.y = 2.2
    node.add(name)
    const tag = textSprite(proj.tag, { color: '#a6acd1', px: 20, font: 'Rajdhani' })
    tag.position.y = 1.5
    node.add(tag)
    node.position.set(center.x + Math.cos(a) * 10, center.y + Math.sin(i * 1.7) * 2, center.z + Math.sin(a) * 10)
    group.add(node)
    stations.push(node)
  })

  // the Gemini spark
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), wireMat(PALETTE.gold, 0.95))
  gem.position.copy(center)
  group.add(gem)
  const gemGlow = glowSprite(PALETTE.gold, 4.5)
  gemGlow.position.copy(center)
  group.add(gemGlow)

  // satellite nodes + edges
  const sats = []
  const SAT = tier === 2 ? 10 : 6
  for (let i = 0; i < SAT; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), wireMat(PALETTE.cyan, 0.6))
    s.position.set(
      center.x + (Math.random() - 0.5) * 26,
      center.y + (Math.random() - 0.5) * 9,
      center.z + (Math.random() - 0.5) * 22
    )
    group.add(s)
    sats.push(s)
  }

  const edgeEnds = []
  const edgeVerts = []
  const allNodes = [...stations.map(s => s.position), ...sats.map(s => s.position)]
  allNodes.forEach(p => {
    edgeVerts.push(center.x, center.y, center.z, p.x, p.y, p.z)
    edgeEnds.push(p)
  })
  // a few cross-links between neighbors for the mesh feel
  for (let i = 0; i < sats.length - 1; i++) {
    if (Math.random() < 0.6) {
      const a = sats[i].position, b = sats[i + 1].position
      edgeVerts.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
  }
  const edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeVerts), 3))
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
    color: 0x3a4a9f, transparent: true, opacity: 0.55
  }))
  group.add(edges)

  // pulses that travel hub → node forever
  const pulses = []
  const PULSES = tier === 2 ? 18 : 9
  for (let i = 0; i < PULSES; i++) {
    const spr = glowSprite([PALETTE.cyan, PALETTE.pink, PALETTE.gold][i % 3], 0.8)
    group.add(spr)
    pulses.push({ spr, target: edgeEnds[i % edgeEnds.length], t0: Math.random(), speed: 0.25 + Math.random() * 0.3 })
  }

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      gem.rotation.y += 0.7 * dt
      gem.rotation.x += 0.3 * dt
      stations.forEach((s, i) => {
        s.children[0].rotation.y += dt * (0.4 + i * 0.1)
        s.position.y = center.y + Math.sin(i * 1.7 + t * 0.5) * 2
      })
      pulses.forEach(pl => {
        const tt = (pl.t0 + t * pl.speed + p * 0.5) % 1
        pl.spr.position.lerpVectors(center, pl.target, tt)
        pl.spr.material.opacity = 0.9 * Math.sin(tt * Math.PI)
      })
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}
