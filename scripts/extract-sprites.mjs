/**
 * Extracts walk-cycle sprites for every companion and writes them to
 * `frontend/public/game/sprites/<species>/<direction>/`.
 *
 * Sources, in order:
 *   1. `assets/Sprites/sprite` — a full PMDCollab/SpriteCollab checkout. It is
 *      about 3 GB, so it is optional and gitignored.
 *   2. `assets/Sprites-Walk/sprite` — the committed walk sheet, AnimData and
 *      credits of each companion, so a clean clone can rebuild without it.
 *
 * Only three files per species are read: Walk-Anim.png, AnimData.xml and
 * credits.txt. The public sprite folders are what the game client loads at
 * runtime, so this script only needs to run when a companion is added or its
 * artwork changes.
 *
 * Usage: node scripts/extract-sprites.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoots = [
  { base: join(root, 'assets', 'Sprites', 'sprite'), label: 'assets/Sprites (full checkout)' },
  { base: join(root, 'assets', 'Sprites-Walk', 'sprite'), label: 'assets/Sprites-Walk (vendored)' },
]
const outputRoot = join(root, 'frontend', 'public', 'game', 'sprites')
const manifestPath = join(root, 'frontend', 'src', 'gameSpriteManifest.ts')

/**
 * Companion form -> SpriteCollab species. The order of the forms mirrors the
 * evolution lines declared in `backend/src/catalog.ts`.
 */
const companions = [
  { formId: 'bulbasaur', species: '0001', folder: 'bulbasaur' },
  { formId: 'ivysaur', species: '0002', folder: 'ivysaur' },
  { formId: 'venusaur', species: '0003', folder: 'venusaur' },
  { formId: 'charmander', species: '0004', folder: 'charmander' },
  { formId: 'charmeleon', species: '0005', folder: 'charmeleon' },
  { formId: 'charizard', species: '0006', folder: 'charizard' },
  { formId: 'squirtle', species: '0007', folder: 'squirtle' },
  { formId: 'wartortle', species: '0008', folder: 'wartortle' },
  { formId: 'blastoise', species: '0009', folder: 'blastoise' },
  { formId: 'starly', species: '0396', folder: 'starly' },
  { formId: 'staravia', species: '0397', folder: 'staravia' },
  { formId: 'staraptor', species: '0398', folder: 'staraptor' },
  { formId: 'shroomish', species: '0285', folder: 'shroomish' },
  { formId: 'breloom', species: '0286', folder: 'breloom' },
  { formId: 'swablu', species: '0333', folder: 'swablu' },
  { formId: 'altaria', species: '0334', folder: 'altaria' },
]

/**
 * SpriteCollab animations hold the eight walking directions stacked as rows,
 * each with the same number of frames. The runner needs the back view while
 * moving away from the camera and the side views while changing lanes.
 */
const directions = [
  { name: 'front', row: 0 },
  { name: 'back', row: 4 },
  { name: 'right', row: 2 },
  { name: 'left', row: 6 },
]

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])))
  return Buffer.concat([length, typeBytes, data, checksum])
}

