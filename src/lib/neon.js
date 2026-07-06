import * as THREE from 'three'

// The shared neon kit: wireframe basics + additive glow sprites + canvas text.
// No lights, no shadows, no postprocessing — glow is faked, exactly like the
// original site. Materials are cached and shared.

export const PALETTE = {
  bg: 0x0d0f1f,
  ink: 0x1a1f45,
  pink: 0xffb31e,
  sakura: 0xffd98a,
  cyan: 0x4fe3ff,
  violet: 0x8b5cf6,
  gold: 0xffe14d
}

const matCache = new Map()

export function wireMat(color, opacity = 0.9) {
  const key = `w:${color}:${opacity}`
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: opacity < 1, opacity
    }))
  }
  return matCache.get(key)
}

export function solidMat(color = PALETTE.ink) {
  const key = `s:${color}`
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshBasicMaterial({ color }))
  return matCache.get(key)
}

export function lineMat(color, opacity = 0.7) {
  const key = `l:${color}:${opacity}`
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.LineBasicMaterial({ color, transparent: true, opacity }))
  }
  return matCache.get(key)
}

// dark body + glowing wireframe shell — the signature object style
export function neonBox(w, h, d, color) {
  const g = new THREE.Group()
  const geo = new THREE.BoxGeometry(w, h, d)
  g.add(new THREE.Mesh(geo, solidMat()))
  g.add(new THREE.Mesh(geo, wireMat(color)))
  return g
}

let glowTex = null
export function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

export function glowSprite(color, scale = 2) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false
  }))
  s.scale.setScalar(scale)
  return s
}

// crisp canvas-texture label on a sprite (decorative — real text lives in the DOM)
export function textSprite(text, { color = '#4fe3ff', px = 42, pad = 18, font = 'Bebas Neue' } = {}) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  const f = `${px}px '${font}', 'Arial Narrow', sans-serif`
  ctx.font = f
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2
  const h = px + pad * 2
  c.width = w * 2; c.height = h * 2
  const cx = c.getContext('2d')
  cx.scale(2, 2)
  cx.font = f
  cx.textBaseline = 'middle'
  cx.shadowColor = color
  cx.shadowBlur = 14
  cx.fillStyle = color
  cx.fillText(text, pad, h / 2)
  const tex = new THREE.CanvasTexture(c)
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false
  }))
  spr.scale.set(w / 40, h / 40, 1)
  return spr
}

export function gridFloor() {
  const grid = new THREE.GridHelper(400, 120, PALETTE.cyan, 0x232849)
  grid.material.transparent = true
  grid.material.opacity = 0.35
  grid.position.y = -3.5
  return grid
}

export function disposeGroup(root) {
  root.traverse(obj => {
    obj.geometry?.dispose?.()
    const m = obj.material
    if (Array.isArray(m)) m.forEach(disposeMat)
    else if (m) disposeMat(m)
  })
}

function disposeMat(m) {
  if (isCached(m)) return
  if (m.map && m.map !== glowTex) m.map.dispose() // glowTex is shared across all chapters
  m.dispose()
}

function isCached(mat) {
  for (const v of matCache.values()) if (v === mat) return true
  return false
}
