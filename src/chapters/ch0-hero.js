import * as THREE from 'three'
import { PALETTE, neonBox, wireMat, solidMat, glowSprite, disposeGroup } from '../lib/neon.js'
import { makePoints } from '../lib/particles.js'

// CH0 — COLD OPEN. The original hero world, ported: icosahedron core, halo
// rings, five orbiters, particle field — now floating above a procedural
// Mumbai skyline. Drag-to-orbit preserved (with pointer capture properly
// released). On scroll the camera dives out of orbit toward chapter 1.

export async function build({ world, tier, station }) {
  const group = new THREE.Group()

  // ---- core ----
  const core = new THREE.Group()
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), wireMat(PALETTE.pink, 0.75)))
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 1), solidMat()))
  core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.12, 1), wireMat(PALETTE.violet, 0.5)))
  core.position.set(0, 1.2, station)
  group.add(core)

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(5, 0.05, 8, 100), wireMat(PALETTE.cyan, 0.8))
  ring1.rotation.x = Math.PI / 2.2
  ring1.position.copy(core.position)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.04, 8, 100), wireMat(PALETTE.pink, 0.55))
  ring2.rotation.x = Math.PI / 1.8
  ring2.position.copy(core.position)
  group.add(ring1, ring2)

  // ---- orbiters: the toolkit ----
  const orbiters = []
  function addOrbiter(obj, radius, speed, phase, yOff) {
    obj.userData = { radius, speed, phase, yOff }
    orbiters.push(obj)
    group.add(obj)
  }
  const stack = new THREE.Group()
  ;[PALETTE.cyan, PALETTE.pink, PALETTE.violet].forEach((c, i) => {
    const b = neonBox(1, 0.7, 1, c); b.position.y = i * 0.78; stack.add(b)
  })
  addOrbiter(stack, 9, 0.28, 0, -1.4)
  const chart = new THREE.Group()
  ;[0.8, 1.4, 2, 2.6].forEach((h, i) => {
    const b = neonBox(0.5, h, 0.5, [PALETTE.cyan, PALETTE.violet, PALETTE.pink, PALETTE.gold][i])
    b.position.set(i * 0.7, h / 2 - 2, 0); chart.add(b)
  })
  addOrbiter(chart, 10.5, -0.2, 2.1, -1.2)
  addOrbiter(new THREE.Mesh(new THREE.OctahedronGeometry(1), wireMat(PALETTE.gold)), 8, 0.36, 4.2, 0.6)
  addOrbiter(new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.24, 64, 8), wireMat(PALETTE.cyan, 0.8)), 11.5, 0.16, 1.1, 1.8)
  addOrbiter(neonBox(1.1, 1.1, 1.1, PALETTE.pink), 12.5, -0.12, 3.3, 0.2)

  // ---- particles ----
  const p1 = makePoints(tier === 2 ? 500 : 240, { color: 0xff6fb3, size: 0.1, spread: 50, center: [0, 2, station] })
  const p2 = makePoints(tier === 2 ? 380 : 170, { color: PALETTE.cyan, size: 0.08, spread: 50, center: [0, 2, station] })
  group.add(p1, p2)

  // ---- Mumbai, after dark: instanced wireframe towers behind the core ----
  const towerCount = tier === 2 ? 220 : 90
  const towerGeo = new THREE.BoxGeometry(1, 1, 1)
  const towers = new THREE.InstancedMesh(towerGeo, wireMat(0x3a4a9f, 0.5), towerCount)
  const m = new THREE.Matrix4()
  for (let i = 0; i < towerCount; i++) {
    // keep the core's stage clear: towers spawn only outside |x| < 14
    const side = Math.random() < 0.5 ? -1 : 1
    const x = side * (14 + Math.random() * 96)
    const w = 2 + Math.random() * 4
    const h = 4 + Math.random() * 22
    const z = station - 40 - Math.random() * 120
    m.makeScale(w, h, w)
    m.setPosition(x, h / 2 - 3.5, z)
    towers.setMatrixAt(i, m)
  }
  towers.instanceMatrix.needsUpdate = true
  group.add(towers)
  const cityGlow = glowSprite(PALETTE.pink, 60)
  cityGlow.material.opacity = 0.16
  cityGlow.position.set(0, 4, station - 90)
  group.add(cityGlow)

  // ---- drag to orbit (enhancement only) ----
  // The WebGL canvas sits behind the DOM (main has a higher z-index), so it
  // never receives pointer events directly. We listen on window instead —
  // pointerdown/move bubble there no matter which element is on top — and gate
  // to the hero (lastP < 0.12), ignoring drags that start on the CTA controls.
  let dragging = false, lastX = 0, lastY = 0
  let theta = 0.6, phi = 1.15
  let lastP = 0

  function onDown(e) {
    if (lastP > 0.12) return
    if (e.target.closest?.('a, button')) return // let the hero CTAs work
    dragging = true; lastX = e.clientX; lastY = e.clientY
  }
  function onMove(e) {
    if (!dragging) return
    theta -= (e.clientX - lastX) * 0.006
    phi = Math.max(0.5, Math.min(1.45, phi - (e.clientY - lastY) * 0.004))
    lastX = e.clientX; lastY = e.clientY
    world.requestRender()
  }
  function onUp() {
    dragging = false
  }
  window.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)

  const center = new THREE.Vector3(0, 1.2, station)
  const orbitPos = new THREE.Vector3()

  return {
    group,
    continuous: () => lastP < 0.15,
    update(dt, t, p) {
      lastP = p
      core.rotation.y += 0.36 * dt
      core.rotation.x = Math.sin(t * 0.6) * 0.12
      ring1.rotation.z += 0.24 * dt
      ring2.rotation.z -= 0.18 * dt
      orbiters.forEach(o => {
        const u = o.userData
        const a = t * u.speed + u.phase
        o.position.set(Math.cos(a) * u.radius, 1.2 + u.yOff + Math.sin(t + u.phase) * 0.4, station + Math.sin(a) * u.radius)
        o.rotation.y += 0.6 * dt
        o.rotation.x += 0.36 * dt
      })
      p1.rotation.y += 0.024 * dt
      p2.rotation.y -= 0.036 * dt
      if (!dragging && p < 0.12) theta += 0.06 * dt // idle auto-orbit
    },
    updateCamera(p, pose) {
      // near the top, the user's orbit owns the camera; it hands off to the dive
      const blend = 1 - Math.min(1, p / 0.12)
      if (blend <= 0) return
      const r = 17
      orbitPos.set(
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
        station + r * Math.sin(phi) * Math.cos(theta)
      )
      pose.pos.lerp(orbitPos, blend)
      pose.look.lerp(center, blend)
    },
    setActive() {},
    dispose() {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      disposeGroup(group)
    }
  }
}
