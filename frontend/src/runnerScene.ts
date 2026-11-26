import * as THREE from 'three'
import type { Creature } from '@trailkin/shared'
import { SPRITE_FRAME_SECONDS, loadCreatureSprite, type CreatureSprite, type SpriteDirection } from './creatureSprites'
import { drawPixelCreature } from './pixelCreatures'
import { PLAYER_HEIGHT, PLAYER_Z, platformTopAt, type PlatformLike } from './runnerMechanics'
import { CITY_THEMES, cityAtScore, type CityTheme } from './cities'

export type RunnerObjectKind = 'coin' | 'barrier' | 'branch' | 'platform' | 'powerup'
export type PowerupKind = 'magnet' | 'double' | 'sneakers' | 'hoverboard'

export interface RunnerObject {
  id: number
  lane: number
  z: number
  kind: RunnerObjectKind
  length: number
  height: number
  y: number
  ramp: boolean
  powerup?: PowerupKind
  collected: boolean
  resolved: boolean
}

export interface RunnerPowerups {
  magnet: boolean
  double: boolean
  sneakers: boolean
  hoverboard: boolean
}

export interface RunnerRenderState {
  lane: number
  elapsed: number
  distance: number
  y: number
  velocityY: number
  sliding: boolean
  grounded: boolean
  objects: RunnerObject[]
  powerups: RunnerPowerups
  cityId: string
  pickup: { kind: PowerupKind; progress: number } | null
  reducedMotion: boolean
}

export type RunnerBurstKind = 'coin' | 'powerup' | 'crash' | 'land'

export interface RunnerScene {
  render(state: RunnerRenderState): void
  burst(kind: RunnerBurstKind, x: number, y: number, z: number): void
  shake(strength: number): void
  dispose(): void
}

export interface RunnerSceneOptions {
  formId?: string
}

const LANE_SPACING = 2.4
const LANE_X = (lane: number) => (lane - 1) * LANE_SPACING
const SPRITE_DIRECTIONS: SpriteDirection[] = ['front', 'back', 'left', 'right']
const SCENERY_SPAN = 180

function flat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color })
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite)) return
    if ('geometry' in object) object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if ('map' in material && material.map) material.map.dispose()
      material.dispose()
    }
  })
}

function makeGroundTexture(renderer: THREE.WebGLRenderer, kind: 'grass' | 'path', tile?: HTMLImageElement): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the ground texture.')

  const pattern = tile ? context.createPattern(tile, 'repeat') : null
  if (pattern) {
    context.imageSmoothingEnabled = false
    context.fillStyle = pattern
    context.fillRect(0, 0, size, size)
  } else if (kind === 'grass') {
    const wash = context.createLinearGradient(0, 0, size, size)
    wash.addColorStop(0, '#72c94d')
    wash.addColorStop(0.5, '#66bc42')
    wash.addColorStop(1, '#79ce53')
    context.fillStyle = wash
    context.fillRect(0, 0, size, size)
    const blades = ['#8ade5d', '#5fb43a', '#9ae96b', '#4fa32f', '#a6f078']
    for (let index = 0; index < 1400; index += 1) {
      context.fillStyle = blades[index % blades.length]
      context.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 5, 2 + Math.random() * 6)
    }
    const flowers = ['#fff7b0', '#ffffff', '#ffb7d5', '#ffd166', '#ff9a8b']
    for (let index = 0; index < 90; index += 1) {
      context.fillStyle = flowers[index % flowers.length]
      const x = Math.random() * size
      const y = Math.random() * size
      context.fillRect(x, y, 3, 3)
      context.fillRect(x + 3, y + 1, 2, 2)
    }
  } else {
    context.fillStyle = '#e9d6a6'
    context.fillRect(0, 0, size, size)
    const grains = ['#dfc78f', '#f2e2b8', '#d8bd82', '#f7e9c6']
    for (let index = 0; index < 900; index += 1) {
      context.fillStyle = grains[index % grains.length]
      context.fillRect(Math.random() * size, Math.random() * size, 3 + Math.random() * 6, 2 + Math.random() * 4)
    }
    for (let index = 0; index < 70; index += 1) {
      context.fillStyle = index % 3 === 0 ? '#c9a86a' : '#b99a63'
      context.beginPath()
      context.ellipse(Math.random() * size, Math.random() * size, 2 + Math.random() * 3, 1 + Math.random() * 2, 0, 0, Math.PI * 2)
      context.fill()
    }
  }

  if (kind === 'path') {
    // The Emerald sand tile is quite yellow; soften it toward a warm dirt trail.
    context.fillStyle = 'rgba(212, 199, 174, 0.34)'
    context.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  return texture
}

function makeSkyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the sky texture.')
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, top)
  gradient.addColorStop(0.55, bottom)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function loadImageAsset(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${url}`))
    image.src = url
  })
}

function makeBuildingTexture(image: HTMLImageElement): THREE.Texture {
  const texture = new THREE.Texture(image)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function makePetalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the petal texture.')
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.45, 'rgba(255, 249, 214, 1)')
  gradient.addColorStop(1, 'rgba(255, 249, 214, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}


function makeDustTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the dust texture.')
  context.fillStyle = '#ffffff'
  const puffs = [
    [4, 9, 5, 3],
    [8, 6, 5, 5],
    [2, 12, 10, 2],
    [10, 11, 3, 2],
  ]
  for (const [x, y, width, height] of puffs) context.fillRect(x, y, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 16
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the spark texture.')
  context.fillStyle = '#ffffff'
  context.fillRect(7, 1, 2, 14)
  context.fillRect(1, 7, 14, 2)
  context.fillRect(5, 5, 6, 6)
  context.clearRect(7, 7, 2, 2)
  context.fillRect(7, 7, 2, 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}


function makeCloudTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 32
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the cloud texture.')
  const offset = variant * 3
  const puffs = [
    [8 + offset, 15, 16, 10],
    [18 + offset, 10, 20, 15],
    [34 + offset, 14, 14, 9],
    [4 + offset, 20, 48, 6],
  ]
  context.fillStyle = '#cfe8ff'
  for (const [x, y, width, height] of puffs) context.fillRect(x, y + 2, width, height)
  context.fillStyle = '#ffffff'
  for (const [x, y, width, height] of puffs) context.fillRect(x, y, width, height - 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeHillTexture(seed: number, grass: HTMLImageElement | undefined): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the hill texture.')

  context.beginPath()
  context.moveTo(0, 96)
  for (let x = 0; x <= 512; x += 8) {
    const wave = 0.55 + 0.28 * Math.sin(x * 0.018 + seed * 2.1) + 0.12 * Math.sin(x * 0.051 + seed)
    const y = Math.round((96 - (28 + seed * 7) * wave) / 8) * 8
    context.lineTo(x, y)
  }
  context.lineTo(512, 96)
  context.closePath()
  context.fillStyle = seed === 0 ? '#4f9a4a' : seed === 1 ? '#5aa84f' : '#6cc25f'
  context.fill()

  context.save()
  context.clip()
  if (grass) {
    const pattern = context.createPattern(grass, 'repeat')
    if (pattern) {
      context.globalAlpha = 0.3
      context.fillStyle = pattern
      context.fillRect(0, 0, 512, 96)
      context.globalAlpha = 1
    }
  }
  context.fillStyle = 'rgba(20, 50, 25, 0.22)'
  context.fillRect(0, 78, 512, 18)
  context.restore()

  // A soft pixel tree line on the crest so the horizon reads as a route,
  // not a flat green band.
  const treePalette = seed === 0 ? ['#3f7a3a', '#4d8c45'] : seed === 1 ? ['#477f3a', '#5a9548'] : ['#5a9548', '#70ad59']
  for (let x = 4; x < 508; x += 11 + ((x * 7 + seed * 5) % 9)) {
    const wave = 0.55 + 0.28 * Math.sin(x * 0.018 + seed * 2.1) + 0.12 * Math.sin(x * 0.051 + seed)
    const crest = Math.round((96 - (28 + seed * 7) * wave) / 8) * 8
    const height = 4 + ((x + seed * 13) % 4)
    context.fillStyle = treePalette[(x + seed) % treePalette.length]
    context.fillRect(x, crest - height, 5, height)
    context.fillRect(x + 1, crest - height - 2, 3, 2)
    context.fillRect(x + 2, crest, 1, 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeCoinVisual(): THREE.Group {
  const group = new THREE.Group()
  const gold = new THREE.MeshStandardMaterial({ color: 0xffcf42, emissive: 0xffa81f, emissiveIntensity: 0.6, metalness: 0.55, roughness: 0.28 })
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 18), gold)
  disc.rotation.x = Math.PI / 2
  group.add(disc)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.04, 6, 18), flat(0xffe98a))
  group.add(rim)
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.08), flat(0xfff3b0))
  group.add(core)
  return group
}

function makeBarrierVisual(
  treeTexture: THREE.Texture | undefined,
  rockTexture: THREE.Texture | undefined,
  id: number,
): THREE.Group {
  const group = new THREE.Group()
  const texture = id % 2 === 0 ? rockTexture ?? treeTexture : treeTexture ?? rockTexture
  if (!texture) return group
  const image = texture.image as HTMLImageElement
  const isRock = texture === rockTexture
  const height = isRock ? 0.98 : 0.92
  const width = height * (image.width / image.height)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08 }))
  sprite.scale.set(width, height, 1)
  sprite.position.y = height / 2 + 0.015
  group.add(sprite)

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x1d3517, transparent: true, opacity: 0.26, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.scale.set(width * (isRock ? 0.62 : 0.52), isRock ? 0.25 : 0.29, 1)
  shadow.position.y = 0.035
  group.add(shadow)

  return group
}

function makeBranchVisual(): THREE.Group {
  const group = new THREE.Group()
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.15, 6), flat(0x8a5a33))
    post.position.set(side * 1.02, 1.05, 0)
    group.add(post)
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, 0.34), flat(0x6f4526))
  beam.position.y = 2.05
  group.add(beam)
  const leafColors = [0x4fae4b, 0x3f9a45, 0x7ad35f]
  for (let index = 0; index < 5; index += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), flat(leafColors[index % leafColors.length]))
    leaf.position.set(-0.88 + index * 0.44, 2.22 - (index % 2) * 0.16, 0)
    leaf.scale.y = 0.8
    group.add(leaf)
  }
  const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 4), flat(0x4fae4b))
  vine.position.set(0.2, 1.75, 0)
  group.add(vine)
  return group
}

function makePokeballEmblem(size: number): THREE.Group {
  const group = new THREE.Group()
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(size, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd94b4b, roughness: 0.42 }),
  )
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(size, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf7f3e8, roughness: 0.42 }),
  )
  group.add(top, bottom)

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(size * 1.005, size * 0.09, 6, 24),
    flat(0x2a2a2a),
  )
  group.add(band)

  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.27, size * 0.27, size * 0.16, 12),
    flat(0xf7f3e8),
  )
  button.rotation.x = Math.PI / 2
  button.position.z = size * 0.9
  group.add(button)

  const buttonRing = new THREE.Mesh(
    new THREE.TorusGeometry(size * 0.28, size * 0.045, 6, 16),
    flat(0x2a2a2a),
  )
  buttonRing.position.z = size * 0.97
  group.add(buttonRing)
  return group
}

function makePlatformVisual(length: number, height: number, ramp: boolean): THREE.Group {
  const group = new THREE.Group()
  const tall = height > 2
  const dirt = flat(tall ? 0x8d8f99 : 0x9a6b3f)
  const dirtDark = flat(tall ? 0x6c6e78 : 0x7a5230)
  const grass = flat(0x6cc45a)
  const materials = [dirt, dirt, grass, dirtDark, dirt, dirt]
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, height, length), materials)
  body.position.y = height / 2
  group.add(body)

  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.1, length + 0.1), flat(0x7fd268))
  lip.position.y = height + 0.02
  group.add(lip)

  if (tall) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.18, length + 0.02), flat(0xe8c56b))
    band.position.y = height - 0.4
    group.add(band)
  }

  const emblemSize = Math.min(0.48, height * 0.26)
  const emblem = makePokeballEmblem(emblemSize)
  emblem.position.set(0, height * 0.56, length / 2 + 0.05)
  group.add(emblem)

  for (let index = 0; index < 2; index += 1) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(1.96, height * 0.72, 0.36), flat(0x8f8a80))
    stone.position.set(0, height * 0.36, index === 0 ? -length / 2 + 0.2 : length / 2 - 0.2)
    group.add(stone)
  }

  for (let z = -length / 2 + 5; z < length / 2 - 1.5; z += 5.4) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.86, height * 0.82, 0.14), flat(tall ? 0x5d5f69 : 0x5f3f22))
    seam.position.set(0, height * 0.41, z)
    group.add(seam)
  }

  if (ramp) {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.24, 3.4), flat(0xc08f55))
    wedge.rotation.x = 0.4
    wedge.position.set(0, height * 0.5, length / 2 + 1.3)
    group.add(wedge)
  }

  const flowerColors = [0xff7ba8, 0xffd166, 0xfff3b0, 0xff9a8b]
  const flowerCount = Math.max(2, Math.floor(length / 5))
  for (let index = 0; index < flowerCount; index += 1) {
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 4),
      flat(flowerColors[index % flowerColors.length]),
    )
    flower.position.set(index % 2 === 0 ? -0.6 : 0.6, height + 0.16, -length / 2 + 2 + index * 4.2)
    group.add(flower)
  }
  return group
}

const powerupColors: Record<PowerupKind, number> = {
  magnet: 0xff6b57,
  double: 0x59d98f,
  sneakers: 0xffc247,
  hoverboard: 0x54d7ff,
}

const powerupBalls: Record<PowerupKind, string> = {
  magnet: 'ball-poke',
  double: 'ball-great',
  sneakers: 'ball-ultra',
  hoverboard: 'ball-master',
}

function makePowerupVisual(powerup: PowerupKind, texture: THREE.Texture | undefined): THREE.Group {
  const color = powerupColors[powerup]
  const group = new THREE.Group()

  // Soft coloured halo keeps the small ball readable against the scenery.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 20),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  halo.position.z = -0.04
  group.add(halo)

  if (texture) {
    const ball = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08, depthWrite: false }),
    )
    ball.scale.set(1.02, 1.02, 1)
    group.add(ball)
  } else {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.35 }),
    )
    group.add(core)
  }

  return group
}

function makeTextureSet(sprite: CreatureSprite | null, creature: Creature): Record<SpriteDirection, THREE.Texture[]> {
  if (sprite) {
    const textures = {} as Record<SpriteDirection, THREE.Texture[]>
    for (const direction of SPRITE_DIRECTIONS) {
      textures[direction] = sprite.images[direction].map((image) => {
        const texture = new THREE.Texture(image)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.needsUpdate = true
        return texture
      })
    }
    return textures
  }

  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the character texture.')
  drawPixelCreature(context, creature, 96, 96, 134)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return { front: [texture], back: [texture], left: [texture], right: [texture] }
}

interface SpriteRig {
  sprite: THREE.Sprite
  aspect: number
  /** Empty space under the creature inside its frame, as a fraction of height. */
  anchor: number
  setDirection(direction: SpriteDirection): void
  update(elapsed: number, reducedMotion: boolean, frameOffset: number): void
  dispose(): void
}

function makeSpriteRig(scene: THREE.Scene, sprite: CreatureSprite | null, creature: Creature, height: number): SpriteRig {
  const textures = makeTextureSet(sprite, creature)
  const aspect = sprite ? sprite.frameWidth / sprite.frameHeight : 1
  const anchor = sprite?.anchors.back ?? 0
  const material = new THREE.SpriteMaterial({
    map: textures.back[0],
    transparent: true,
    depthWrite: false,
    alphaTest: 0.03,
  })
  const object = new THREE.Sprite(material)
  object.scale.set(height * aspect, height, 1)
  scene.add(object)

  let direction: SpriteDirection = 'back'
  let appliedDirection: SpriteDirection | null = null
  let frameIndex = -1

  return {
    sprite: object,
    aspect,
    anchor,
    setDirection(next) {
      direction = next
    },
    update(elapsed, reducedMotion, frameOffset) {
      const frames = textures[direction]
      const index = reducedMotion ? 0 : Math.floor(elapsed / SPRITE_FRAME_SECONDS + frameOffset) % frames.length
      if (index === frameIndex && direction === appliedDirection) return
      frameIndex = index
      appliedDirection = direction
      material.map = frames[index]
      material.needsUpdate = true
    },
    dispose() {
      scene.remove(object)
      material.dispose()
      for (const list of Object.values(textures)) {
        for (const texture of new Set(list)) texture.dispose()
      }
    },
  }
}

function faceFromMotion(currentX: number, targetX: number): SpriteDirection {
  const delta = targetX - currentX
  if (delta > 0.06) return 'right'
  if (delta < -0.06) return 'left'
  return 'back'
}

function makeObjectVisual(
  object: RunnerObject,
  obstacleTreeTexture: THREE.Texture | undefined,
  obstacleRockTexture: THREE.Texture | undefined,
  powerupTexture: THREE.Texture | undefined,
): THREE.Group {
  if (object.kind === 'coin') return makeCoinVisual()
  if (object.kind === 'barrier') return makeBarrierVisual(obstacleTreeTexture, obstacleRockTexture, object.id)
  if (object.kind === 'branch') return makeBranchVisual()
  if (object.kind === 'powerup') return makePowerupVisual(object.powerup ?? 'magnet', powerupTexture)
  return makePlatformVisual(object.length, object.height, object.ramp)
}

export async function createRunnerScene(
  canvas: HTMLCanvasElement,
  creature: Creature,
  options: RunnerSceneOptions = {},
): Promise<RunnerScene> {
  const mount = canvas.parentElement
  const baseUrl = import.meta.env.BASE_URL ?? '/'
  const buildingNames = [...new Set(CITY_THEMES.flatMap((city) => city.buildings))]
  const uiNames = ['stat-arrow-attack', 'stat-arrow-defense', 'stat-arrow-accuracy', 'stat-arrow-speed', 'ghost-gastly', 'ghost-haunter', 'veg-pine-large', 'veg-pine-small', 'veg-flowers', 'obstacle-tree', 'obstacle-rock', 'tile-grass', 'tile-path', 'ball-poke', 'ball-great', 'ball-ultra', 'ball-master']
  const [playerSprite, buildingEntries, uiEntries] = await Promise.all([
    loadCreatureSprite(options.formId ?? creature.forms[0]?.id ?? creature.id),
    Promise.all(buildingNames.map(async (name) => {
      const image = await loadImageAsset(`${baseUrl}game/buildings/${name}.png`)
      return [name, image] as const
    })),
    Promise.all(uiNames.map(async (name) => {
      const image = await loadImageAsset(`${baseUrl}game/ui/${name}.png`)
      return [name, image] as const
    })),
  ])
  const buildingTextures = new Map<string, THREE.Texture>(
    buildingEntries.map(([name, image]) => [name, makeBuildingTexture(image)]),
  )
  const uiTextures = new Map<string, THREE.Texture>(
    uiEntries.map(([name, image]) => [name, makeBuildingTexture(image)]),
  )

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.02

  const scene = new THREE.Scene()
  const skyTextures = new Map(CITY_THEMES.map((city) => [city.id, makeSkyTexture(city.skyTop, city.skyBottom)]))
  let currentCity = cityAtScore(0)
  scene.background = skyTextures.get(currentCity.id) ?? null
  scene.fog = new THREE.Fog(currentCity.fog, 80, 200)

  const camera = new THREE.PerspectiveCamera(52, 2, 0.1, 220)
  camera.position.set(0, 4.7, 9.9)
  camera.lookAt(0, 1.5, -10)

  scene.add(new THREE.HemisphereLight(0xfffbe8, 0x6fae55, 2.15))
  const sunlight = new THREE.DirectionalLight(0xfff2c4, 2.35)
  sunlight.position.set(16, 24, 10)
  scene.add(sunlight)

  const grassTile = uiTextures.get('tile-grass')?.image as HTMLImageElement | undefined
  const pathTile = uiTextures.get('tile-path')?.image as HTMLImageElement | undefined
  const groundTexture = makeGroundTexture(renderer, 'grass', grassTile)
  const GROUND_REPEAT_Y = 15
  const PATH_REPEAT_Y = 54
  groundTexture.repeat.set(8, GROUND_REPEAT_Y)
  const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 280), groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, 0, -80)
  scene.add(ground)

  const pathTexture = makeGroundTexture(renderer, 'path', pathTile)
  pathTexture.repeat.set(1.5, PATH_REPEAT_Y)
  const pathMaterial = new THREE.MeshLambertMaterial({ map: pathTexture })
  const path = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 280), pathMaterial)
  path.rotation.x = -Math.PI / 2
  path.position.set(0, 0.02, -80)
  scene.add(path)

  for (const side of [-1, 1]) {
    const verge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 270), flat(0x7a6544))
    verge.position.set(side * 3.65, 0.06, -80)
    scene.add(verge)
  }

  const laneDashes: THREE.Mesh[] = []
  const dashSpan = 130
  for (const dividerX of [-LANE_SPACING / 2, LANE_SPACING / 2]) {
    for (let index = 0; index < 24; index += 1) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 2.2),
        new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.55 }),
      )
      dash.rotation.x = -Math.PI / 2
      dash.position.set(dividerX, 0.03, -120)
      scene.add(dash)
      laneDashes.push(dash)
    }
  }

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  sunGlow.position.set(34, 34, -130)
  scene.add(sunGlow)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(4.4, 18, 14), new THREE.MeshBasicMaterial({ color: 0xfff6cf }))
  sun.position.copy(sunGlow.position)
  scene.add(sun)

  const grassImage = uiTextures.get('tile-grass')?.image as HTMLImageElement | undefined
  const hillTextures = [makeHillTexture(0, grassImage), makeHillTexture(1, grassImage), makeHillTexture(2, grassImage)]
  const horizonMaterials: THREE.MeshBasicMaterial[] = []
  hillTextures.forEach((texture, index) => {
    const height = 30
    const width = height * (512 / 96)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
    horizonMaterials.push(material)
    const hill = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    hill.position.set(0, height / 2, -120 - (2 - index) * 6)
    scene.add(hill)
  })

  const cloudTextures = [makeCloudTexture(0), makeCloudTexture(1)]
  const cloudSprites: { sprite: THREE.Sprite; baseX: number; baseY: number; phase: number }[] = []
  for (let index = 0; index < 9; index += 1) {
    const texture = cloudTextures[index % cloudTextures.length]
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.95 }))
    const scale = 6 + Math.random() * 4.5
    sprite.scale.set(scale, scale * 0.5, 1)
    const baseX = -46 + index * 11 + Math.random() * 6
    const baseY = 17 + Math.random() * 9
    sprite.position.set(baseX, baseY, -70 - Math.random() * 60)
    scene.add(sprite)
    cloudSprites.push({ sprite, baseX, baseY, phase: Math.random() * Math.PI * 2 })
  }

  const scenery: { object: THREE.Object3D; baseZ: number }[] = []
  const addScenery = (object: THREE.Object3D, z: number) => {
    scene.add(object)
    scenery.push({ object, baseZ: z })
    object.position.z = z
  }

  const addBillboard = (texture: THREE.Texture | undefined, height: number, x: number, z: number) => {
    if (!texture) return
    const image = texture.image as HTMLImageElement
    const width = height * (image.width / image.height)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08 }))
    sprite.scale.set(width, height, 1)
    sprite.position.set(x, height / 2, 0)
    addScenery(sprite, z)
  }

  const distribute = (
    texture: THREE.Texture | undefined,
    count: number,
    minHeight: number,
    maxHeight: number,
    minX: number,
    maxX: number,
    offset: number,
  ) => {
    const perSide = Math.ceil(count / 2)
    for (let index = 0; index < count; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const slot = Math.floor(index / 2)
      const baseZ = -SCENERY_SPAN + ((slot + offset + Math.random() * 0.55) / perSide) * SCENERY_SPAN
      const height = minHeight + Math.random() * (maxHeight - minHeight)
      addBillboard(texture, height, side * (minX + Math.random() * (maxX - minX)), baseZ)
    }
  }

  distribute(uiTextures.get('veg-pine-large'), 16, 3.2, 4.2, 12, 17.5, 0.1)
  distribute(uiTextures.get('veg-pine-small'), 12, 1.8, 2.6, 9.5, 14, 0.3)
  distribute(uiTextures.get('veg-flowers'), 16, 0.5, 0.7, 3.9, 4.8, 0.7)

  const petalCount = 90
  const petalPositions = new Float32Array(petalCount * 3)
  const petalBaseZ = new Float32Array(petalCount)
  for (let index = 0; index < petalCount; index += 1) {
    petalPositions[index * 3] = (Math.random() - 0.5) * 24
    petalPositions[index * 3 + 1] = 0.6 + Math.random() * 7
    petalBaseZ[index] = -30 - Math.random() * 60
    petalPositions[index * 3 + 2] = petalBaseZ[index]
  }
  const petalGeometry = new THREE.BufferGeometry()
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3))
  const petalMaterial = new THREE.PointsMaterial({
    color: 0xfff4c9,
    size: 0.24,
    map: makePetalTexture(),
    transparent: true,
    opacity: 0.9,
    alphaTest: 0.02,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const petals = new THREE.Points(petalGeometry, petalMaterial)
  scene.add(petals)

  const cityGroup = new THREE.Group()
  scene.add(cityGroup)
  let cityScenery: { object: THREE.Mesh; baseZ: number; baseX: number; side: number }[] = []

  const disposeCity = () => {
    for (const item of cityScenery) {
      cityGroup.remove(item.object)
      item.object.geometry.dispose()
      const material = item.object.material
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
      else material.dispose()
    }
    cityScenery = []
  }

  const buildCity = (city: CityTheme) => {
    disposeCity()
    let index = 0
    for (const side of [-1, 1]) {
      for (let slot = 0; slot < 8; slot += 1) {
        const name = city.buildings[index % city.buildings.length]
        index += 1
        const texture = buildingTextures.get(name)
        if (!texture) continue
        const image = texture.image as HTMLImageElement
        const landmark = ['celadon-store', 'pokemon-tower', 'museum', 'celadon-mansion', 'game-corner'].includes(name)
        const smallProp = name === 'sign' || name === 'mailbox'
        const height = smallProp
          ? 0.8 + Math.random() * 0.3
          : landmark
            ? 4.4 + Math.random() * 1.0
            : 3.4 + Math.random() * 1.2
        const width = height * (image.width / image.height)
        const tint = city.id === 'lavender' ? 0x9a92b8 : 0xffffff
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.4, color: tint }),
        )
        const x = smallProp
          ? side * (3.85 + Math.random() * 0.55)
          : side * (4.9 + width / 2 + Math.random() * 1.2)
        plane.position.set(x, height / 2, 0)
        const baseZ = -SCENERY_SPAN + ((slot + 0.35 + (side === 1 ? 0.5 : 0)) / 8) * SCENERY_SPAN + (Math.random() - 0.5) * 2.5
        plane.position.z = baseZ
        cityGroup.add(plane)
        cityScenery.push({ object: plane, baseZ, baseX: x, side })
      }
    }
    currentCity = city
    scene.background = skyTextures.get(city.id) ?? null
    scene.fog?.color.set(city.fog)
    groundMaterial.color.set(city.grassTint)
    pathMaterial.color.set(city.pathTint).lerp(new THREE.Color(0xd6c4a0), 0.32)
    horizonMaterials.forEach((material) => material.color.set(city.id === 'lavender' ? 0x9a92c8 : 0xffffff))
    const night = city.id === 'lavender'
    ;(sun.material as THREE.MeshBasicMaterial).color.setHex(night ? 0xcfc4ff : 0xfff6cf)
    ;(sunGlow.material as THREE.MeshBasicMaterial).opacity = night ? 0.14 : 0.28
  }

  buildCity(currentCity)

  const player = makeSpriteRig(scene, playerSprite, creature, PLAYER_HEIGHT)
  player.sprite.position.set(0, PLAYER_HEIGHT / 2, PLAYER_Z)

  const playerShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 22),
    new THREE.MeshBasicMaterial({ color: 0x1d3517, transparent: true, opacity: 0.28, depthWrite: false }),
  )
  playerShadow.rotation.x = -Math.PI / 2
  playerShadow.scale.set(1.5, 0.66, 1)
  playerShadow.position.set(0, 0.035, PLAYER_Z)
  scene.add(playerShadow)

  const magnetAura = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a6b, transparent: true, opacity: 0.8, depthWrite: false }),
  )
  magnetAura.rotation.x = Math.PI / 2
  magnetAura.visible = false
  scene.add(magnetAura)

  const sneakerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.85, depthWrite: false }),
  )
  sneakerRing.rotation.x = Math.PI / 2
  sneakerRing.visible = false
  scene.add(sneakerRing)

  const hoverboardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.09, 0.44),
    new THREE.MeshStandardMaterial({ color: 0x5be0ff, emissive: 0x1b8fff, emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.3 }),
  )
  hoverboardMesh.visible = false
  scene.add(hoverboardMesh)

  const statOverlayMaterial = new THREE.ShaderMaterial({
    uniforms: {
      playerMap: { value: null },
      effectMap: { value: uiTextures.get('stat-arrow-attack') },
      opacity: { value: 0 },
      offsetY: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D playerMap;
      uniform sampler2D effectMap;
      uniform float opacity;
      uniform float offsetY;
      varying vec2 vUv;
      void main() {
        vec4 player = texture2D(playerMap, vUv);
        if (player.a < 0.1) discard;
        vec2 effectUv = fract(vUv * vec2(2.0, 2.0) + vec2(0.0, offsetY));
        vec4 effect = texture2D(effectMap, effectUv);
        vec4 offsetEffect = texture2D(effectMap, fract(effectUv + vec2(0.5, 0.5)));
        if (offsetEffect.a > effect.a) effect = offsetEffect;
        if (effect.a < 0.05) discard;
        gl_FragColor = vec4(effect.rgb, effect.a * opacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const statOverlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), statOverlayMaterial)
  statOverlay.renderOrder = 30
  statOverlay.visible = false
  scene.add(statOverlay)

  const arrowForPowerup: Record<PowerupKind, string> = {
    magnet: 'stat-arrow-defense',
    double: 'stat-arrow-attack',
    sneakers: 'stat-arrow-speed',
    hoverboard: 'stat-arrow-accuracy',
  }

  const ghostData: { sprite: THREE.Sprite; baseX: number; baseY: number; baseZ: number; phase: number }[] = []
  for (let index = 0; index < 8; index += 1) {
    const name = index % 2 === 0 ? 'ghost-gastly' : 'ghost-haunter'
    const texture = uiTextures.get(name)
    if (!texture) continue
    const image = texture.image as HTMLImageElement
    const height = 1.6 + Math.random() * 1.2
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.92, depthWrite: false }))
    sprite.scale.set(height * (image.width / image.height), height, 1)
    sprite.visible = false
    scene.add(sprite)
    ghostData.push({
      sprite,
      baseX: (index % 2 === 0 ? -1 : 1) * (7.5 + Math.random() * 4.5),
      baseY: 4.4 + Math.random() * 3,
      baseZ: -SCENERY_SPAN + Math.random() * SCENERY_SPAN,
      phase: Math.random() * Math.PI * 2,
    })
  }

  const objectVisuals = new Map<number, THREE.Group>()

  // --- Juice: dust, sparkles, shockwave and camera shake ---
  interface FxParticle {
    sprite: THREE.Sprite
    vx: number
    vy: number
    vz: number
    life: number
    maxLife: number
    size: number
    opacity: number
    gravity: number
    spin: number
  }

  const dustTexture = makeDustTexture()
  const sparkTexture = makeSparkTexture()

  const makeParticlePool = (texture: THREE.Texture, count: number, blending: THREE.Blending) => ({
    cursor: 0,
    particles: Array.from({ length: count }, () => {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending,
        alphaTest: 0.01,
      })
      const sprite = new THREE.Sprite(material)
      sprite.visible = false
      scene.add(sprite)
      return {
        sprite,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.2,
        opacity: 1,
        gravity: 0,
        spin: 0,
      } satisfies FxParticle
    }),
  })

  const dustPool = makeParticlePool(dustTexture, 44, THREE.NormalBlending)
  const coinPool = makeParticlePool(sparkTexture, 36, THREE.AdditiveBlending)
  const powerupPool = makeParticlePool(sparkTexture, 36, THREE.AdditiveBlending)
  const crashPool = makeParticlePool(sparkTexture, 28, THREE.AdditiveBlending)

  const spawnParticles = (
    pool: ReturnType<typeof makeParticlePool>,
    x: number,
    y: number,
    z: number,
    colors: number[],
    count: number,
    speed: number,
    life: number,
    size: number,
    opacity: number,
    gravity: number,
  ) => {
    for (let index = 0; index < count; index += 1) {
      const particle = pool.particles[pool.cursor++ % pool.particles.length]
      particle.sprite.visible = true
      particle.sprite.position.set(
        x + (Math.random() - 0.5) * 0.35,
        y + (Math.random() - 0.5) * 0.2,
        z + (Math.random() - 0.5) * 0.3,
      )
      const angle = Math.random() * Math.PI * 2
      const spread = 0.35 + Math.random() * 0.65
      particle.vx = Math.cos(angle) * speed * spread
      particle.vy = (0.35 + Math.random() * 0.65) * speed * (pool === dustPool ? 0.28 : 0.75)
      particle.vz = Math.sin(angle) * speed * spread * 0.6 + (pool === dustPool ? 1.1 : 0.25)
      particle.life = life * (0.7 + Math.random() * 0.6)
      particle.maxLife = particle.life
      particle.size = size * (0.7 + Math.random() * 0.7)
      particle.opacity = opacity
      particle.gravity = gravity
      particle.spin = (Math.random() - 0.5) * 6
      particle.sprite.scale.setScalar(particle.size)
      const material = particle.sprite.material as THREE.SpriteMaterial
      material.color.setHex(colors[index % colors.length])
      material.opacity = opacity
      material.rotation = Math.random() * Math.PI * 2
    }
  }

  const updateParticlePool = (pool: ReturnType<typeof makeParticlePool>, delta: number) => {
    for (const particle of pool.particles) {
      if (!particle.sprite.visible) continue
      particle.life -= delta
      if (particle.life <= 0) {
        particle.sprite.visible = false
        continue
      }
      particle.vy -= particle.gravity * delta
      particle.sprite.position.x += particle.vx * delta
      particle.sprite.position.y += particle.vy * delta
      particle.sprite.position.z += particle.vz * delta
      const t = particle.life / particle.maxLife
      const material = particle.sprite.material as THREE.SpriteMaterial
      material.opacity = particle.opacity * t
      material.rotation += particle.spin * delta
      particle.sprite.scale.setScalar(particle.size * (0.65 + (1 - t) * 0.85))
    }
  }

  const powerupRing = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.44, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff0a8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  powerupRing.rotation.x = -Math.PI / 2
  powerupRing.visible = false
  scene.add(powerupRing)

  let lastFxTime = 0
  let lastDistance = 0
  let dustClock = 0
  let shakeAmount = 0
  let powerupRingLife = 0

  const triggerBurst = (kind: RunnerBurstKind, x: number, y: number, z: number) => {
    if (kind === 'coin') {
      spawnParticles(coinPool, x, y, z, [0xffe27a, 0xfff6c8, 0xffb347], 5, 2.4, 0.45, 0.2, 0.95, 4.2)
    } else if (kind === 'powerup') {
      spawnParticles(powerupPool, x, y + 0.8, z, [0xfff3b0, 0xffffff, 0x9af2d9], 14, 3.2, 0.65, 0.28, 0.95, 3.4)
      powerupRing.position.set(x, y + 0.05, z)
      powerupRingLife = 0.55
      powerupRing.visible = true
      shakeAmount = Math.max(shakeAmount, 0.16)
    } else if (kind === 'crash') {
      spawnParticles(crashPool, x, y, z, [0xff9a70, 0xfff0c0, 0xff5e4a], 22, 5.2, 0.85, 0.38, 1, 3.6)
      spawnParticles(dustPool, x, Math.max(0.08, y - 0.4), z, [0xf2e6c8, 0xd8c9a8], 10, 2.2, 0.6, 0.32, 0.4, -0.2)
      shakeAmount = Math.max(shakeAmount, 1)
    } else {
      spawnParticles(dustPool, x, y + 0.06, z, [0xf2e6c8, 0xd8c9a8], 9, 1.7, 0.55, 0.3, 0.38, -0.2)
    }
  }

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth || mount?.clientWidth || 1)
    const height = Math.max(1, canvas.clientHeight || width / 2)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  let disposed = false
  return {
    render(state) {
      if (disposed) return
      const fxNow = performance.now()
      const fxDelta = lastFxTime === 0 ? 0 : Math.min(0.05, (fxNow - lastFxTime) / 1000)
      lastFxTime = fxNow
      shakeAmount = Math.max(0, shakeAmount - fxDelta * 3.1)
      const shakeX = state.reducedMotion ? 0 : (Math.random() - 0.5) * shakeAmount * 0.34
      const shakeY = state.reducedMotion ? 0 : (Math.random() - 0.5) * shakeAmount * 0.22
      if (state.cityId !== currentCity.id) {
        const nextCity = CITY_THEMES.find((city) => city.id === state.cityId)
        if (nextCity) {
          buildCity(nextCity)
          const vegetationTint = nextCity.id === 'lavender' ? 0x9a92b8 : 0xffffff
          for (const item of scenery) {
            if (item.object instanceof THREE.Sprite) {
              ;(item.object.material as THREE.SpriteMaterial).color.setHex(vegetationTint)
            }
          }
        }
      }
      const knownIds = new Set(state.objects.map((object) => object.id))
      for (const [id, visual] of objectVisuals) {
        if (knownIds.has(id)) continue
        scene.remove(visual)
        disposeTree(visual)
        objectVisuals.delete(id)
      }

      for (const object of state.objects) {
        let visual = objectVisuals.get(object.id)
        if (!visual) {
          visual = makeObjectVisual(
            object,
            uiTextures.get('obstacle-tree'),
            uiTextures.get('obstacle-rock'),
            uiTextures.get(powerupBalls[object.powerup ?? 'magnet']),
          )
          scene.add(visual)
          objectVisuals.set(object.id, visual)
        }
        visual.position.set(LANE_X(object.lane), 0, object.z)
        if (object.kind === 'coin') {
          let coinX = LANE_X(object.lane)
          let coinY = object.y + (state.reducedMotion ? 0 : Math.sin(state.elapsed * 3 + object.id) * 0.08)
          if (state.powerups.magnet) {
            const dz = Math.abs(object.z - PLAYER_Z)
            if (dz < 12) {
              const pull = 1 - dz / 12
              coinX = THREE.MathUtils.lerp(coinX, player.sprite.position.x, pull)
              coinY = THREE.MathUtils.lerp(coinY, state.y + 1, pull)
            }
          }
          visual.position.x = coinX
          visual.position.y = coinY
          visual.rotation.y = state.reducedMotion ? 0 : Math.sin(state.elapsed * 2.4 + object.id) * 0.6
        } else if (object.kind === 'powerup') {
          visual.position.y = object.y + (state.reducedMotion ? 0 : Math.sin(state.elapsed * 3 + object.id) * 0.12)
          const pulse = state.reducedMotion ? 1 : 1 + Math.sin(state.elapsed * 4.2 + object.id) * 0.06
          visual.scale.setScalar(pulse)
        }
      }

      const scroll = state.distance
      groundTexture.offset.y = (scroll / (280 / GROUND_REPEAT_Y)) % 1
      pathTexture.offset.y = (scroll / (280 / PATH_REPEAT_Y)) % 1

      const sceneryOffset = scroll % SCENERY_SPAN
      for (const item of scenery) {
        let z = item.baseZ + sceneryOffset
        while (z > 2.2) z -= SCENERY_SPAN
        item.object.position.z = z
        if (item.object instanceof THREE.Sprite) {
          const material = item.object.material as THREE.SpriteMaterial
          material.opacity = 1
          item.object.visible = true
        }
      }

      for (const item of cityScenery) {
        let z = item.baseZ + sceneryOffset
        while (z > -1) z -= SCENERY_SPAN
        item.object.position.z = z
        item.object.position.x = item.baseX
        const material = item.object.material as THREE.MeshBasicMaterial
        material.opacity = 1
        item.object.visible = true
      }

      const ghostsVisible = currentCity.id === 'lavender'
      for (const ghost of ghostData) {
        ghost.sprite.visible = ghostsVisible
        if (!ghostsVisible) continue
        let z = ghost.baseZ + sceneryOffset
        while (z > 14) z -= SCENERY_SPAN
        ghost.sprite.position.set(
          ghost.baseX + Math.sin(state.elapsed * 0.7 + ghost.phase) * 0.7,
          ghost.baseY + Math.sin(state.elapsed * 1.6 + ghost.phase) * 0.45,
          z,
        )
      }

      const dashSpacing = dashSpan / 24
      for (let index = 0; index < laneDashes.length; index += 1) {
        const dash = laneDashes[index]
        dash.position.x = Math.floor(index / 24) === 0 ? -LANE_SPACING / 2 : LANE_SPACING / 2
        dash.position.z = -120 + ((index % 24) * dashSpacing + scroll) % dashSpan
      }

      for (const cloud of cloudSprites) {
        cloud.sprite.position.x = cloud.baseX + Math.sin(state.elapsed * 0.06 + cloud.phase) * 2.4
        cloud.sprite.position.y = cloud.baseY + Math.sin(state.elapsed * 0.3 + cloud.phase) * 0.2
      }

      const positions = petals.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let index = 0; index < petalCount; index += 1) {
        const z = petalBaseZ[index] + (scroll * 0.55) % 90
        positions.setZ(index, z > 10 ? z - 90 : z)
      }
      positions.needsUpdate = true
      petals.rotation.y = state.reducedMotion ? 0 : Math.sin(state.elapsed * 0.2) * 0.08

      const platforms = state.objects.filter((object) => object.kind === 'platform') as PlatformLike[]
      const support = platformTopAt(platforms, state.lane, PLAYER_Z)

      const targetX = LANE_X(state.lane)
      player.sprite.position.x = THREE.MathUtils.damp(player.sprite.position.x, targetX, 12, 1 / 60)
      const followX = player.sprite.position.x * 0.38
      camera.position.x = THREE.MathUtils.damp(camera.position.x, followX, 5, 1 / 60)
      const cameraLift = support * 0.55
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 4.7 + cameraLift, 4, 1 / 60)
      camera.position.x += shakeX
      camera.position.y += shakeY
      camera.lookAt(camera.position.x * 0.55 + shakeX * 0.35, 1.55 + support * 0.35 + shakeY * 0.35, -10)
      const spriteHeight = state.sliding ? PLAYER_HEIGHT * 0.56 : PLAYER_HEIGHT
      const bob = state.reducedMotion || !state.grounded ? 0 : Math.sin(state.elapsed * 9) * 0.05
      player.sprite.position.y = state.y + spriteHeight * (0.5 - player.anchor) + bob
      player.sprite.scale.set(
        PLAYER_HEIGHT * player.aspect * (state.sliding ? 1.06 : 1),
        spriteHeight,
        1,
      )
      player.setDirection(faceFromMotion(player.sprite.position.x, targetX))
      player.update(state.elapsed, state.reducedMotion, 0)
      player.sprite.material.rotation = state.reducedMotion
        ? 0
        : THREE.MathUtils.clamp(state.velocityY * -0.012, -0.12, 0.12)

      const air = Math.max(0, state.y - support)
      playerShadow.position.set(player.sprite.position.x, support + 0.035, PLAYER_Z)
      playerShadow.scale.set(1.5 + air * 0.09, 0.66 + air * 0.05, 1)
      playerShadow.material.opacity = Math.max(0.1, 0.34 - air * 0.05)

      const instantSpeed = fxDelta > 0 ? Math.max(0, (state.distance - lastDistance) / fxDelta) : 0
      lastDistance = state.distance
      dustClock -= fxDelta
      if (state.grounded && instantSpeed > 4 && !state.reducedMotion) {
        if (dustClock <= 0) {
          dustClock = state.sliding ? 0.045 : 0.08 + Math.random() * 0.035
          spawnParticles(
            dustPool,
            player.sprite.position.x + (Math.random() - 0.5) * 0.3,
            state.y + 0.08,
            PLAYER_Z + 0.3,
            [0xf2e6c8, 0xd8c9a8],
            state.sliding ? 2 : 1,
            1.1,
            0.45,
            0.27,
            0.3,
            -0.2,
          )
        }
      } else {
        dustClock = Math.min(dustClock, 0.03)
      }

      updateParticlePool(dustPool, fxDelta)
      updateParticlePool(coinPool, fxDelta)
      updateParticlePool(powerupPool, fxDelta)
      updateParticlePool(crashPool, fxDelta)
      if (powerupRingLife > 0) {
        powerupRingLife = Math.max(0, powerupRingLife - fxDelta)
        const t = powerupRingLife / 0.55
        powerupRing.scale.setScalar(1 + (1 - t) * 3.4)
        ;(powerupRing.material as THREE.MeshBasicMaterial).opacity = t * 0.7
        powerupRing.visible = powerupRingLife > 0
      }

      magnetAura.visible = state.powerups.magnet
      if (magnetAura.visible) {
        magnetAura.position.set(player.sprite.position.x, state.y + 0.16, PLAYER_Z)
        magnetAura.rotation.z = state.reducedMotion ? 0 : state.elapsed * 1.4
        magnetAura.scale.setScalar(1 + (state.reducedMotion ? 0 : Math.sin(state.elapsed * 5) * 0.05))
      }

      sneakerRing.visible = state.powerups.sneakers
      if (sneakerRing.visible) {
        sneakerRing.position.set(player.sprite.position.x, state.y + 0.05, PLAYER_Z)
        sneakerRing.scale.setScalar(1 + (state.reducedMotion ? 0 : Math.sin(state.elapsed * 8) * 0.12))
      }

      hoverboardMesh.visible = state.powerups.hoverboard
      if (hoverboardMesh.visible) {
        hoverboardMesh.position.set(player.sprite.position.x, state.y + 0.03, PLAYER_Z)
        hoverboardMesh.rotation.y = state.reducedMotion ? 0 : Math.sin(state.elapsed * 2.4) * 0.14
      }

      if (state.pickup) {
        const effectTexture = uiTextures.get(arrowForPowerup[state.pickup.kind])
        const playerTexture = player.sprite.material.map
        if (effectTexture && playerTexture) {
          statOverlayMaterial.uniforms.effectMap.value = effectTexture
          statOverlayMaterial.uniforms.playerMap.value = playerTexture
          statOverlayMaterial.uniforms.offsetY.value = state.pickup.progress * 1.5
          statOverlayMaterial.uniforms.opacity.value = Math.max(0, Math.sin(Math.min(1, state.pickup.progress) * Math.PI)) * 1.05
          statOverlay.visible = true
          statOverlay.position.set(
            player.sprite.position.x,
            player.sprite.position.y,
            player.sprite.position.z + 0.02,
          )
          statOverlay.scale.set(player.sprite.scale.x, player.sprite.scale.y, 1)
          statOverlay.rotation.z = player.sprite.material.rotation
        }
      } else {
        statOverlay.visible = false
      }

      petals.material.opacity = state.reducedMotion ? 0.8 : 0.7 + Math.sin(state.elapsed * 1.4) * 0.12
      renderer.render(scene, camera)
    },
    burst(kind, x, y, z) {
      if (!disposed) triggerBurst(kind, x, y, z)
    },
    shake(strength) {
      if (!disposed) shakeAmount = Math.max(shakeAmount, strength)
    },
    dispose() {
      if (disposed) return
      disposed = true
      observer.disconnect()
      player.dispose()
      disposeCity()
      disposeTree(scene)
      for (const texture of buildingTextures.values()) texture.dispose()
      for (const texture of skyTextures.values()) texture.dispose()
      for (const texture of uiTextures.values()) texture.dispose()
      renderer.dispose()
    },
  }
}
