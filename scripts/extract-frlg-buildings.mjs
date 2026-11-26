/**
 * Slices the FireRed/LeafGreen "Buildings" sheet into individual, transparent
 * building sprites. These are kept as a reference archive: the running game
 * now uses the Emerald building set in frontend/public/game/buildings.
 *
 * Usage: node scripts/extract-frlg-buildings.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'assets', 'Sprites-FRLG', 'buildings.png')
const output = join(root, 'assets', 'Sprites-FRLG', 'buildings')
mkdirSync(output, { recursive: true })

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
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
    } else if (type === 'IDAT') dataChunks.push(data)
    else if (type === 'IEND') break
    offset += length + 12
  }
  if (!header || header.bitDepth !== 8 || header.interlace !== 0) throw new Error('Unsupported PNG')
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.colorType]
  if (!channels) throw new Error('Unsupported colour type')

  const raw = inflateSync(Buffer.concat(dataChunks))
  const stride = header.width * channels
  const out = Buffer.alloc(stride * header.height)
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
      if (filter === 1) result = value + left
      else if (filter === 2) result = value + up
      else if (filter === 3) result = value + ((left + up) >> 1)
      else if (filter === 4) {
        const estimate = left + up - upLeft
        const pl = Math.abs(estimate - left)
        const pu = Math.abs(estimate - up)
        const pul = Math.abs(estimate - upLeft)
        result = value + (pl <= pu && pl <= pul ? left : pu <= pul ? up : upLeft)
      } else result = value
      current[index] = result & 0xff
    }
    current.copy(out, row * stride)
    previous = current
  }

  const rgba = Buffer.alloc(header.width * header.height * 4)
  for (let index = 0; index < header.width * header.height; index += 1) {
    if (channels === 4) {
      rgba[index * 4] = out[index * 4]
      rgba[index * 4 + 1] = out[index * 4 + 1]
      rgba[index * 4 + 2] = out[index * 4 + 2]
      rgba[index * 4 + 3] = out[index * 4 + 3]
    } else if (channels === 3) {
      rgba[index * 4] = out[index * 3]
      rgba[index * 4 + 1] = out[index * 3 + 1]
      rgba[index * 4 + 2] = out[index * 3 + 2]
      rgba[index * 4 + 3] = 255
    } else {
      const grey = out[index * channels]
      rgba[index * 4] = grey
      rgba[index * 4 + 1] = grey
      rgba[index * 4 + 2] = grey
      rgba[index * 4 + 3] = channels === 2 ? out[index * 2 + 1] : 255
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
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const image = decodePng(readFileSync(source))
const { width, height, pixels } = image
const pixel = (x, y) => (y * width + x)
const isNearWhite = (index) => pixels[index * 4] > 234 && pixels[index * 4 + 1] > 234 && pixels[index * 4 + 2] > 234

// Flood fill the white page background from the borders so interior white windows stay opaque.
const background = new Uint8Array(width * height)
const stack = []
for (let x = 0; x < width; x += 1) {
  stack.push([x, 0], [x, height - 1])
}
for (let y = 0; y < height; y += 1) {
  stack.push([0, y], [width - 1, y])
}
while (stack.length > 0) {
  const [x, y] = stack.pop()
  if (x < 0 || y < 0 || x >= width || y >= height) continue
  const index = pixel(x, y)
  if (background[index] || !isNearWhite(index)) continue
  background[index] = 1
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
}

const isContent = (index) => background[index] === 0 && pixels[index * 4 + 3] > 16
const visited = new Uint8Array(width * height)
const boxes = []
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const start = pixel(x, y)
    if (visited[start] || !isContent(start)) continue
    let minX = x
    let maxX = x
    let minY = y
    let maxY = y
    let size = 0
    const queue = [start]
    visited[start] = 1
    while (queue.length > 0) {
      const current = queue.pop()
      const cx = current % width
      const cy = (current - cx) / width
      size += 1
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
      const neighbours = [current + 1, current - 1, current + width, current - width]
      for (const next of neighbours) {
        if (next < 0 || next >= width * height) continue
        const nx = next % width
        if (Math.abs(nx - cx) > 1) continue
        if (visited[next] || !isContent(next)) continue
        visited[next] = 1
        queue.push(next)
      }
    }
    boxes.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, size })
  }
}

// Merge parts that visually belong to the same building (white seams, shadows).
let merged = true
while (merged) {
  merged = false
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      const first = boxes[a]
      const second = boxes[b]
      const gap = 3
      const overlapX = first.x - gap < second.x + second.width && second.x - gap < first.x + first.width
      const overlapY = first.y - gap < second.y + second.height && second.y - gap < first.y + first.height
      if (!overlapX || !overlapY) continue
      boxes[a] = {
        x: Math.min(first.x, second.x),
        y: Math.min(first.y, second.y),
        width: Math.max(first.x + first.width, second.x + second.width) - Math.min(first.x, second.x),
        height: Math.max(first.y + first.height, second.y + second.height) - Math.min(first.y, second.y),
        size: first.size + second.size,
      }
      boxes.splice(b, 1)
      merged = true
      break
    }
    if (merged) break
  }
}

const useful = boxes
  .filter((box) => box.width >= 14 && box.height >= 14 && box.size >= 180)
  .sort((a, b) => (Math.abs(a.y - b.y) > 6 ? a.y - b.y : a.x - b.x))

function crop(box) {
  const out = Buffer.alloc(box.width * box.height * 4)
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const sourceIndex = pixel(box.x + x, box.y + y)
      const targetIndex = (y * box.width + x) * 4
      out[targetIndex] = pixels[sourceIndex * 4]
      out[targetIndex + 1] = pixels[sourceIndex * 4 + 1]
      out[targetIndex + 2] = pixels[sourceIndex * 4 + 2]
      out[targetIndex + 3] = background[sourceIndex] ? 0 : pixels[sourceIndex * 4 + 3]
    }
  }
  return { width: box.width, height: box.height, pixels: out }
}

const used = new Set()
useful.forEach((box, index) => {
  const name = `building-${String(index).padStart(2, '0')}`
  used.add(name)
  writeFileSync(join(output, `${name}.png`), encodePng(crop(box)))
  console.log(`${name}: x=${box.x} y=${box.y} ${box.width}x${box.height} (${box.size}px)`)
})
console.log(`\n${useful.length} buildings written to ${output}`)
if (!existsSync(output)) throw new Error('Output folder missing')