function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(pngSignature)) throw new Error('Not a PNG file')

  let offset = 8
  let header
  const dataChunks = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      dataChunks.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += length + 12
  }

  if (!header) throw new Error('PNG is missing its IHDR chunk')
  if (header.bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${header.bitDepth}`)
  if (header.interlace !== 0) throw new Error('Interlaced PNGs are not supported')

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType]
  if (!channels) throw new Error(`Unsupported PNG colour type: ${header.colorType}`)

  const raw = inflateSync(Buffer.concat(dataChunks))
  const stride = header.width * channels
  const pixels = Buffer.alloc(stride * header.height)
  let previous = Buffer.alloc(stride)
  let cursor = 0

  for (let row = 0; row < header.height; row += 1) {
    const filter = raw[cursor]
    cursor += 1
    const line = raw.subarray(cursor, cursor + stride)
    cursor += stride
    const current = Buffer.alloc(stride)

    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? current[index - channels] : 0
      const up = previous[index]
      const upLeft = index >= channels ? previous[index - channels] : 0
      const value = line[index]
      let result
      switch (filter) {
        case 0:
          result = value
          break
        case 1:
          result = value + left
          break
        case 2:
          result = value + up
          break
        case 3:
          result = value + ((left + up) >> 1)
          break
        case 4: {
          const estimate = left + up - upLeft
          const distanceLeft = Math.abs(estimate - left)
          const distanceUp = Math.abs(estimate - up)
          const distanceUpLeft = Math.abs(estimate - upLeft)
          result = value + (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft ? left : distanceUp <= distanceUpLeft ? up : upLeft)
          break
        }
        default:
          throw new Error(`Unsupported PNG row filter: ${filter}`)
      }
      current[index] = result & 0xff
    }

    current.copy(pixels, row * stride)
    previous = current
  }

  if (channels === 4) return { width: header.width, height: header.height, pixels }

  const rgba = Buffer.alloc(header.width * header.height * 4)
  for (let index = 0; index < header.width * header.height; index += 1) {
    if (channels === 3) {
      rgba[index * 4] = pixels[index * 3]
      rgba[index * 4 + 1] = pixels[index * 3 + 1]
      rgba[index * 4 + 2] = pixels[index * 3 + 2]
      rgba[index * 4 + 3] = 255
    } else if (channels === 2) {
      const grey = pixels[index * 2]
      rgba[index * 4] = grey
      rgba[index * 4 + 1] = grey
      rgba[index * 4 + 2] = grey
      rgba[index * 4 + 3] = pixels[index * 2 + 1]
    } else {
      const grey = pixels[index]
      rgba[index * 4] = grey
      rgba[index * 4 + 1] = grey
      rgba[index * 4 + 2] = grey
      rgba[index * 4 + 3] = 255
    }
  }
  return { width: header.width, height: header.height, pixels: rgba }
}

function encodePng(image) {
  const stride = image.width * 4
  const raw = Buffer.alloc((stride + 1) * image.height)
  for (let row = 0; row < image.height; row += 1) {
    raw[row * (stride + 1)] = 0
    image.pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(image.width, 0)
  header.writeUInt32BE(image.height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    pngSignature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function crop(image, x, y, width, height) {
  const pixels = Buffer.alloc(width * height * 4)
  for (let row = 0; row < height; row += 1) {
    const from = ((y + row) * image.width + x) * 4
    image.pixels.copy(pixels, row * width * 4, from, from + width * 4)
  }
  return { width, height, pixels }
}

function readWalkAnimation(speciesPath) {
  const xml = readFileSync(join(speciesPath, 'AnimData.xml'), 'utf8')
  const block = xml.match(/<Anim>\s*<Name>Walk<\/Name>([\s\S]*?)<\/Anim>/)
  if (!block) throw new Error(`No Walk animation in ${join(speciesPath, 'AnimData.xml')}`)
  const frameWidth = Number(block[1].match(/<FrameWidth>(\d+)<\/FrameWidth>/)[1])
  const frameHeight = Number(block[1].match(/<FrameHeight>(\d+)<\/FrameHeight>/)[1])
  const frames = [...block[1].matchAll(/<Duration>/g)].length
  return { frameWidth, frameHeight, frames }
}

function findCredits(speciesPath) {
  if (existsSync(join(speciesPath, 'credits.txt'))) return join(speciesPath, 'credits.txt')
  for (const entry of readdirSync(speciesPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = join(speciesPath, entry.name, 'credits.txt')
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Full SpriteCollab checkout first, then the committed walk-only copy. */
function resolveSpecies(species) {
  for (const source of sourceRoots) {
    const path = join(source.base, species)
    if (existsSync(join(path, 'Walk-Anim.png')) && existsSync(join(path, 'AnimData.xml'))) {
      return { path, label: source.label }
    }
  }
  return null
}

function differingPixels(actual, expected) {
  if (actual.width !== expected.width || actual.height !== expected.height) return -1
  let count = 0
  for (let index = 0; index < actual.pixels.length; index += 1) {
    if (actual.pixels[index] !== expected.pixels[index]) count += 1
  }
  return count
}

const manifest = []
const usedSources = new Set()

for (const companion of companions) {
  const source = resolveSpecies(companion.species)
  if (!source) {
    console.warn(`skip ${companion.folder}: no Walk sheet for species ${companion.species} in any source`)
    continue
  }
  const speciesPath = source.path
  usedSources.add(source.label)

  const sheetPath = join(speciesPath, 'Walk-Anim.png')
  const { frameWidth, frameHeight, frames } = readWalkAnimation(speciesPath)
  const sheet = decodePng(readFileSync(sheetPath))
  if (sheet.width !== frameWidth * frames || sheet.height !== frameHeight * 8) {
    throw new Error(`${companion.folder}: unexpected Walk sheet size ${sheet.width}x${sheet.height}`)
  }

  let verified = 0
  for (const direction of directions) {
    const directory = join(outputRoot, companion.folder, direction.name)
    mkdirSync(directory, { recursive: true })
    for (let frame = 0; frame < frames; frame += 1) {
      const image = crop(sheet, frame * frameWidth, direction.row * frameHeight, frameWidth, frameHeight)
      const file = join(directory, `${direction.name}_${String(frame).padStart(2, '0')}.png`)
      if (existsSync(file)) {
        const difference = differingPixels(image, decodePng(readFileSync(file)))
        if (difference === 0) verified += 1
        else if (difference > 0) console.warn(`  ${relative(root, file)}: ${difference} pixels changed`)
      }
      writeFileSync(file, encodePng(image))
    }
  }

  const credits = findCredits(speciesPath)
  if (credits) writeFileSync(join(outputRoot, companion.folder, 'credits.txt'), readFileSync(credits))

  manifest.push({
    formId: companion.formId,
    folder: companion.folder,
    frameWidth,
    frameHeight,
    frames: Object.fromEntries(directions.map((direction) => [direction.name, frames])),
  })
  console.log(`${companion.formId.padEnd(10)} -> ${companion.folder.padEnd(11)} ${frames} frames ${frameWidth}x${frameHeight} (${verified} unchanged)`)
}

const manifestSource = `// Generated by scripts/extract-sprites.mjs. Do not edit by hand.
export interface GameSpriteManifestEntry {
  formId: string
  folder: string
  frameWidth: number
  frameHeight: number
  frames: Record<'front' | 'back' | 'left' | 'right', number>
}

export const gameSpriteManifest: GameSpriteManifestEntry[] = ${JSON.stringify(manifest, null, 2)}
`
writeFileSync(manifestPath, manifestSource)
console.log(`\nSources: ${[...usedSources].join(', ') || 'none'}`)
console.log(`Wrote ${relative(root, manifestPath)} with ${manifest.length} companions.`)
