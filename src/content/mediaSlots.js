// Video-slot manifest. File contract:
//   clip:   /public/media/clips/<id>.mp4  (or .webm — tried first)
//   poster: /public/media/posters/<id>.svg (committed, always present)
// Matching <figure data-slot="id"> elements live in index.html.

export const SLOTS = [
  { id: 'ep01-datastream', chapter: 'ch2', aspect: '16/9' },
  { id: 'ep02-warehouse', chapter: 'ch3', aspect: '16/9' },
  { id: 'ep03-constellation', chapter: 'ch4', aspect: '16/9' },
  { id: 'ep04-commanddeck', chapter: 'ch5', aspect: '16/9' },
  { id: 'builds-circuit', chapter: 'ch6', aspect: '16/9' },
  { id: 'afterhours-headspin', chapter: 'ch7', aspect: '9/16' },
  { id: 'afterhours-parkour', chapter: 'ch7', aspect: '16/9' }
]
