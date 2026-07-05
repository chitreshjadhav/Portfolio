// Drop-in video slots. Each <figure class="media-frame" data-slot="id"> holds a
// poster <img>. If /media/clips/<id>.webm or .mp4 exists (HEAD check, memoized),
// the poster upgrades to a <video>. Missing clip = poster stays, zero dead UI.
// Drop a correctly named file into public/media/clips/ and redeploy — no code changes.

const EXTS = ['webm', 'mp4']

async function findClip(slot) {
  const cacheKey = 'clip:' + slot
  const cached = sessionStorage.getItem(cacheKey)
  if (cached !== null) return cached || null
  for (const ext of EXTS) {
    const url = `/media/clips/${slot}.${ext}`
    try {
      const res = await fetch(url, { method: 'HEAD' })
      // Vite's dev server SPA-fallbacks missing files to index.html — require a video type
      const type = res.headers.get('content-type') || ''
      if (res.ok && type.startsWith('video')) {
        sessionStorage.setItem(cacheKey, url)
        return url
      }
    } catch { /* network hiccup → poster is fine */ }
  }
  sessionStorage.setItem(cacheKey, '')
  return null
}

function upgrade(figure, url, staticMode) {
  const img = figure.querySelector('img')
  if (!img) return
  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'none'
  video.poster = img.currentSrc || img.src
  video.width = img.width
  video.height = img.height
  video.setAttribute('aria-label', img.alt)
  video.src = url
  let io = null
  if (staticMode) {
    video.controls = true
  } else {
    io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.4) video.play().catch(() => {})
        else video.pause()
      })
    }, { threshold: [0, 0.4] })
    io.observe(video)
  }
  video.addEventListener('error', () => {
    io?.disconnect()
    video.replaceWith(img)
  }, { once: true })
  img.replaceWith(video)
}

export function enhanceAll({ staticMode = false } = {}) {
  const run = () => {
    document.querySelectorAll('.media-frame[data-slot]').forEach(async figure => {
      const url = await findClip(figure.dataset.slot)
      if (url) upgrade(figure, url, staticMode)
    })
  }
  'requestIdleCallback' in window ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1500)
}
