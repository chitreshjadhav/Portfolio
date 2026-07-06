import * as THREE from 'three'
import { PALETTE, wireMat, neonBox, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'
import { MARKETPLACES } from '../content/resume.js'

// CH4 — EP03, TEN MARKETPLACES. Eleven labeled gates in a 360°
// ring around a QC hub — the old carousel reborn, except now the camera is
// inside it, sweeping a full orbit. Delivery particles stream out through
// every gate. Climax: the PASS stamp slams in with a shockwave.

const CENTER_Y = 2

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const center = new THREE.Vector3(0, CENTER_Y, station)
  const RING_R = 24

  // hub
  const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), wireMat(PALETTE.pink, 0.9))
  hub.position.copy(center)
  group.add(hub)
  const hubGlow = glowSprite(PALETTE.pink, 5)
  hubGlow.position.copy(center)
  group.add(hubGlow)

  // gates
  const gates = []
  MARKETPLACES.forEach((name, i) => {
    const a = (i / MARKETPLACES.length) * Math.PI * 2
    const gate = new THREE.Group()
    const torus = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.07, 8, 48),
      wireMat([PALETTE.cyan, PALETTE.violet, PALETTE.gold][i % 3], 0.8))
    gate.add(torus)
    const label = textSprite(name, { color: '#eef0ff', px: 30 })
    label.position.y = 3.4
    gate.add(label)
    gate.position.set(center.x + Math.cos(a) * RING_R, CENTER_Y, center.z + Math.sin(a) * RING_R)
    gate.lookAt(center)
    group.add(gate)
    gates.push({ gate, torus, angle: a })
  })

  // delivery packets: hub → gates, endlessly
  const PACKETS = tier === 2 ? 330 : 150
  const packets = makeDynamicPoints(PACKETS, { color: PALETTE.cyan, size: 0.16, opacity: 0.9 })
  const ppos = packets.geometry.attributes.position.array
  const pseed = new Float32Array(PACKETS * 2)
  for (let i = 0; i < PACKETS; i++) {
    pseed[i * 2] = Math.floor(Math.random() * MARKETPLACES.length)
    pseed[i * 2 + 1] = Math.random()
  }
  group.add(packets)

  // WoW / MoM bar towers
  const bars = new THREE.Group()
  ;[3, 5, 7, 9].forEach((h, i) => {
    const b = neonBox(1.2, h, 1.2, [PALETTE.cyan, PALETTE.violet, PALETTE.pink, PALETTE.gold][i])
    b.position.set(-8 + i * 2.2, -3.5 + h / 2, station - 12)
    bars.add(b)
  })
  group.add(bars)

  // the PASS stamp
  const stamp = new THREE.Group()
  const stampRing = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 48), wireMat(PALETTE.pink, 1))
  const stampText = textSprite('PASS', { color: '#ffb31e', px: 72 })
  stamp.add(stampRing, stampText)
  stamp.position.set(0, CENTER_Y + 1.5, station + 6)
  stamp.rotation.z = -0.2
  stamp.visible = false
  group.add(stamp)
  const shockwave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 60), wireMat(PALETTE.sakura, 0.8))
  shockwave.position.copy(stamp.position)
  shockwave.visible = false
  group.add(shockwave)

  const v = new THREE.Vector3()
  let shake = 0

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      hub.rotation.y += 0.5 * dt
      gates.forEach(g => { g.torus.rotation.z += 0.4 * dt })

      for (let i = 0; i < PACKETS; i++) {
        const gi = pseed[i * 2]
        const a = (gi / MARKETPLACES.length) * Math.PI * 2
        const tt = (pseed[i * 2 + 1] + t * 0.14 + p * 0.4) % 1
        ppos[i * 3] = center.x + Math.cos(a) * RING_R * tt
        ppos[i * 3 + 1] = CENTER_Y + Math.sin(tt * Math.PI) * 1.6
        ppos[i * 3 + 2] = center.z + Math.sin(a) * RING_R * tt
      }
      packets.geometry.attributes.position.needsUpdate = true

      // PASS stamp: slams at p≈0.74, shockwave rides out behind it
      const slam = smooth((p - 0.72) / 0.06)
      const visible = p > 0.7 && p < 0.97
      stamp.visible = visible
      if (visible) {
        const s = 3.2 - 2.2 * slam
        stamp.scale.setScalar(Math.max(0.001, s))
        stamp.children.forEach(c => { if (c.material) c.material.opacity = slam })
        shockwave.visible = slam >= 1
        if (shockwave.visible) {
          const w = smooth((p - 0.78) / 0.16)
          shockwave.scale.setScalar(1 + w * 9)
          shockwave.material.opacity = 0.8 * (1 - w)
        }
        if (slam >= 1 && shake === 0) shake = 0.5
      } else {
        shockwave.visible = false
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 1.6)
    },
    updateCamera(p, pose) {
      // the 360° sweep: camera orbits the ring interior between the pose rails
      const w = smooth((p - 0.04) / 0.12) * (1 - smooth((p - 0.7) / 0.14))
      if (w > 0) {
        const a = -Math.PI / 2 + p * Math.PI * 2
        const r = 13 - 4 * Math.sin(p * Math.PI)
        v.set(center.x + Math.cos(a) * r, 5.5 + Math.sin(p * Math.PI * 2) * 1.5, center.z + Math.sin(a) * r)
        pose.pos.lerp(v, w)
        pose.look.lerp(center, w)
      }
      if (shake > 0) {
        pose.pos.x += (Math.random() - 0.5) * 0.22 * shake
        pose.pos.y += (Math.random() - 0.5) * 0.18 * shake
      }
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
