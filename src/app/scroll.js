import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CHAPTERS } from './registry.js'

// Sticky sections do the pinning (pure CSS — no pin spacers, no CLS).
// ScrollTrigger is just a progress mapper: section progress → world camera
// + a scrubbed overlay timeline per chapter.

export function initScroll(world) {
  gsap.registerPlugin(ScrollTrigger)
  ScrollTrigger.config({ ignoreMobileResize: true })

  const railByHash = {}
  document.querySelectorAll('.rail a').forEach(a => { railByHash[a.getAttribute('href')] = a })

  CHAPTERS.forEach((def, i) => {
    const section = document.querySelector(`[data-chapter="${def.id}"]`)
    if (!section) return
    const railLink = railByHash['#' + section.id]

    const overlay = section.querySelector('.overlay')
    const items = overlay ? [...overlay.children] : []
    let tl = null
    if (items.length) {
      tl = gsap.timeline({ paused: true })
      if (i === 0) {
        // hero starts fully visible; it only sails away as the dive begins
        tl.to(items, { autoAlpha: 0, y: -60, stagger: 0.02, duration: 0.3, ease: 'power1.in' }, 0.35)
      } else {
        tl.fromTo(items,
          { autoAlpha: 0, y: 44 },
          // immediateRender so items are hidden from build time — without it they
          // render visible at section entry, snap invisible at 5%, then fade in
          { autoAlpha: 1, y: 0, stagger: 0.035, duration: 0.16, ease: 'power2.out', immediateRender: true }, 0.05)
        if (i < CHAPTERS.length - 1) {
          tl.to(items, { autoAlpha: 0, y: -34, stagger: 0.02, duration: 0.1, ease: 'power1.in' }, 0.88)
        }
      }
      tl.progress(0).pause()
    }

    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate(self) {
        world.setProgress(def.id, self.progress) // world lerps internally (smoothP)
        // overlay timelines get the same inertia so text never snaps with raw scroll
        if (tl) gsap.to(tl, { progress: self.progress, duration: 0.45, ease: 'power2.out', overwrite: true })
      },
      onToggle(self) {
        world.setActive(def.id, self.isActive)
        railLink?.classList.toggle('active', self.isActive)
      }
    })

    // fetch + build one viewport ahead so the set is dressed before the camera arrives
    ScrollTrigger.create({
      trigger: section,
      start: 'top 250%',
      once: true,
      onEnter: () => world.preload(def.id)
    })
  })

  // Anchor links (hero CTA + rail dots + top nav) smooth-scroll to their
  // target. Sticky chapters land MID-chapter (40% in) — at progress 0 the
  // overlay copy is still faded out, so a native jump looked like a dead
  // click. Plain in-page sections like #about land at their top.
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const href = a.getAttribute('href')
    if (!href || href.length < 2) return
    a.addEventListener('click', e => {
      const sec = document.querySelector(href)
      if (!sec || sec.id === 'top') return
      const isChapter = sec.classList.contains('chapter')
      if (!isChapter && sec.tagName !== 'SECTION') return
      e.preventDefault()
      const y = isChapter
        ? sec.offsetTop + Math.max(0, (sec.offsetHeight - innerHeight) * 0.4)
        : sec.offsetTop
      window.scrollTo({ top: y, behavior: 'smooth' })
      history.replaceState(null, '', href)
    })
  })

  // the About interlude (not a 3D chapter) — rail dot + entrance reveal
  const about = document.querySelector('#about')
  if (about) {
    const aboutRail = railByHash['#about']
    ScrollTrigger.create({
      trigger: about, start: 'top 55%', end: 'bottom 45%',
      onToggle: self => aboutRail?.classList.toggle('active', self.isActive)
    })
    gsap.from(['#about .about-story > *', '#about .about-card'], {
      autoAlpha: 0, y: 42, stagger: 0.08, duration: 0.7, ease: 'power2.out',
      scrollTrigger: { trigger: about, start: 'top 72%', once: true }
    })
  }

  // EP04 character-status count-up, once, on approach
  ScrollTrigger.create({
    trigger: '#ep04',
    start: 'top 60%',
    once: true,
    onEnter() {
      document.querySelectorAll('.stat .num').forEach(el => {
        const target = Number(el.dataset.count) || 0
        const o = { v: 0 }
        gsap.to(o, {
          v: target, duration: 1.4, ease: 'power2.out',
          onUpdate: () => { el.textContent = String(Math.round(o.v)) }
        })
      })
    }
  })

  // hero hint dissolves after the first real scroll
  const hint = document.querySelector('[data-hint]')
  if (hint) {
    ScrollTrigger.create({
      start: 60, once: true,
      onEnter: () => gsap.to(hint, { autoAlpha: 0, duration: 0.5 })
    })
  }
}
