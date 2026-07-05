import { detect } from './app/capabilities.js'
import { initDossiers, initMotionToggle } from './app/a11y.js'

const caps = detect()
document.body.classList.add('js')

initDossiers(caps.mode !== 'static')
initMotionToggle(caps)

if (caps.mode === 'static') {
  document.body.classList.add('static-mode')
  import('./app/mediaFrame.js').then(m => m.enhanceAll({ staticMode: true }))
} else {
  document.body.classList.add('webgl-mode')
  import('./app/app.js')
    .then(m => m.start(caps))
    .catch(err => {
      console.error('3D boot failed — falling back to static mode', err)
      document.body.classList.remove('webgl-mode')
      document.body.classList.add('static-mode')
      import('./app/mediaFrame.js').then(m => m.enhanceAll({ staticMode: true }))
    })
}
