import * as THREE from 'three'
import { PALETTE, wireMat, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'

// CH7 — AFTER HOURS. The showpiece: a human silhouette made of particles,
// driven by a hand-keyframed 16-joint skeleton. Toprock → crouch → invert →
// continuous HEADSPIN → freeze, looping. No mocap, no GLTF — just poses and
// physics intuition. Ghost trails lag a few frames behind (full tier only).

// joints: 0 head 1 neck 2 chest 3 hip · 4-6 arm L · 7-9 arm R · 10-12 leg L · 13-15 leg R
const STAND = [
  [0, 1.72, 0], [0, 1.52, 0], [0, 1.32, 0], [0, 0.98, 0],
  [-0.24, 1.48, 0], [-0.34, 1.18, 0.06], [-0.36, 0.9, 0.1],
  [0.24, 1.48, 0], [0.34, 1.18, 0.06], [0.36, 0.9, 0.1],
  [-0.13, 0.94, 0], [-0.15, 0.5, 0.02], [-0.16, 0.04, 0.06],
  [0.13, 0.94, 0], [0.15, 0.5, 0.02], [0.16, 0.04, 0.06]
]
const TOPROCK_L = [
  [0.02, 1.68, 0], [0, 1.5, 0], [0, 1.3, 0], [0, 0.95, -0.05],
  [-0.26, 1.5, 0], [-0.5, 1.35, 0.1], [-0.72, 1.5, 0.15],
  [0.26, 1.44, 0], [0.42, 1.15, -0.1], [0.5, 0.9, -0.15],
  [-0.13, 0.9, 0], [-0.2, 0.55, 0.3], [-0.22, 0.25, 0.6],
  [0.13, 0.9, -0.05], [0.16, 0.45, -0.1], [0.18, 0.02, -0.12]
]
const TOPROCK_R = TOPROCK_L.map(([x, y, z], i) => {
  // mirror across x, swapping left/right chains
  const map = { 4: 7, 5: 8, 6: 9, 7: 4, 8: 5, 9: 6, 10: 13, 11: 14, 12: 15, 13: 10, 14: 11, 15: 12 }
  const src = TOPROCK_L[map[i] ?? i]
  return [-src[0], src[1], src[2]]
})
const CROUCH = [
  [0, 1.05, 0.15], [0, 0.9, 0.1], [0, 0.75, 0.05], [0, 0.5, -0.05],
  [-0.24, 0.85, 0.1], [-0.3, 0.55, 0.2], [-0.3, 0.2, 0.3],
  [0.24, 0.85, 0.1], [0.3, 0.55, 0.2], [0.3, 0.2, 0.3],
  [-0.14, 0.48, -0.05], [-0.3, 0.3, 0.25], [-0.2, 0.03, 0.45],
  [0.14, 0.48, -0.05], [0.3, 0.3, 0.25], [0.2, 0.03, 0.45]
]
const INVERT = [
  [0, 0.12, 0], [0, 0.36, 0], [0, 0.6, 0], [0, 1.05, 0],
  [-0.24, 0.5, 0.05], [-0.34, 0.28, 0.15], [-0.38, 0.05, 0.22],
  [0.24, 0.5, 0.05], [0.34, 0.28, 0.15], [0.38, 0.05, 0.22],
  [-0.13, 1.08, 0], [-0.3, 1.25, 0.25], [-0.28, 1.05, 0.5],
  [0.13, 1.08, 0], [0.3, 1.25, 0.25], [0.28, 1.05, 0.5]
]
const SPIN_V = [
  [0, 0.12, 0], [0, 0.38, 0], [0, 0.64, 0], [0, 1.1, 0],
  [-0.26, 0.55, 0], [-0.4, 0.75, 0.1], [-0.5, 1.0, 0.15],
  [0.26, 0.55, 0], [0.4, 0.75, 0.1], [0.5, 1.0, 0.15],
  [-0.14, 1.12, 0], [-0.5, 1.45, 0.1], [-0.85, 1.75, 0.15],
  [0.14, 1.12, 0], [0.5, 1.42, -0.1], [0.88, 1.7, -0.15]
]
const FREEZE = [
  [0.25, 0.5, 0], [0.15, 0.65, 0], [0.05, 0.8, 0], [-0.1, 1.0, 0],
  [-0.1, 0.55, 0.1], [-0.2, 0.3, 0.15], [-0.25, 0.05, 0.2],
  [0.3, 0.75, -0.05], [0.5, 0.9, -0.1], [0.7, 1.05, -0.15],
  [-0.2, 1.0, 0.05], [-0.45, 1.2, 0.3], [-0.5, 0.9, 0.55],
  [0, 1.05, -0.05], [0.2, 1.4, -0.1], [0.15, 1.75, -0.1]
]

// the routine: [pose, seconds, spinning?]
const SEQUENCE = [
  [STAND, 1.0, false],
  [TOPROCK_L, 0.7, false],
  [TOPROCK_R, 0.7, false],
  [TOPROCK_L, 0.6, false],
  [CROUCH, 0.6, false],
  [INVERT, 0.8, false],
  [SPIN_V, 3.4, true],
  [INVERT, 0.6, false],
  [FREEZE, 1.3, false],
  [CROUCH, 0.5, false]
]
const TOTAL = SEQUENCE.reduce((s, seg) => s + seg[1], 0)

// bones: [jointA, jointB, radius]
const BONES = [
  [1, 0, 0.18], [1, 2, 0.15], [2, 3, 0.17],
  [2, 4, 0.1], [4, 5, 0.085], [5, 6, 0.075],
  [2, 7, 0.1], [7, 8, 0.085], [8, 9, 0.075],
  [3, 10, 0.12], [10, 11, 0.095], [11, 12, 0.08],
  [3, 13, 0.12], [13, 14, 0.095], [14, 15, 0.08]
]

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const daisY = -3.4
  const center = new THREE.Vector3(0, daisY + 1, station)

  // rooftop dais + neon circle
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.3, 32, 1, true), wireMat(0x3a4a9f, 0.5))
  dais.position.set(0, daisY - 0.2, station)
  group.add(dais)
  const circle = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.05, 6, 64), wireMat(PALETTE.pink, 0.8))
  circle.rotation.x = Math.PI / 2
  circle.position.set(0, daisY + 0.02, station)
  group.add(circle)
  const underglow = glowSprite(PALETTE.pink, 12)
  underglow.material.opacity = 0.22
  underglow.position.set(0, daisY + 0.4, station)
  group.add(underglow)

  // inter-titles around the arena
  ;['FLIP', 'LEAP', 'KICK', 'SPIN'].forEach((word, i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const spr = textSprite(word, { color: i % 2 ? '#ffd98a' : '#4fe3ff', px: 46 })
    spr.position.set(Math.cos(a) * 9, daisY + 3.4, station + Math.sin(a) * 9)
    spr.material.opacity = 0.5
    group.add(spr)
  })

  // ---- the dancer ----
  const N = tier === 2 ? 12000 : 5000
  const body = makeDynamicPoints(N, { color: PALETTE.sakura, size: 0.045, opacity: 0.95 })
  const bpos = body.geometry.attributes.position.array
  group.add(body)

  // particle → bone assignment, weighted by bone volume
  const weights = BONES.map(([a, b, r]) => {
    const A = STAND[a], B = STAND[b]
    return Math.max(0.05, Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])) * r
  })
  const totalW = weights.reduce((s, w) => s + w, 0)
  const pBone = new Uint8Array(N)
  const pT = new Float32Array(N)
  const pOff = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    let pick = Math.random() * totalW
    let b = 0
    while (pick > weights[b] && b < weights.length - 1) { pick -= weights[b]; b++ }
    pBone[i] = b
    pT[i] = Math.random()
    const r = BONES[b][2] * Math.cbrt(Math.random())
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(2 * Math.random() - 1)
    pOff[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pOff[i * 3 + 1] = r * Math.cos(ph)
    pOff[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
  }

  // ghost trail: a lagged half-density copy (full tier only)
  const GN = tier === 2 ? Math.floor(N / 2) : 0
  let ghost = null, gpos = null
  if (GN) {
    ghost = makeDynamicPoints(GN, { color: PALETTE.cyan, size: 0.045, opacity: 0.28 })
    gpos = ghost.geometry.attributes.position.array
    group.add(ghost)
  }
  const HISTORY = 9
  const history = Array.from({ length: HISTORY }, () => new Float32Array(16 * 3))
  let histHead = 0, histFilled = 0

  const joints = new Float32Array(16 * 3)
  let spinAngle = 0
  let localT = Math.random() * TOTAL

  function samplePose(time, out, dt) {
    let t = time % TOTAL
    let k = 0
    while (t > SEQUENCE[k][1]) { t -= SEQUENCE[k][1]; k = (k + 1) % SEQUENCE.length }
    const [poseA, dur, spinning] = SEQUENCE[k]
    const poseB = SEQUENCE[(k + 1) % SEQUENCE.length][0]
    const f = smooth(t / dur)
    if (spinning) spinAngle += dt * 8
    const cosA = Math.cos(spinAngle), sinA = Math.sin(spinAngle)
    const pump = spinning ? Math.sin(time * 5) * 0.08 : 0
    for (let j = 0; j < 16; j++) {
      let x = poseA[j][0] + (poseB[j][0] - poseA[j][0]) * f
      const y = poseA[j][1] + (poseB[j][1] - poseA[j][1]) * f
      let z = poseA[j][2] + (poseB[j][2] - poseA[j][2]) * f
      if (spinning && j >= 10) x += (j < 13 ? pump : -pump)
      if (spinning) {
        const rx = x * cosA - z * sinA
        z = x * sinA + z * cosA
        x = rx
      }
      out[j * 3] = x
      out[j * 3 + 1] = y + daisY
      out[j * 3 + 2] = z + station
    }
  }

  function fillParticles(jointArr, buf, count) {
    for (let i = 0; i < count; i++) {
      const [a, b] = BONES[pBone[i]]
      const t = pT[i]
      const ax = jointArr[a * 3], ay = jointArr[a * 3 + 1], az = jointArr[a * 3 + 2]
      buf[i * 3] = ax + (jointArr[b * 3] - ax) * t + pOff[i * 3]
      buf[i * 3 + 1] = ay + (jointArr[b * 3 + 1] - ay) * t + pOff[i * 3 + 1]
      buf[i * 3 + 2] = az + (jointArr[b * 3 + 2] - az) * t + pOff[i * 3 + 2]
    }
  }

  let active = false
  const camV = new THREE.Vector3()

  return {
    group,
    continuous: () => active,
    update(dt, t, p) {
      localT += dt
      samplePose(localT, joints, dt)
      fillParticles(joints, bpos, N)
      body.geometry.attributes.position.needsUpdate = true

      if (GN) {
        history[histHead].set(joints)
        histHead = (histHead + 1) % HISTORY
        histFilled = Math.min(histFilled + 1, HISTORY)
        if (histFilled === HISTORY) {
          fillParticles(history[histHead], gpos, GN) // oldest frame = the trail
          ghost.geometry.attributes.position.needsUpdate = true
        }
      }

      circle.rotation.z += dt * 0.3
      underglow.material.opacity = 0.18 + Math.sin(t * 2) * 0.05
    },
    updateCamera(p, pose) {
      // arena orbit: circle the dancer, drop to floor level for the headspin
      const w = smooth((p - 0.06) / 0.12) * (1 - smooth((p - 0.78) / 0.16))
      if (w <= 0) return
      const a = -Math.PI / 2 + p * Math.PI * 1.7
      const r = 10.5 - 4 * Math.sin(p * Math.PI)
      const low = Math.sin(smooth((p - 0.3) / 0.4) * Math.PI) // the money-shot dip
      const y = daisY + 4.6 - low * 3.4
      camV.set(Math.cos(a) * r, y, station + Math.sin(a) * r)
      pose.pos.lerp(camV, w)
      camV.copy(center)
      pose.look.lerp(camV, w)
    },
    setActive(on) { active = on },
    dispose() { disposeGroup(group) }
  }
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
