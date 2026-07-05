import * as THREE from 'three'

// Tier-aware additive particle fields.

export function makePoints(count, {
  color = 0xffffff, size = 0.08, spread = 60, center = [0, 2, 0], opacity = 0.85
} = {}) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (Math.random() - 0.5) * spread
    pos[i * 3 + 1] = center[1] + (Math.random() - 0.5) * spread * 0.55
    pos[i * 3 + 2] = center[2] + (Math.random() - 0.5) * spread
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending
  }))
}

// bare positions buffer for scenes that drive every particle by hand
export function makeDynamicPoints(count, { color = 0xffffff, size = 0.06, opacity = 0.9 } = {}) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending
  }))
  pts.frustumCulled = false
  return pts
}
