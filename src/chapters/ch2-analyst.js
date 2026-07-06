import * as THREE from 'three'
import { PALETTE, textSprite, wireMat, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'
import { ATTRIBUTES } from '../content/resume.js'

// CH2 — EP01, THE ANALYST. A river of product-attribute tags flows along a
// spline past the camera. At 70% the chaos snaps into a sorted lattice —
// the "improved search filters" line, made literal.

export async function build({ tier, station }) {
  const group = new THREE.Group()

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-6, 2, station + 70),
    new THREE.Vector3(5, 1, station + 30),
    new THREE.Vector3(-4, 3, station - 10),
    new THREE.Vector3(2, 2, station - 50)
  ])

  // visible river bed: a ribbon of points along the curve
  const N = tier === 2 ? 420 : 200
  const river = makeDynamicPoints(N, { color: PALETTE.cyan, size: 0.09, opacity: 0.8 })
  const rpos = river.geometry.attributes.position.array
  const seeds = new Float32Array(N * 2)
  for (let i = 0; i < N; i++) {
    seeds[i * 2] = Math.random()
    seeds[i * 2 + 1] = Math.random() * Math.PI * 2
  }
  group.add(river)

  // attribute tags: canvas-texture sprites riding the river
  const tags = []
  const copies = tier === 2 ? 2 : 1
  for (let c = 0; c < copies; c++) {
    ATTRIBUTES.forEach((word, i) => {
      const spr = textSprite(word, { color: i % 3 === 0 ? '#ffb31e' : i % 3 === 1 ? '#4fe3ff' : '#ffe14d', px: 34 })
      spr.material.opacity = 0.9
      const t0 = (i + c * ATTRIBUTES.length) / (ATTRIBUTES.length * copies)
      tags.push({ spr, t0, jitter: (Math.random() - 0.5) * 2.4, lift: (Math.random() - 0.5) * 2 })
      group.add(spr)
    })
  }

  // the sorted lattice the tags snap into
  const lattice = []
  const perRow = 6
  tags.forEach((tag, i) => {
    const row = Math.floor(i / perRow), col = i % perRow
    lattice.push(new THREE.Vector3((col - (perRow - 1) / 2) * 3.4, 1 + row * 1.4, station - 42))
  })

  // filter gates the sorted stream passes through
  const gates = []
  ;['COLOR', 'SIZE', 'FIT'].forEach((label, i) => {
    const gate = new THREE.Group()
    gate.add(new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.05, 6, 40), wireMat(PALETTE.violet, 0.7)))
    const lbl = textSprite(label, { color: '#8b5cf6', px: 28 })
    lbl.position.y = 3.4
    gate.add(lbl)
    gate.position.set(0, 2, station - 18 - i * 10)
    group.add(gate)
    gates.push(gate)
  })

  const v = new THREE.Vector3()

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      const sort = smooth((p - 0.68) / 0.22)
      // river particles flow regardless; tighten toward the line as sorting happens
      for (let i = 0; i < N; i++) {
        const tt = (seeds[i * 2] + p * 1.2) % 1
        curve.getPoint(tt, v)
        const wob = (1 - sort) * 1.6
        rpos[i * 3] = v.x + Math.sin(seeds[i * 2 + 1] + t) * wob
        rpos[i * 3 + 1] = v.y + Math.cos(seeds[i * 2 + 1] * 2 + t) * wob * 0.5
        rpos[i * 3 + 2] = v.z
      }
      river.geometry.attributes.position.needsUpdate = true

      tags.forEach((tag, i) => {
        const tt = (tag.t0 + p * 0.9) % 1
        curve.getPoint(tt, v)
        const chaosX = v.x + tag.jitter
        const chaosY = v.y + tag.lift
        tag.spr.position.set(
          chaosX + (lattice[i].x - chaosX) * sort,
          chaosY + (lattice[i].y - chaosY) * sort,
          v.z + (lattice[i].z - v.z) * sort
        )
      })

      gates.forEach((g, i) => { g.rotation.z += dt * (0.2 + i * 0.1) })
    },
    updateCamera(p, pose) {
      // gentle banked sway while riding the river, fading out for the sort beat
      const env = Math.sin(Math.min(p / 0.7, 1) * Math.PI)
      pose.pos.x += Math.sin(p * Math.PI * 4) * 1.6 * env
      pose.pos.y += Math.sin(p * Math.PI * 2.5) * 0.5 * env
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
