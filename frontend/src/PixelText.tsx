import { PIXEL_FONT } from './pixelFontData'

interface PixelTextProps {
  text: string
  scale?: number
  className?: string
}

// Characters that appear in UI copy but are not on the extracted sheet rows.
const GLYPH_SUBSTITUTES: Record<string, string> = {
  'É': 'E',
  '×': 'X',
  '·': '-',
  '•': '-',
  '–': '-',
  '—': '-',
  "'": '-',
  '’': '-',
  '‘': '-',
}

export function PixelText({ text, scale = 1, className = '' }: PixelTextProps) {
  const normalized = text.toUpperCase()
  const atlasUrl = `${import.meta.env.BASE_URL ?? '/'}game/ui/font-emerald.png`
  const lineHeight = PIXEL_FONT.lineHeight * scale

  return (
    <span
      className={`pixel-text${className ? ` ${className}` : ''}`}
      style={{ gap: PIXEL_FONT.spacing * scale, lineHeight: `${lineHeight}px`, height: lineHeight }}
    >
      <span className="sr-only">{text}</span>
      {Array.from(normalized).map((rawChar, index) => {
        if (rawChar === ' ') {
          return (
            <span
              key={index}
              aria-hidden="true"
              className="pixel-glyph-space"
              style={{ width: PIXEL_FONT.spaceWidth * scale }}
            />
          )
        }
        const char = GLYPH_SUBSTITUTES[rawChar] ?? rawChar
        const glyph = PIXEL_FONT.glyphs[char] ?? PIXEL_FONT.glyphs['?']
        if (!glyph) return null
        return (
          <span
            key={index}
            aria-hidden="true"
            className="pixel-glyph"
            style={{
              width: glyph.w * scale,
              height: lineHeight,
              WebkitMaskImage: `url(${atlasUrl})`,
              maskImage: `url(${atlasUrl})`,
              WebkitMaskSize: `${PIXEL_FONT.atlas.width * scale}px ${PIXEL_FONT.atlas.height * scale}px`,
              maskSize: `${PIXEL_FONT.atlas.width * scale}px ${PIXEL_FONT.atlas.height * scale}px`,
              WebkitMaskPosition: `${-glyph.x * scale}px ${-glyph.y * scale}px`,
              maskPosition: `${-glyph.x * scale}px ${-glyph.y * scale}px`,
            }}
          />
        )
      })}
    </span>
  )
}
