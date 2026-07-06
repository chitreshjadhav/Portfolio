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
      c: ['#e8ecff', '#4fe3ff', '#ffb7d5'][(Math.random() * 3) | 0]
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

    // ---- the hole itself, warped along its velocity ----
    ctx.save()
    ctx.translate(bh.x, bh.y)
    ctx.rotate(velA)
    ctx.scale(1 + warp, 1 - warp * 0.6)
    ctx.rotate(-velA)

    // ambient glow — soft, no rim
    const halo = ctx.createRadialGradient(0, 0, E * 0.5, 0, 0, E * 2.6)
    halo.addColorStop(0, 'rgba(79, 227, 255, 0.10)')
    halo.addColorStop(0.5, 'rgba(139, 92, 246, 0.05)')
    halo.addColorStop(1, 'rgba(139, 92, 246, 0)')
    ctx.globalAlpha = master
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(0, 0, E * 2.6, 0, Math.PI * 2); ctx.fill()

    // photon ring: a whisper of a full circle...
    ctx.lineCap = 'round'
    ctx.globalAlpha = master * 0.22
    ctx.strokeStyle = '#bfe9ff'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(0, 0, E, 0, Math.PI * 2); ctx.stroke()

    // ...with a doppler-bright arc sweeping it (approaching side beams)
    const sweep = t * 0.7
    for (const [span, alpha, lw, col, blur] of [
      [2.4, 0.28, 2.6, 'rgba(79, 227, 255, 1)', 10],
      [1.5, 0.5, 1.8, 'rgba(191, 233, 255, 1)', 8],
      [0.7, 0.75, 1.2, 'rgba(255, 235, 245, 1)', 6]
    ]) {
      ctx.globalAlpha = master * alpha
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.shadowColor = 'rgba(79, 227, 255, 0.8)'
      ctx.shadowBlur = blur
      ctx.beginPath(); ctx.arc(0, 0, E, sweep - span / 2, sweep + span / 2); ctx.stroke()
    }
    ctx.shadowBlur = 0

    // accretion arcs, counter-rotating, tucked between horizon and ring
    for (const [rad, spin, span, col, lw, alpha] of [
      [E * 0.74, t * 2.1, 1.9, 'rgba(255, 79, 163, 1)', 1.6, 0.3],
      [E * 0.9, -t * 1.5, 1.3, 'rgba(79, 227, 255, 1)', 1.2, 0.26]
    ]) {
      ctx.globalAlpha = master * alpha
      ctx.strokeStyle = col
      ctx.lineWidth = lw
      ctx.beginPath(); ctx.arc(0, 0, rad, spin, spin + span); ctx.stroke()
    }

    // event horizon — soft-edged void, drawn over the light (it swallows it)
    ctx.globalCompositeOperation = 'source-over'
    const void_ = ctx.createRadialGradient(0, 0, 0, 0, 0, CORE * 1.3)
    void_.addColorStop(0, 'rgba(2, 3, 10, 1)')
    void_.addColorStop(0.72, 'rgba(2, 3, 10, 0.97)')
    void_.addColorStop(1, 'rgba(2, 3, 10, 0)')
    ctx.globalAlpha = master
    ctx.fillStyle = void_
    ctx.beginPath(); ctx.arc(0, 0, CORE * 1.3, 0, Math.PI * 2); ctx.fill()

    ctx.restore()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  gsap.ticker.add(tick)
}
