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

  // ---- cursor gravitational-lens pass ----
  // While the black-hole cursor is active the scene renders into a target and
  // a screen-space shader deflects pixels toward the lens within a small
  // radius (point-mass deflection ∝ 1/r, faded to zero at the rim so there is
  // no seam), with slight chromatic separation. Costs one extra blit, and only
  // while the cursor is live — idle frames keep the direct-to-screen path.
  const lens = { x: -1e4, y: -1e4, amt: 0, radius: 110, core: 11 }
  let lensRT = null
  const lensSize = new THREE.Vector2()
  const lensMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uLens: { value: new THREE.Vector2(-1e4, -1e4) },
      uRadius: { value: 1 },
      uCore: { value: 1 },
      uAmt: { value: 0 }
    },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uRes;
      uniform vec2 uLens;
      uniform float uRadius;
      uniform float uCore;
      uniform float uAmt;
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 d = gl_FragCoord.xy - uLens;
        float r = max(length(d), 0.0001);
        vec4 col;
        if (r < uRadius && uAmt > 0.001) {
          vec2 dir = d / r;
          float x = r / uRadius;
          float fall = (1.0 - x) * (1.0 - x);
          float defl = uAmt * fall * uCore * uCore * 3.2 / max(r, uCore);
          float ca = defl * 0.14;
          col = vec4(
            texture2D(tDiffuse, uv - dir * (defl + ca) / uRes).r,
            texture2D(tDiffuse, uv - dir * defl / uRes).g,
            texture2D(tDiffuse, uv - dir * max(defl - ca, 0.0) / uRes).b,
            1.0);
        } else {
          col = texture2D(tDiffuse, uv);
        }
        gl_FragColor = linearToOutputTexel(col);
      }`
  })
  const lensScene = new THREE.Scene()
  lensScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMat))
  const lensCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  // ambient set dressing that follows the camera between stations
  const grid = gridFloor()
  scene.add(grid)
  const dust = makePoints(tier === 2 ? 500 : 220, { color: 0xff6fb3, size: 0.09, spread: 90, opacity: 0.5 })
  const dust2 = makePoints(tier === 2 ? 350 : 150, { color: 0x4fe3ff, size: 0.07, spread: 90, opacity: 0.45 })
  scene.add(dust, dust2)

  const chapters = new Map()
  const byIndex = []
  CHAPTERS.forEach((def, index) => {
    const ch = {
      def, index,
      handle: null, group: null,
      loading: null, built: false, gen: 0,
      targetP: 0, smoothP: 0, active: false
    }
    chapters.set(def.id, ch)
    byIndex[index] = ch
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
      const gen = ch.gen // dispose bumps gen: a build finishing after disposal is discarded
      ch.loading = (async () => {
        const mod = await ch.def.load()
        const handle = await mod.build({ world, tier, station: stationZ(ch.index), index: ch.index })
        if (ch.gen !== gen) { handle.dispose?.(); return }
        ch.handle = handle
        ch.group = handle.group
        if (ch.group) {
          ch.group.visible = false
          scene.add(ch.group)
        }
        ch.built = true
        refreshVisibility()
        dirty = true
      })().catch(err => {
        console.error(`chapter ${id} failed to build`, err)
        if (ch.gen === gen) ch.loading = null
      })
      return ch.loading
    },

    setProgress(id, p) {
      const ch = chapters.get(id)
      if (!ch) return
      ch.targetP = p
      dirty = true
    },

    // cursor black hole: CSS-pixel position + 0..1 strength (0 disables the pass)
    setLens(x, y, amt, radius, core) {
      lens.x = x; lens.y = y; lens.amt = amt
      if (radius) lens.radius = radius
      if (core) lens.core = core
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
        ch.gen++
        ch.handle?.dispose?.()
        if (ch.group) { scene.remove(ch.group); ch.group = null }
        ch.handle = null
        ch.built = false
        ch.loading = null
      }
    })
  }

  // Camera rides the rails at constant progress-rate within each chapter.
  // Poses are C0-continuous (chapter[i].to == chapter[i+1].from), so a plain
  // linear map keeps velocity non-zero across every boundary — no ease-to-zero
  // stop between sections, no mid-chapter "read hold" freeze. The smoothP
  // exponential lerp below absorbs the speed change at cuts, so the flight
  // reads as one continuous glide rather than a series of starts and stops.
  function applyCamera() {
    const ch = byIndex[currentIndex]
    if (!ch) return
    const t = ch.smoothP
    const { from, to } = ch.def.cam
    pos.copy(fromV.set(...from.pos)).lerp(toV.set(...to.pos), t)
    look.copy(fromV.set(...from.look)).lerp(toV.set(...to.look), t)
    const pose = { pos, look }
    ch.handle?.updateCamera?.(ch.smoothP, pose)
    camera.position.copy(pose.pos)
    camera.lookAt(pose.look)
    // ambience follows the flight. The grid snaps in 20-unit steps (its cell
    // is 400/120 ≈ 3.33 units — 20 is a whole multiple, so the snap is
    // invisible). The dust clouds must follow CONTINUOUSLY: snapping them
    // teleported every particle at once, a visible hitch during the flight.
    grid.position.z = Math.round(camera.position.z / 20) * 20
    dust.position.z = camera.position.z
    dust2.position.z = camera.position.z
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

    // softer inertia (dt*6) absorbs discrete wheel steps into one glide
    let scrollAnim = false
    chapters.forEach(ch => {
      const d = ch.targetP - ch.smoothP
      if (Math.abs(d) > 0.0005) {
        ch.smoothP += d * Math.min(1, dt * 6)
        scrollAnim = true
      } else {
        ch.smoothP = ch.targetP
      }
    })
    let animating = scrollAnim

    const cur = byIndex[currentIndex]
    const continuous = cur?.handle && (typeof cur.handle.continuous === 'function'
      ? cur.handle.continuous() : cur.handle.continuous)
    if (continuous) animating = true

    if (!dirty && !animating) return

    // lite tier idles continuous scenes at 30fps, but the scroll flight always
    // gets full frame rate — capping it is what reads as stutter
    if (frameBudget && !scrollAnim) {
      acc += dt
      if (acc < frameBudget) return
      acc = 0
    }

    chapters.forEach(ch => {
      if (ch.handle?.update && ch.group?.visible) ch.handle.update(dt, now / 1000, ch.smoothP)
    })
    applyCamera()
    if (lens.amt > 0.01) {
      renderer.getDrawingBufferSize(lensSize)
      if (!lensRT) lensRT = new THREE.WebGLRenderTarget(lensSize.x, lensSize.y)
      else if (lensRT.width !== lensSize.x || lensRT.height !== lensSize.y) lensRT.setSize(lensSize.x, lensSize.y)
      renderer.setRenderTarget(lensRT)
      renderer.render(scene, camera)
      renderer.setRenderTarget(null)
      const dpr = renderer.getPixelRatio()
      lensMat.uniforms.tDiffuse.value = lensRT.texture
      lensMat.uniforms.uRes.value.copy(lensSize)
      lensMat.uniforms.uLens.value.set(lens.x * dpr, lensSize.y - lens.y * dpr)
      lensMat.uniforms.uRadius.value = lens.radius * dpr
      lensMat.uniforms.uCore.value = lens.core * dpr
      lensMat.uniforms.uAmt.value = lens.amt
      renderer.render(lensScene, lensCam)
    } else {
      renderer.render(scene, camera)
    }
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
