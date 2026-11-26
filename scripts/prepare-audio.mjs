// Copies the FireRed/LeafGreen sound effects used by the runner from the
// numbered rip (assets/Sounds-FRLG/firered_XXXX.wav, where XXXX is the song ID
// from include/constants/songs.h of pret/pokefirered) into the web build,
// trimming leading/trailing silence and normalising the peak.
//
// Run from the repository root: node scripts/prepare-audio.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const sourceDir = join(root, 'assets', 'Sounds-FRLG')
const outputDir = join(root, 'frontend', 'public', 'game', 'audio')

const sounds = {
  coin: 0x15, // SE_PIN, short bright ping
  jump: 0x1c, // SE_BIKE_HOP, boing
  land: 0x31, // SE_BALL_BOUNCE_1, soft thump
  slide: 0x12, // SE_SLIDING_DOOR, swish
  crash: 0x07, // SE_WALL_HIT
  powerup: 0x0f, // SE_BALL_OPEN, Poké Ball pop
  city: 0x27, // SE_WARP_IN
  gameover: 0x10, // SE_FAINT
  click: 0x1e, // SE_CLICK
  select: 0x05, // SE_SELECT
}

function parseWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file')
  }
  let offset = 12
  let fmt = null
  let data = null
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') {
      fmt = {
        format: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        byteRate: buffer.readUInt32LE(body + 8),
        blockAlign: buffer.readUInt16LE(body + 12),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      }
    } else if (id === 'data') {
      data = { offset: body, size }
    }
    offset = body + size + (size % 2)
  }
  if (!fmt || !data) throw new Error('Missing fmt or data chunk')
  if (fmt.format !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV format ${fmt.format}/${fmt.bitsPerSample}`)
  }
  return { fmt, data }
}

function trimSilence(buffer, info, thresholdRatio = 0.012, paddingMs = 4) {
  const { fmt, data } = info
  const bytesPerSample = fmt.bitsPerSample / 8
  const frameCount = Math.floor(data.size / fmt.blockAlign)
  const frames = new Int16Array(frameCount * fmt.channels)
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < fmt.channels; channel += 1) {
      frames[frame * fmt.channels + channel] = buffer.readInt16LE(
        data.offset + frame * fmt.blockAlign + channel * bytesPerSample,
      )
    }
  }

  let peak = 0
  for (const sample of frames) peak = Math.max(peak, Math.abs(sample))
  if (peak === 0) return { frames, fmt, channels: fmt.channels, peak: 0 }

  const threshold = peak * thresholdRatio
  let first = 0
  while (first < frameCount && Math.abs(frames[first * fmt.channels]) < threshold) first += 1
  let last = frameCount - 1
  while (last > first && Math.abs(frames[last * fmt.channels]) < threshold) last -= 1

  const padding = Math.floor((fmt.sampleRate * paddingMs) / 1000)
  const start = Math.max(0, first - padding)
  const end = Math.min(frameCount, last + padding + 1)
  return {
    frames: frames.slice(start * fmt.channels, end * fmt.channels),
    fmt,
    channels: fmt.channels,
    peak,
  }
}

function encodeWav(frames, fmt, targetPeak = 0.92) {
  const channels = fmt.channels
  const frameCount = frames.length / channels
  let peak = 0
  for (const sample of frames) peak = Math.max(peak, Math.abs(sample))
  const gain = peak > 0 ? (targetPeak * 32767) / peak : 1

  const dataSize = frames.length * 2
  const output = Buffer.alloc(44 + dataSize)
  output.write('RIFF', 0, 'ascii')
  output.writeUInt32LE(36 + dataSize, 4)
  output.write('WAVE', 8, 'ascii')
  output.write('fmt ', 12, 'ascii')
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(channels, 22)
  output.writeUInt32LE(fmt.sampleRate, 24)
  output.writeUInt32LE(fmt.sampleRate * channels * 2, 28)
  output.writeUInt16LE(channels * 2, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36, 'ascii')
  output.writeUInt32LE(dataSize, 40)
  for (let index = 0; index < frames.length; index += 1) {
    const value = Math.max(-32768, Math.min(32767, Math.round(frames[index] * gain)))
    output.writeInt16LE(value, 44 + index * 2)
  }
  return output
}

await mkdir(outputDir, { recursive: true })

for (const [name, id] of Object.entries(sounds)) {
  const sourceName = `firered_${id.toString(16).toUpperCase().padStart(4, '0')}.wav`
  const buffer = await readFile(join(sourceDir, sourceName))
  const info = parseWav(buffer)
  const { frames, fmt, channels } = trimSilence(buffer, info)
  const output = encodeWav(frames, fmt, 0.92)
  await writeFile(join(outputDir, `${name}.wav`), output)
  const seconds = frames.length / channels / fmt.sampleRate
  console.log(`${name.padEnd(9)} <- ${sourceName}  ${seconds.toFixed(3)} s  ${Math.round(output.length / 1024)} KB`)
}
