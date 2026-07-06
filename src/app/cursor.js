import gsap from 'gsap'

// Black-hole cursor: a 2D canvas overlay renders the hole itself while the
// world renderer warps the 3D scene beneath it (world.setLens drives a
// screen-space deflection pass). A faint starfield exists everywhere but only
// becomes visible near the lens — each star is drawn at its lensed apparent
// position (θ = (β + √(β² + 4θE²)) / 2), stretched tangentially by
// magnification, with a faint secondary image mirrored inside the Einstein
// ring. The event-horizon core is drawn last so it swallows light behind it.
//
// The native cursor is hidden while the hole is live — the mass IS the
// pointer, so it tracks the mouse near-1:1 (soft, but never trailing far).
// Demand-rendered: ticks only while the pointer moves, fades out ~2.5s after
// the last move, then stops entirely and hands the native cursor back.

export function initCursorLens(caps, world) {
  if (!matchMedia('(pointer: fine)').matches) return

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:40;'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  // the hole replaces the pointer — no arrow floating on top of the mass
  const style = document.createElement('style')
  style.textContent = 'html.bh-cursor, html.bh-cursor * { cursor: none !important; }'
  document.head.appendChild(style)

  const DPR = Math.min(devicePixelRatio || 1, caps.tier === 2 ? 2 : 1.5)
  const E = caps.tier === 2 ? 26 : 22       // Einstein radius (px)
  const RANGE = E * 7.5                     // starfield influence radius
  const CORE = E * 0.42                     // event-horizon radius
  const WARP_R = E * 4.2                    // world-shader deflection radius

  let w = 0, h = 0, stars = []
  function resize() {
    w = innerWidth; h = innerHeight
    canvas.width = w * DPR
    canvas.height = h * DPR
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    const density = caps.tier === 2 ? 8500 : 14000
    const n = Math.min(220, Math.ceil((w * h) / density))
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: 0.7 + Math.random() * 1.2,
      tw: Math.random() * Math.PI * 2,
      c: ['#e8ecff', '#4fe3ff', '#ffd98a'][(Math.random() * 3) | 0]
    }))
  }
  resize()
  window.addEventListener('resize', resize)

  const mouse = { x: w / 2, y: h / 2 }
  const bh = { x: w / 2, y: h / 2 }
  let px = bh.x, py = bh.y                  // previous pos for velocity
  let lastMove = -1e9
  let active = false
  let master = 0                            // global fade 0..1

  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY
    lastMove = performance.now()
    if (!active) {
      bh.x = mouse.x; bh.y = mouse.y
      px = mouse.x; py = mouse.y
      active = true
      document.documentElement.classList.add('bh-cursor')
    }
  }, { passive: true })
  // pointer left the window — collapse quickly instead of lingering
  document.documentElement.addEventListener('mouseleave', () => {
    lastMove = Math.min(lastMove, performance.now() - 2500)
  })

  let last = performance.now()
  function tick() {
    if (!active) return
    if (document.hidden) { last = performance.now(); return }
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    // fade in fast, hold while moving, fade out 2.5s after the last move
    const idle = now - lastMove
    const target = idle < 2500 ? 1 : Math.max(0, 1 - (idle - 2500) / 900)
    master += (target - master) * Math.min(1, dt * 8)
    if (target === 0 && master < 0.02) {
      ctx.clearRect(0, 0, w, h)
      active = false
      master = 0
      world?.setLens(bh.x, bh.y, 0)
      document.documentElement.classList.remove('bh-cursor')
      return
    }

    // the mass IS the pointer now — near-1:1 tracking with a soft settle
    bh.x += (mouse.x - bh.x) * Math.min(1, dt * 26)
    bh.y += (mouse.y - bh.y) * Math.min(1, dt * 26)
    const vx = (bh.x - px) / Math.max(dt, 1e-4), vy = (bh.y - py) / Math.max(dt, 1e-4)
    px = bh.x; py = bh.y
    const speed = Math.hypot(vx, vy)
    const warp = Math.min(speed * 0.00035, 0.16) // fast motion stretches the throat
    const velA = Math.atan2(vy, vx)
    const t = now / 1000

    // the 3D world bends around the same point
    world?.setLens(bh.x, bh.y, master, WARP_R, CORE)

    ctx.clearRect(0, 0, w, h)

    // ---- lensed starfield (additive) ----
    ctx.globalCompositeOperation = 'lighter'
    for (const st of stars) {
      const rx = st.x - bh.x, ry = st.y - bh.y
      const b = Math.hypot(rx, ry)
      if (b > RANGE || b < 1e-3) continue
      const ux = rx / b, uy = ry / b
      const root = Math.sqrt(b * b + 4 * E * E)
      const theta = (b + root) / 2                 // primary image
      const near = 1 - b / RANGE                   // stars only exist near the lens
      const twinkle = 0.75 + 0.25 * Math.sin(t * 2.4 + st.tw)
      const a = master * near * (0.35 + 0.65 * near) * twinkle
      if (a < 0.015) continue

      const ax = bh.x + ux * theta, ay = bh.y + uy * theta
      const stretch = Math.min(1 + (3 * E) / b, 7)  // tangential magnification
      const len = st.s * stretch * 2.2
      ctx.strokeStyle = st.c
      ctx.globalAlpha = Math.min(a, 0.85)
      ctx.lineWidth = st.s
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(ax - uy * len / 2, ay + ux * len / 2)
      ctx.lineTo(ax + uy * len / 2, ay - ux * len / 2)
      ctx.stroke()

      // secondary image: demagnified, inside the ring, opposite side
      const theta2 = (E * E) / theta
      if (theta2 > CORE * 1.15) {
        ctx.globalAlpha = Math.min(a * 0.45, 0.4)
        ctx.beginPath()
        ctx.arc(bh.x - ux * theta2, bh.y - uy * theta2, st.s * 0.55, 0, Math.PI * 2)
        ctx.fillStyle = st.c
        ctx.fill()
      }
    }

    // ---- the hole itself: Gargantua, pocket-sized ----
    // Interstellar anatomy — a razor-thin accretion disk seen edge-on. The far
    // side of the disk is lensed into a vertical halo ring wrapping over and
    // under the shadow; the near side crosses IN FRONT of the shadow's lower
    // half; doppler beaming makes the approaching (left) side burn brighter.
    // Warm white→amber, with only a whisper of the site's pink at the rim.
    ctx.save()
    ctx.translate(bh.x, bh.y)
    ctx.rotate(velA)
    ctx.scale(1 + warp, 1 - warp * 0.6)
    ctx.rotate(-velA)

    const S = E * 0.55 // shadow radius

    // draws the flattened disk band. Doppler beaming is an OFFSET radial
    // hotspot on the approaching arm — gradients only, no clips, no seams.
    const diskBand = a => {
      ctx.save()
      ctx.translate(0, E * 0.05)
      ctx.scale(1, 0.16)
      const g = ctx.createRadialGradient(0, 0, E * 0.5, 0, 0, E * 2.15)
      g.addColorStop(0, 'rgba(255, 243, 224, 0)')
      g.addColorStop(0.28, 'rgba(255, 243, 224, 0.95)')
      g.addColorStop(0.55, 'rgba(255, 191, 118, 0.75)')
      g.addColorStop(1, 'rgba(255, 138, 61, 0)')
      ctx.globalAlpha = a
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(0, 0, E * 2.15, 0, Math.PI * 2); ctx.fill()
      const gb = ctx.createRadialGradient(-E * 1.05, 0, 0, -E * 1.05, 0, E * 1.5)
      gb.addColorStop(0, 'rgba(255, 252, 245, 0.9)')
      gb.addColorStop(1, 'rgba(255, 252, 245, 0)')
      ctx.globalAlpha = a * 0.7
      ctx.fillStyle = gb
      ctx.beginPath(); ctx.arc(0, 0, E * 2.15, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    }

    // soft thermal glow, pink only at the very rim to sit in the palette
    const glow = ctx.createRadialGradient(0, 0, S, 0, 0, E * 2.7)
    glow.addColorStop(0, 'rgba(255, 176, 96, 0.07)')
    glow.addColorStop(0.6, 'rgba(255, 130, 120, 0.025)')
    glow.addColorStop(1, 'rgba(255, 179, 30, 0)')
    ctx.globalAlpha = master
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(0, 0, E * 2.7, 0, Math.PI * 2); ctx.fill()

    // lensed halo — the far side of the disk bent over/under the shadow
    const halo = ctx.createRadialGradient(0, 0, S * 1.05, 0, 0, E * 1.35)
    halo.addColorStop(0, 'rgba(255, 240, 214, 0)')
    halo.addColorStop(0.35, 'rgba(255, 240, 214, 0.55)')
    halo.addColorStop(0.6, 'rgba(255, 187, 112, 0.30)')
    halo.addColorStop(1, 'rgba(255, 138, 61, 0)')
    ctx.globalAlpha = master * 0.32
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(0, 0, E * 1.35, 0, Math.PI * 2); ctx.fill()

    // far side of the disk (will be occluded by the shadow)
    diskBand(master * 0.8)

    // the shadow — a soft-edged void that swallows everything behind it
    ctx.globalCompositeOperation = 'source-over'
    const void_ = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 1.12)
    void_.addColorStop(0, 'rgba(3, 2, 8, 1)')
    void_.addColorStop(0.82, 'rgba(3, 2, 8, 0.98)')
    void_.addColorStop(1, 'rgba(3, 2, 8, 0)')
    ctx.globalAlpha = master
    ctx.fillStyle = void_
    ctx.beginPath(); ctx.arc(0, 0, S * 1.12, 0, Math.PI * 2); ctx.fill()

    // photon ring hugging the shadow — the last orbit of light
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = master * 0.32
    ctx.strokeStyle = 'rgba(255, 244, 228, 0.85)'
    ctx.lineWidth = 0.8
    ctx.shadowColor = 'rgba(255, 205, 150, 0.6)'
    ctx.shadowBlur = 3
    ctx.beginPath(); ctx.arc(0, 0, S * 1.06, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0

    // the far side of the disk, gravitationally bent over the TOP of the
    // shadow — the Interstellar arch. It springs from the disk line on both
    // sides (arc endpoints sit exactly on y=0) and wraps across the crown;
    // a dimmer, demagnified mirror image hugs the underside.
    const arch = (r, a0, a1, w, col, alpha) => {
      ctx.globalAlpha = master * alpha
      ctx.strokeStyle = col
      ctx.lineWidth = w
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(0, 0, r, a0, a1); ctx.stroke()
    }
    arch(E * 0.85, Math.PI, 2 * Math.PI, E * 0.30, 'rgba(255, 170, 95, 0.35)', 0.5)  // soft outer glow
    arch(E * 0.85, Math.PI, 2 * Math.PI, E * 0.16, 'rgba(255, 214, 160, 0.8)', 0.55) // arch body
    arch(E * 0.85, Math.PI * 1.04, Math.PI * 1.55, E * 0.11, 'rgba(255, 248, 238, 0.9)', 0.5) // doppler shoulder
    arch(E * 0.72, 0, Math.PI, E * 0.10, 'rgba(255, 190, 130, 0.7)', 0.28)           // under-arch

    // near side of the disk crossing in front of the shadow — the signature
    // Interstellar silhouette. Full redraw at reduced weight: no clip seams.
    diskBand(master * 0.6)

    // Occult the UPPER half of the disk's central crossing: that part of the
    // ring sits BEHIND the black hole, so it must be fully hidden — the near
    // side only passes in FRONT of the shadow's lower half. Paint a solid,
    // opaque void over the top-central region (radius inside the photon ring,
    // so ring, arch and the outer disc lobes are untouched).
    const occl = ctx.createRadialGradient(0, 0, 0, 0, 0, S)
    occl.addColorStop(0, 'rgba(3, 2, 8, 1)')
    occl.addColorStop(0.78, 'rgba(3, 2, 8, 1)')
    occl.addColorStop(1, 'rgba(3, 2, 8, 0)')
    ctx.save()
    ctx.beginPath(); ctx.rect(-S, -S, 2 * S, S); ctx.clip() // upper half only
    ctx.globalAlpha = master
    ctx.fillStyle = occl
    ctx.beginPath(); ctx.arc(0, 0, S, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    ctx.restore()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  gsap.ticker.add(tick)
}
