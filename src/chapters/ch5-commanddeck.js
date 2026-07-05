import * as THREE from 'three'
import { PALETTE, wireMat, neonBox, glowSprite, textSprite, disposeGroup } from '../lib/neon.js'

// CH5 — EP04, NOW AIRING. The command deck: an arc of holo-screens with
// living charts, the return-rate dial winding DOWN, chat bubbles from the
// agents' bot — and the icosahedron core docking into the deck (callback).

export async function build({ tier, station }) {
  const group = new THREE.Group()
  const deckZ = station

  // ---- holo screens in a cockpit arc ----
  const screens = []
  const SCREENS = tier === 2 ? 7 : 5
  for (let i = 0; i < SCREENS; i++) {
    const a = ((i / (SCREENS - 1)) - 0.5) * Math.PI * 0.9
    const c = document.createElement('canvas')
    c.width = 256; c.height = 160
    const tex = new THREE.CanvasTexture(c)
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 2.75),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    )
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 3.0),
      wireMat([PALETTE.cyan, PALETTE.violet, PALETTE.pink][i % 3], 0.6))
    const unit = new THREE.Group()
    unit.add(plane, frame)
    const r = 11
    unit.position.set(Math.sin(a) * r, 2.2 + Math.abs(a) * 1.6, deckZ - Math.cos(a) * r + 6)
    unit.lookAt(0, 2, deckZ + 14)
    group.add(unit)
    screens.push({ canvas: c, ctx: c.getContext('2d'), tex, kind: i % 3, seed: Math.random() * 100 })
  }

  // ---- the return-rate dial (winds down as you scrub) ----
  const dialC = document.createElement('canvas')
  dialC.width = dialC.height = 256
  const dialTex = new THREE.CanvasTexture(dialC)
  const dial = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: dialTex, transparent: true, side: THREE.DoubleSide })
  )
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
    bubbles.push({ sprite: b, delay: i * 0.12 })
  })

  // ---- stat cubes, spinning on the deck rail ----
  const cubes = []
  ;[['6+', PALETTE.cyan], ['10+', PALETTE.pink], ['4', PALETTE.violet], ['3', PALETTE.gold]].forEach(([label, col], i) => {
    const cube = neonBox(1.15, 1.15, 1.15, col)
    cube.position.set(-7.5 + i * 1.9, 0.4, deckZ + 4)
    const lbl = textSprite(label, { color: '#eef0ff', px: 30 })
    lbl.position.y = 1.3
    cube.add(lbl)
    group.add(cube)
    cubes.push(cube)
  })

  // ---- the core docks into the deck ----
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), wireMat(PALETTE.pink, 0.9))
  const coreGlow = glowSprite(PALETTE.pink, 3.4)
  group.add(core, coreGlow)

  let redrawAcc = 0

  return {
    group,
    continuous: false,
    update(dt, t, p) {
      // screens redraw at 6fps — living, not burning
      redrawAcc += dt
      if (redrawAcc > 0.16) {
        redrawAcc = 0
        screens.forEach(s => drawScreen(s, t))
        drawDial(dialC, dialTex, p)
      }

      // the core descends from above and docks at deck level
      const dock = smooth((p - 0.25) / 0.35)
      core.position.set(0, 10 - dock * 7.6, deckZ - 2)
      core.rotation.y += dt * (1.2 - dock * 0.8)
      coreGlow.position.copy(core.position)

      // chat bubbles pop in sequence mid-chapter
      bubbles.forEach(b => {
        b.sprite.material.opacity = smooth((p - 0.35 - b.delay) / 0.08) * 0.95
        b.sprite.position.y += Math.sin(t * 1.4 + b.delay * 9) * 0.0012
      })

      cubes.forEach((c, i) => { c.rotation.y += dt * (0.5 + i * 0.12) })
      dial.lookAt(0, 3, deckZ + 20)
    },
    setActive() {},
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
    // bars
    for (let i = 0; i < 8; i++) {
      const h = 30 + Math.abs(Math.sin(seed + t * 0.7 + i)) * 90
      ctx.strokeRect(14 + i * 30, 140 - h, 20, h)
    }
  } else if (kind === 1) {
    // sparkline
    ctx.beginPath()
    for (let x = 0; x < 250; x += 6) {
      const y = 80 + Math.sin(seed + x * 0.05 + t * 0.9) * 34 + Math.sin(x * 0.11) * 12
      x === 0 ? ctx.moveTo(x + 4, y) : ctx.lineTo(x + 4, y)
    }
    ctx.stroke()
  } else {
    // ticket queue rows
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
  // return rate winding down: full arc → small arc as the chapter plays
  const frac = 0.85 - smooth((p - 0.2) / 0.6) * 0.62
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
