// Decides how much site this device gets. Three outcomes:
//   { mode: 'static' }            — no canvas, no motion, complete readable resume
//   { mode: 'lite',  tier: 1 }    — full 3D story, reduced counts/DPR, no parallax extras
//   { mode: 'full',  tier: 2 }    — everything
// User's Motion toggle (localStorage) beats media queries in both directions.

export function detect() {
  const stored = localStorage.getItem('motion') // 'on' | 'off' | null
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData = navigator.connection?.saveData === true
  const motionOff = stored ? stored === 'off' : (reduced || saveData)

  if (motionOff) return { mode: 'static', tier: 0, motionOff: true }
  if (!probeWebGL()) return { mode: 'static', tier: 0, motionOff: false }

  const mem = navigator.deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  const coarse = matchMedia('(pointer: coarse)').matches

  if (mem <= 2) return { mode: 'static', tier: 0, motionOff: false }

  const tier = (coarse || mem <= 4 || cores <= 4) ? 1 : 2
  return { mode: tier === 1 ? 'lite' : 'full', tier, motionOff: false }
}

function probeWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
