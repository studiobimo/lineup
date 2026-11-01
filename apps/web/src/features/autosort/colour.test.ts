import { describe, expect, it } from 'vitest'

import { extractColour } from './colour'

type Rgb = [number, number, number]

/** Pixels in bands, as a share of the image: [[colour, 0.9], [colour, 0.1]]. */
function image(bands: [Rgb, number][], total = 1024) {
  const pixels = bands.flatMap(([colour, share]) =>
    Array.from({ length: Math.round(total * share) }, () => [...colour, 255])
  )
  return Uint8ClampedArray.from(pixels.flat())
}

const red: Rgb = [220, 30, 30]
const blue: Rgb = [30, 60, 220]
const white: Rgb = [255, 255, 255]
const black: Rgb = [0, 0, 0]
const grey: Rgb = [128, 128, 128]

describe('extractColour', () => {
  it('reads a flat colour in OKLCH', () => {
    const { dominant } = extractColour(image([[[255, 0, 0], 1]]))
    expect(dominant.lightness).toBeCloseTo(0.628, 2)
    expect(dominant.chroma).toBeCloseTo(0.258, 2)
    expect(dominant.hue).toBeCloseTo(29.2, 0)
  })

  it('gives a grey no chroma', () => {
    expect(extractColour(image([[grey, 1]])).dominant.chroma).toBeLessThan(0.001)
  })

  it('takes the colour of the image, not the muddy average of it', () => {
    const { dominant } = extractColour(
      image([
        [red, 0.5],
        [blue, 0.5]
      ])
    )
    expect(dominant.chroma).toBeGreaterThan(0.2)
  })

  it('prefers a vivid subject to a larger plain background', () => {
    const { dominant } = extractColour(
      image([
        [white, 0.7],
        [red, 0.3]
      ])
    )
    expect(dominant.hue).toBeCloseTo(extractColour(image([[red, 1]])).dominant.hue, 0)
  })

  it('lets a plain image stay plain, whatever speck of colour it has', () => {
    const { dominant } = extractColour(
      image([
        [black, 0.98],
        [red, 0.02]
      ])
    )
    expect(dominant.chroma).toBeLessThan(0.01)
  })

  it('keeps the rest of the image as a palette', () => {
    const { palette } = extractColour(
      image([
        [red, 0.5],
        [blue, 0.3],
        [white, 0.2]
      ])
    )
    expect(palette).toHaveLength(3)
  })

  it('always gives the same answer for the same image', () => {
    const pixels = image([
      [red, 0.4],
      [blue, 0.35],
      [grey, 0.25]
    ])
    expect(extractColour(pixels)).toEqual(extractColour(pixels))
  })

  it('is fast enough for the sample it runs on', () => {
    const pixels = Uint8ClampedArray.from({ length: 32 * 32 * 4 }, (_, index) => (index * 37) % 256)
    const start = performance.now()
    extractColour(pixels)
    expect(performance.now() - start).toBeLessThan(50)
  })
})
