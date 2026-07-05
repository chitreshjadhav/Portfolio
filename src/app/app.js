import { createWorld } from './world.js'
import { initScroll } from './scroll.js'
import { enhanceAll } from './mediaFrame.js'

export async function start(caps) {
  const canvas = document.getElementById('world')
  const world = createWorld(canvas, caps)
  world.preload('ch0') // the cold open must be ready immediately
  initScroll(world)
  enhanceAll({ staticMode: false })
}
