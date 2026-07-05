import * as THREE from 'three'
import { PALETTE, wireMat, neonBox, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'
import { makeDynamicPoints } from '../lib/particles.js'

// CH5 — EP04, NOW AIRING. The command deck powers ON around you:
//  · holo-screens glitch-in one by one and fly into their cockpit arc
//  · the icosahedron core descends and docks at deck center
//  · once docked, every screen streams data INTO the core (it runs the deck)
//  · the four stat cubes lift off the rail and fall into orbit around it
//  · a NOW AIRING title slams in with a scanline flicker
// Camera settles into the first "seated" shot of the film, breathing slightly.

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const deckZ = station
  const dockPos = new THREE.Vector3(0, 2.4, deckZ - 2)

  // ---- holo screens: assembled on scroll, one by one ----
  const screens = []
  const SCREENS = tier === 2 ? 7 : 5
  for (let i = 0; i < SCREENS; i++) {
    const a = ((i / (SCREENS - 1)) - 0.5) * Math.PI * 0.9
    const c = document.createElement('canvas')
    c.width = 256; c.height = 160
    const tex = new THREE.CanvasTexture(c)
    const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, side: THREE.DoubleSide })
    const frameMat = new THREE.MeshBasicMaterial({
      color: [PALETTE.cyan, PALETTE.violet, PALETTE.pink][i % 3],
      wireframe: true, transparent: true, opacity: 0
    })
    const unit = new THREE.Group()
    unit.add(new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.75), planeMat))
    unit.add(new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.0), frameMat))

    const r = 11
    const target = new THREE.Vector3(Math.sin(a) * r, 2.2 + Math.abs(a) * 1.6, deckZ - Math.cos(a) * r + 6)
    unit.position.copy(target)
    unit.lookAt(0, 2, deckZ + 14)
    const targetQuat = unit.quaternion.clone()
    // each screen flies in from deep behind its slot, tumbling slightly
    const from = target.clone().add(new THREE.Vector3(Math.sin(a) * 14, 5 + (i % 3) * 3, -26))
    unit.position.copy(from)
    group.add(unit)
    screens.push({
      unit, planeMat, frameMat, canvas: c, ctx: c.getContext('2d'), tex,
      kind: i % 3, seed: Math.random() * 100,
      from, target, targetQuat,
      // staggered entry window across the first 40% of the chapter
      t0: 0.05 + (i * 0.28) / SCREENS
    })
  }

  // ---- return-rate dial ----
  const dialC = document.createElement('canvas')
  dialC.width = dialC.height = 256
  const dialTex = new THREE.CanvasTexture(dialC)
  const dialMat = new THREE.MeshBasicMaterial({ map: dialTex, transparent: true, opacity: 0, side: THREE.DoubleSide })
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), dialMat)
  dial.position.set(0, 3.2, deckZ - 6)
  group.add(dial)

  // ---- chat bubbles ----
  const bubbles = []
  ;[
    ['Ticketing rule?', '#4fe3ff'],
    ['Ask the bot', '#ffe14d'],
    ['SOP found ✓', '#ff4fa3']
  ].forEach(([txt, col], i) => {
    const b = textSprite(txt, { color: col, px: 26, font: 'Rajdhani' })
    b.position.set(6.5 + (i % 2) * 1.2, 1.4 + i * 1.15, deckZ + 2)
    b.material.opacity = 0
    group.add(b)
    bubbles.push({ sprite: b, delay: i * 0.1 })
  })

  // ---- stat cubes: rail → orbit around the docked core ----
  const cubes = []
  ;[['6+', PALETTE.cyan], ['10+', PALETTE.pink], ['4', PALETTE.violet], ['3', PALETTE.gold]].forEach(([label, col], i) => {
    const cube = neonBox(1.05, 1.05, 1.05, col)
    const rail = new THREE.Vector3(-7.5 + i * 1.9, 0.4, deckZ + 4)
    cube.position.copy(rail)
    const lbl = textSprite(label, { color: '#eef0ff', px: 30 })
    lbl.position.y = 1.2
    cube.add(lbl)
    group.add(cube)
    cubes.push({ cube, rail, phase: (i / 4) * Math.PI * 2 })
  })

  // ---- the core, docking ----
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), wireMat(PALETTE.pink, 0.9))
  const coreGlow = glowSprite(PALETTE.pink, 3.4)
  group.add(core, coreGlow)

  // ---- data intake: streams from every screen into the core ----
  const PER = tier === 2 ? 12 : 6
  const intake = makeDynamicPoints(SCREENS * PER, { color: PALETTE.cyan, size: 0.13, opacity: 0.9 })
  const ipos = intake.geometry.attributes.position.array
  const iseed = new Float32Array(SCREENS * PER)
  for (let i = 0; i < iseed.length; i++) iseed[i] = Math.random()
  intake.visible = false
  group.add(intake)

  // ---- NOW AIRING title ----
  const airing = textSprite('NOW AIRING', { color: '#ff4fa3', px: 60 })
  airing.position.set(0, 6.3, deckZ - 3)
  airing.material.opacity = 0
  const airingBase = airing.scale.clone()
  group.add(airing)
  const airingGlow = glowSprite(PALETTE.pink, 7)
  airingGlow.position.copy(airing.position)
  airingGlow.material.opacity = 0
  group.add(airingGlow)

  let redrawAcc = 0
  let active = false
  let lastT = 0
  let lastP = 0
  const v = new THREE.Vector3()

  return {
    group,
    // after the deck powers on it stays alive: orbiting cubes, intake streams, flicker
    continuous: () => active && lastP > 0.3,
    update(dt, t, p) {
      lastT = t
      lastP = p

      // screens redraw at ~6fps once visible
      redrawAcc += dt
      const redraw = redrawAcc > 0.16
      if (redraw) redrawAcc = 0

      // ---- assembly: each screen flies in through its own window, flickering ----
      screens.forEach((s, i) => {
        const w = smooth((p - s.t0) / 0.11)
        if (w <= 0) { s.planeMat.opacity = s.frameMat.opacity = 0; return }
        s.unit.position.lerpVectors(s.from, s.target, w)
        s.unit.quaternion.copy(s.targetQuat)
        s.unit.rotation.z = (1 - w) * 0.6 * (i % 2 ? 1 : -1)
        // glitch flicker while materializing, steady once seated
        const flicker = w < 1 ? 0.3 + 0.7 * Math.abs(Math.sin(t * 26 + i * 7)) : 1
        s.planeMat.opacity = 0.92 * w * flicker
        s.frameMat.opacity = 0.6 * w * flicker
        if (redraw && w > 0.2) drawScreen(s, t)
      })

      const dialW = smooth((p - 0.3) / 0.1)
      dialMat.opacity = dialW
      if (redraw && dialW > 0) drawDial(dialC, dialTex, p)
      dial.lookAt(0, 3, deckZ + 20)

      // ---- the core descends and docks ----
      const dock = smooth((p - 0.28) / 0.3)
      core.position.set(0, 12 - dock * (12 - dockPos.y), deckZ - 2)
      core.rotation.y += dt * (1.4 - dock * 0.9)
      core.scale.setScalar(0.7 + dock * 0.5)
      coreGlow.position.copy(core.position)
      coreGlow.material.opacity = 0.4 + dock * 0.3 + Math.sin(t * 3) * 0.08 * dock

      // ---- once docked, every screen feeds the core ----
      const feed = smooth((p - 0.55) / 0.08)
      intake.visible = feed > 0
      if (feed > 0) {
        intake.material.opacity = 0.9 * feed
        for (let si = 0; si < SCREENS; si++) {
          const sp = screens[si].unit.position
          for (let k = 0; k < PER; k++) {
            const idx = si * PER + k
            const tt = (iseed[idx] + t * 0.45) % 1
            v.lerpVectors(sp, core.position, tt)
            v.y += Math.sin(tt * Math.PI) * 0.9
            ipos[idx * 3] = v.x
            ipos[idx * 3 + 1] = v.y
            ipos[idx * 3 + 2] = v.z
          }
        }
        intake.geometry.attributes.position.needsUpdate = true
      }

      // ---- stat cubes lift off the rail into orbit around the core ----
      const lift = smooth((p - 0.6) / 0.12)
      cubes.forEach((c, i) => {
        c.cube.rotation.y += dt * (0.5 + i * 0.12)
        if (lift <= 0) { c.cube.position.copy(c.rail); return }
        const a = c.phase + t * 0.5
        v.set(core.position.x + Math.cos(a) * 3.4, core.position.y + Math.sin(t * 0.8 + c.phase) * 0.5, core.position.z + Math.sin(a) * 3.4)
        c.cube.position.lerpVectors(c.rail, v, lift)
      })

      // ---- chat bubbles pop once the deck is live ----
      bubbles.forEach(b => {
        b.sprite.material.opacity = smooth((p - 0.42 - b.delay) / 0.07) * 0.95
        b.sprite.position.y += Math.sin(t * 1.4 + b.delay * 9) * 0.0012
      })

      // ---- NOW AIRING slams in with a scanline flicker ----
      const na = smooth((p - 0.68) / 0.07)
      const naFlicker = na < 1 ? (0.35 + 0.65 * Math.abs(Math.sin(t * 32))) : (0.86 + 0.14 * Math.sin(t * 5))
      airing.material.opacity = na * naFlicker
      airing.scale.copy(airingBase).multiplyScalar(1 + (1 - na) * 1.6)
      airingGlow.material.opacity = na * 0.35
    },
    updateCamera(p, pose) {
      // the film's first seated shot: settle in, then breathe with the deck
      const env = smooth((p - 0.3) / 0.18) * (1 - smooth((p - 0.86) / 0.12))
      if (env <= 0) return
      pose.pos.x += Math.sin(lastT * 0.55) * 0.4 * env
      pose.pos.y += Math.sin(lastT * 0.4) * 0.18 * env
      v.copy(dockPos)
      pose.look.lerp(v, 0.35 * env)
    },
    setActive(on) { active = on },
    dispose() { disposeGroup(group) }
  }
}

