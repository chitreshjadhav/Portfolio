import * as THREE from 'three'
import { PALETTE, wireMat, glowSprite, disposeGroup } from '../lib/neon.js'

// CH3 — EP02, THE POWER-UP ARC. An instanced warehouse of glowing listing
// cartons under fog. A gold QC scan beam sweeps the aisles with scroll; one
// mismatched carton burns red until the beam corrects it — the
// data-consistency beat. The camera tracks low, then cranes up for scale.

export async function build({ tier, station }) {
  const group = new THREE.Group()

  const COUNT = tier === 2 ? 520 : 220
  const geo = new THREE.BoxGeometry(1.6, 1.2, 1.6)
  const cartons = new THREE.InstancedMesh(geo, wireMat(PALETTE.cyan, 0.55), COUNT)
  const accents = new THREE.InstancedMesh(geo, wireMat(PALETTE.violet, 0.6), Math.floor(COUNT / 6))
  const m = new THREE.Matrix4()

  const aisles = [-10.5, -6.5, 6.5, 10.5]
  let a = 0
  for (let i = 0; i < COUNT; i++) {
    const x = aisles[i % aisles.length] + (Math.random() - 0.5) * 1.2
    const z = station + 58 - (Math.floor(i / aisles.length) * (tier === 2 ? 1.05 : 2.4)) - Math.random() * 0.5
    const stackY = (i % 3) * 1.35
    m.makeRotationY((Math.random() - 0.5) * 0.12)
    m.setPosition(x, -2.6 + stackY, z)
    if (i % 6 === 0 && a < accents.count) { accents.setMatrixAt(a++, m) } else { cartons.setMatrixAt(i, m) }
  }
  cartons.instanceMatrix.needsUpdate = true
  accents.instanceMatrix.needsUpdate = true
  group.add(cartons, accents)

  // GS1 barcode gate the camera passes beneath during the crane-up
  const gate = new THREE.Group()
  const post = new THREE.BoxGeometry(0.4, 12, 0.4)
  const postL = new THREE.Mesh(post, wireMat(PALETTE.gold, 0.8)); postL.position.set(-13, 2, 0)
  const postR = new THREE.Mesh(post, wireMat(PALETTE.gold, 0.8)); postR.position.set(13, 2, 0)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(26.4, 1.2, 0.4), wireMat(PALETTE.gold, 0.8))
  bar.position.set(0, 8.4, 0)
  const barcodeLabel = barcodeSprite()
  barcodeLabel.position.set(0, 8.4, 0.4)
  gate.add(postL, postR, bar, barcodeLabel)
  gate.position.set(0, 0, station - 46)
  group.add(gate)

  // the QC scan beam — a glowing wall of light that sweeps with scroll
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 9),
    new THREE.MeshBasicMaterial({
      color: PALETTE.gold, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  )
  beam.position.set(0, 1.5, station + 40)
  group.add(beam)
  const beamGlow = glowSprite(PALETTE.gold, 16)
  beamGlow.material.opacity = 0.3
  beamGlow.position.copy(beam.position)
  group.add(beamGlow)

  // the mismatch: one carton flagged red until the beam passes it
  const flagged = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.7), wireMat(0xff3355, 0.95))
  const fixed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.7), wireMat(PALETTE.cyan, 0.95))
  const flagZ = station + 12
  flagged.position.set(-6.5, -2.6, flagZ)
  fixed.position.copy(flagged.position)
  fixed.visible = false
  const flagGlow = glowSprite(0xff3355, 3)
  flagGlow.position.copy(flagged.position)
  group.add(flagged, fixed, flagGlow)

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      // beam sweeps the length of the aisles across the chapter
      const z = station + 55 - p * 105
      beam.position.z = z
      beamGlow.position.z = z
      beam.material.opacity = 0.1 + Math.sin(t * 6) * 0.04

      // correction beat: the beam crossing the flagged carton fixes it
      const corrected = z < flagZ
      flagged.visible = !corrected
      fixed.visible = corrected
      flagGlow.material.color.setHex(corrected ? PALETTE.cyan : 0xff3355)
      flagGlow.material.opacity = corrected ? 0.5 : 0.35 + Math.sin(t * 9) * 0.2
      fixed.rotation.y = flagged.rotation.y = Math.sin(t * 0.7) * 0.05
    },
    setActive() {},
    dispose() { disposeGroup(group) }
  }
}

function barcodeSprite() {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffe14d'
  let x = 10
  while (x < 500) {
    const w = 2 + Math.random() * 7
    ctx.fillRect(x, 8, w, 48)
    x += w + 3 + Math.random() * 6
  }
  const tex = new THREE.CanvasTexture(c)
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0.9, depthWrite: false
  }))
  spr.scale.set(12, 1.5, 1)
  return spr
}
