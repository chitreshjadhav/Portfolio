// Dossier cards: open by default in HTML (no-JS = everything readable).
// In 3D modes we collapse them into tap/click/Enter toggles.
export function initDossiers(collapse) {
  document.querySelectorAll('.dossier-toggle').forEach(btn => {
    const body = document.getElementById(btn.getAttribute('aria-controls'))
    if (!body) return
    if (collapse) {
      btn.setAttribute('aria-expanded', 'false')
      body.hidden = true
    } else {
      btn.setAttribute('aria-expanded', 'true')
      body.hidden = false
    }
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true'
      btn.setAttribute('aria-expanded', String(!open))
      body.hidden = open
    })
  })
}

// Motion: On/Off — persisted, beats prefers-reduced-motion in both directions.
// A reload is the cleanest way to tear down / boot the 3D world.
// State lives in the accessible name alone (no aria-pressed: pairing a
// pressed state with a label that also flips double-encodes and confuses SRs).
export function initMotionToggle(caps) {
  const btn = document.getElementById('motionToggle')
  if (!btn) return
  const on = caps.mode !== 'static'
  btn.removeAttribute('aria-pressed')
  btn.textContent = on ? 'Motion: On' : 'Motion: Off'
  btn.classList.toggle('is-off', !on)
  btn.addEventListener('click', () => {
    localStorage.setItem('motion', on ? 'off' : 'on')
    location.reload()
  })
}
