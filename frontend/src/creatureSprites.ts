import { gameSpriteManifest, type GameSpriteManifestEntry } from './gameSpriteManifest'

export type SpriteDirection = 'front' | 'back' | 'left' | 'right'

export interface CreatureSprite extends GameSpriteManifestEntry {
  images: Record<SpriteDirection, HTMLImageElement[]>
  /** Fraction of each frame that is empty below the creature, measured once. */
  anchors: Record<SpriteDirection, number>
}

/** Walk cycles read best a little quicker than the 60 fps source frames. */
export const SPRITE_FRAME_SECONDS = 0.1

const manifestByForm = new Map(gameSpriteManifest.map((entry) => [entry.formId, entry]))
const spriteCache = new Map<string, Promise<CreatureSprite | null>>()

export function spriteUrl(formId: string, direction: SpriteDirection, frame: number): string | null {
  const entry = manifestByForm.get(formId)
  if (!entry) return null
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}game/sprites/${entry.folder}/${direction}/${direction}_${String(frame).padStart(2, '0')}.png`
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load sprite ${url}`))
    image.src = url
  })
}

async function loadDirections(entry: GameSpriteManifestEntry): Promise<Record<SpriteDirection, HTMLImageElement[]>> {
  const directions: SpriteDirection[] = ['front', 'back', 'left', 'right']
  const images = {} as Record<SpriteDirection, HTMLImageElement[]>
  await Promise.all(directions.map(async (direction) => {
    const urls = Array.from({ length: entry.frames[direction] }, (_, frame) => spriteUrl(entry.formId, direction, frame))
    images[direction] = await Promise.all(urls.map((url) => loadImage(url!)))
  }))
  return images
}

/**
 * Measures how much empty space the walk frames leave under the creature, so
 * the runner can plant the sprite on the ground instead of letting it float.
 * The largest padding across the cycle is used to keep the animation steady.
 */
function measureAnchor(images: HTMLImageElement[]): number {
  const canvas = document.createElement('canvas')
  canvas.width = images[0].width
  canvas.height = images[0].height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return 0

  let anchor = 0
  for (const image of images) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let lastOpaque = -1
    for (let y = canvas.height - 1; y >= 0 && lastOpaque < 0; y -= 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (data[(y * canvas.width + x) * 4 + 3] > 16) {
          lastOpaque = y
          break
        }
      }
    }
    const padding = (canvas.height - 1 - lastOpaque) / canvas.height
    if (padding > anchor) anchor = padding
  }
  return anchor
}

/**
 * Loads (and caches) every walk frame of a companion form. Resolves to null
 * when the form has no sprite set, so callers can fall back to the
 * hand-authored pixel art.
 */
export function loadCreatureSprite(formId: string): Promise<CreatureSprite | null> {
  const cached = spriteCache.get(formId)
  if (cached) return cached

  const entry = manifestByForm.get(formId)
  if (!entry) {
    const missing = Promise.resolve(null)
    spriteCache.set(formId, missing)
    return missing
  }

  const promise = loadDirections(entry)
    .then((images) => ({
      ...entry,
      images,
      anchors: {
        front: measureAnchor(images.front),
        back: measureAnchor(images.back),
        left: measureAnchor(images.left),
        right: measureAnchor(images.right),
      },
    }))
    .catch((error: unknown) => {
      console.warn(`Sprite set for "${formId}" could not be loaded. Falling back to pixel art.`, error)
      return null
    })
  spriteCache.set(formId, promise)
  return promise
}

export function spriteFrame(
  sprite: CreatureSprite,
  direction: SpriteDirection,
  elapsedSeconds: number,
  frameSeconds = SPRITE_FRAME_SECONDS,
): HTMLImageElement {
  const frames = sprite.images[direction]
  const index = Math.max(0, Math.floor(elapsedSeconds / frameSeconds)) % frames.length
  return frames[index]
}

/** Draws a frame with the creature's feet resting on `footY`. */
export function drawSpriteFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  footY: number,
  maxWidth: number,
  maxHeight: number,
  anchor = 0,
): void {
  const rawScale = Math.min(maxWidth / image.width, maxHeight / image.height)
  const scale = rawScale >= 1 ? Math.floor(rawScale) : rawScale
  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)
  const left = Math.round(centerX - width / 2)
  const top = Math.round(footY - height + height * anchor)
  context.imageSmoothingEnabled = false
  context.drawImage(image, left, top, width, height)
}
