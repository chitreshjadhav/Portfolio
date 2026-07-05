import * as THREE from 'three'
import gsap from 'gsap'
import { CHAPTERS, stationZ } from './registry.js'
import { gridFloor } from '../lib/neon.js'
import { makePoints } from '../lib/particles.js'

// One canvas, one scene, one camera. Chapters are lazy Groups at stations
// along -Z. Rendering is demand-driven: we draw only while something moves.

const BG = 0x0d0f1f

export function createWorld(canvas, caps) {
  const tier = caps.tier
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier === 2,
    powerPreference: 'high-performance'
  })
  renderer.setClearColor(BG, 1)
  let dprCap = tier === 2 ? 2 : 1.5
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap))

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(BG, 0.016)

  const camera = new THREE.PerspectiveCamera(55, 2, 0.1, 320)

  // ambient set dressing that follows the camera between stations
  const grid = gridFloor()
  scene.add(grid)
  const dust = makePoints(tier === 2 ? 500 : 220, { color: 0xff6fb3, size: 0.09, spread: 90, opacity: 0.5 })
  const dust2 = makePoints(tier === 2 ? 350 : 150, { color: 0x4fe3ff, size: 0.07, spread: 90, opacity: 0.45 })
  scene.add(dust, dust2)

  const chapters = new Map()
  CHAPTERS.forEach((def, index) => {
    chapters.set(def.id, {
      def, index,
      handle: null, group: null,
      loading: null, built: false,
      targetP: 0, smoothP: 0, active: false
    })
  })

  // dev-only continuity check: every cut must be invisible
  if (import.meta.env.DEV) {
    for (let i = 0; i < CHAPTERS.length - 1; i++) {
      const a = CHAPTERS[i].cam.to, b = CHAPTERS[i + 1].cam.from
      const d = Math.hypot(...a.pos.map((v, k) => v - b.pos[k]))
      if (d > 0.001) console.warn(`camera pose gap between ${CHAPTERS[i].id} → ${CHAPTERS[i + 1].id} (${d.toFixed(2)} units)`)
    }
  }

  let dirty = true
  let currentIndex = 0
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const fromV = new THREE.Vector3(), toV = new THREE.Vector3()

  const world = {
    scene, camera, renderer, tier, canvas,
    requestRender() { dirty = true },

    async preload(id) {
      const ch = chapters.get(id)
      if (!ch || ch.built || ch.loading) return ch?.loading
      ch.loading = (async () => {
        const mod = await ch.def.load()
        const handle = await mod.build({ world, tier, station: stationZ(ch.index), index: ch.index })
        ch.handle = handle
        ch.group = handle.group
        if (ch.group) {
          ch.group.position.z = 0 // chapters position themselves in world coords via station arg
          ch.group.visible = false
          scene.add(ch.group)
        }
        ch.built = true
        refreshVisibility()
        dirty = true
      })().catch(err => {
        console.error(`chapter ${id} failed to build`, err)
        ch.loading = null
      })
      return ch.loading
    },

    setProgress(id, p) {
      const ch = chapters.get(id)
      if (!ch) return
      ch.targetP = p
      dirty = true
    },

    setActive(id, active) {
      const ch = chapters.get(id)
      if (!ch) return
      ch.active = active
      if (active) {
        currentIndex = ch.index
        world.preload(id)
        const next = CHAPTERS[ch.index + 1]
        if (next) world.preload(next.id)
        refreshVisibility()
        disposeFar()
      }
      ch.handle?.setActive?.(active)
      dirty = true
    }
  }

  function refreshVisibility() {
    chapters.forEach(ch => {
      if (ch.group) ch.group.visible = Math.abs(ch.index - currentIndex) <= 1
    })
  }

  function disposeFar() {
    if (tier === 2) return // plenty of memory: keep visited chapters warm
    chapters.forEach(ch => {
      if (ch.built && Math.abs(ch.index - currentIndex) >= 3) {
        ch.handle?.dispose?.()
        if (ch.group) { scene.remove(ch.group); ch.group = null }
        ch.handle = null
        ch.built = false
        ch.loading = null
      }
    })
  }

  // camera: linear pose lerp with a "read hold" in the middle of each chapter
  // (move in the first and last thirds, hold steady while the copy is up)
  function camCurve(p) {
    const a = smoothstep(p / 0.38)
    const b = smoothstep((p - 0.62) / 0.38)
    return (a + b) / 2
  }
  function smoothstep(x) {
    x = Math.min(1, Math.max(0, x))
    return x * x * (3 - 2 * x)
  }

  function applyCamera() {
    const ch = [...chapters.values()].find(c => c.index === currentIndex)
    if (!ch) return
    const t = camCurve(ch.smoothP)
    const { from, to } = ch.def.cam
    pos.copy(fromV.set(...from.pos)).lerp(toV.set(...to.pos), t)
    look.copy(fromV.set(...from.look)).lerp(toV.set(...to.look), t)
    const pose = { pos, look }
    ch.handle?.updateCamera?.(ch.smoothP, pose)
    camera.position.copy(pose.pos)
    camera.lookAt(pose.look)
    // ambience follows the flight
    const zBase = Math.round(camera.position.z / 20) * 20
    grid.position.z = zBase
    dust.position.z = zBase
    dust2.position.z = zBase
  }

  // ---- demand-driven render loop ----
  let last = performance.now()
  let acc = 0
  const frameBudget = tier === 2 ? 0 : 1 / 30 // lite idles at 30fps
  let slowFrames = 0

  function tick() {
    if (document.hidden) { last = performance.now(); return }
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now

    let animating = false
    chapters.forEach(ch => {
      const d = ch.targetP - ch.smoothP
      if (Math.abs(d) > 0.0005) {
        ch.smoothP += d * Math.min(1, dt * 9)
        animating = true
      } else {
        ch.smoothP = ch.targetP
      }
    })

    const cur = [...chapters.values()].find(c => c.index === currentIndex)
    const continuous = cur?.handle && (typeof cur.handle.continuous === 'function'
      ? cur.handle.continuous() : cur.handle.continuous)
    if (continuous) animating = true

    if (!dirty && !animating) return

    if (frameBudget) {
      acc += dt
      if (acc < frameBudget) return
      acc = 0
    }

    chapters.forEach(ch => {
      if (ch.handle?.update && ch.group?.visible) ch.handle.update(dt, now / 1000, ch.smoothP)
    })
    applyCamera()
    renderer.render(scene, camera)
    dirty = false

    // live quality guard: sustained slow frames step the DPR down once per level
    if (animating && dt > 0.024) {
      if (++slowFrames > 90 && dprCap > 1) {
        dprCap = dprCap > 1.5 ? 1.5 : 1
        renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap))
        slowFrames = 0
      }
    } else if (slowFrames > 0) slowFrames--
  }

  gsap.ticker.add(tick)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) world.requestRender() })

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    dirty = true
  }
  window.addEventListener('resize', resize)
  resize()

  return world
}