function drawScreen(s, t) {
  const { ctx, canvas, tex, kind, seed } = s
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'rgba(13,15,31,0.85)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = kind === 0 ? '#4fe3ff' : kind === 1 ? '#8b5cf6' : '#ff4fa3'
  ctx.lineWidth = 2
  if (kind === 0) {
    for (let i = 0; i < 8; i++) {
      const h = 30 + Math.abs(Math.sin(seed + t * 0.7 + i)) * 90
      ctx.strokeRect(14 + i * 30, 140 - h, 20, h)
    }
  } else if (kind === 1) {
    ctx.beginPath()
    for (let x = 0; x < 250; x += 6) {
      const y = 80 + Math.sin(seed + x * 0.05 + t * 0.9) * 34 + Math.sin(x * 0.11) * 12
      x === 0 ? ctx.moveTo(x + 4, y) : ctx.lineTo(x + 4, y)
    }
    ctx.stroke()
  } else {
    for (let i = 0; i < 5; i++) {
      const w = 90 + Math.abs(Math.sin(seed + t * 0.5 + i * 1.7)) * 130
      ctx.strokeRect(12, 14 + i * 28, w, 18)
    }
  }
  tex.needsUpdate = true
}

function drawDial(c, tex, p) {
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, 256, 256)
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(148,163,255,0.25)'
  ctx.beginPath()
  ctx.arc(128, 128, 96, Math.PI * 0.75, Math.PI * 2.25)
  ctx.stroke()
  const frac = 0.85 - smooth((p - 0.3) / 0.5) * 0.62
  ctx.strokeStyle = frac > 0.5 ? '#ff4fa3' : '#4fe3ff'
  ctx.beginPath()
  ctx.arc(128, 128, 96, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * frac))
  ctx.stroke()
  ctx.fillStyle = '#eef0ff'
  ctx.font = "44px 'Bebas Neue', sans-serif"
  ctx.textAlign = 'center'
  ctx.fillText('RETURNS', 128, 118)
  ctx.fillStyle = frac > 0.5 ? '#ff4fa3' : '#4fe3ff'
  ctx.fillText(`${Math.round(frac * 100)}%`, 128, 168)
  tex.needsUpdate = true
}

function smooth(x) {
  x = Math.min(1, Math.max(0, x))
  return x * x * (3 - 2 * x)
}
