// The film's shot list. Stations sit along -Z, SPACING units apart.
// Camera poses are WORLD coordinates; each chapter's `to` must equal the next
// chapter's `from` — world.js asserts this in dev so the flight never pops.
// Poses live here (eager, tiny) so the camera works even before a lazy
// chapter chunk arrives.

export const SPACING = 140

export const CHAPTERS = [
  {
    id: 'ch0',
    load: () => import('../chapters/ch0-hero.js'),
    cam: { from: { pos: [0, 3, 17], look: [0, 1.2, 0] }, to: { pos: [0, 4, -70], look: [0, 1, -140] } }
  },
  {
    id: 'ch1',
    load: () => import('../chapters/ch1-origin.js'),
    cam: { from: { pos: [0, 4, -70], look: [0, 1, -140] }, to: { pos: [0, 2.5, -210], look: [0, 1, -280] } }
  },
  {
    id: 'ch2',
    load: () => import('../chapters/ch2-analyst.js'),
    cam: { from: { pos: [0, 2.5, -210], look: [0, 1, -280] }, to: { pos: [0, 2.5, -350], look: [0, 1, -420] } }
  },
  {
    id: 'ch3',
    load: () => import('../chapters/ch3-warehouse.js'),
    cam: { from: { pos: [0, 2.5, -350], look: [0, 1, -420] }, to: { pos: [0, 12, -480], look: [0, 2, -560] } }
  },
  {
    id: 'ch4',
    load: () => import('../chapters/ch4-marketplaces.js'),
    cam: { from: { pos: [0, 12, -480], look: [0, 2, -560] }, to: { pos: [0, 5, -630], look: [0, 2, -700] } }
  },
  {
    id: 'ch5',
    load: () => import('../chapters/ch5-commanddeck.js'),
    cam: { from: { pos: [0, 5, -630], look: [0, 2, -700] }, to: { pos: [0, 3, -770], look: [0, 2, -840] } }
  },
  {
    id: 'ch6',
    load: () => import('../chapters/ch6-builds.js'),
    cam: { from: { pos: [0, 3, -770], look: [0, 2, -840] }, to: { pos: [0, 7, -910], look: [0, 2, -980] } }
  },
  {
    id: 'ch7',
    load: () => import('../chapters/ch7-athlete.js'),
    cam: { from: { pos: [0, 7, -910], look: [0, 2, -980] }, to: { pos: [0, 2, -1050], look: [0, 1.5, -1120] } }
  },
  {
    id: 'ch8',
    load: () => import('../chapters/ch8-loadout.js'),
    cam: { from: { pos: [0, 2, -1050], look: [0, 1.5, -1120] }, to: { pos: [0, 6, -1190], look: [0, 3, -1260] } }
  },
  {
    id: 'ch9',
    load: () => import('../chapters/ch9-finale.js'),
    cam: { from: { pos: [0, 6, -1190], look: [0, 3, -1260] }, to: { pos: [0, 10, -1252], look: [0, 5, -1264] } }
  }
]

export function stationZ(index) {
  return -SPACING * index
}
