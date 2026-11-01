/** Lightness from 0 to 1, chroma from 0, hue in degrees. */
export interface Oklch {
  lightness: number
  chroma: number
  hue: number
}

export interface ImageColour {
  dominant: Oklch
  palette: Oklch[]
  /** The photo's mean lightness, which the dominant colour alone does not tell. */
  tone: number
  /** The share of its pixels, from 0 to 1, that are strongly coloured. */
  vivid: number
}

type Oklab = readonly [lightness: number, a: number, b: number]

interface Cluster {
  centre: Oklab
  size: number
}

const CLUSTERS = 4
const ITERATIONS = 8
// Added to chroma when clusters compete, so a large grey sky can still beat a small red sign.
// Tuned by the fixtures in colour.test.ts.
const CHROMA_FLOOR = 0.05
const VIVID_CHROMA = 0.09

// Below this a photo reads as black, white or grey, and its hue is noise.
export const NEUTRAL_CHROMA = 0.04
// The hue the rainbow opens on, so that the reds are not split between its two ends.
const RAINBOW_START = 10

export const fromRed = (hue: number) => (hue - RAINBOW_START + 360) % 360

const toLinear = (channel: number) => {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

/** Björn Ottosson's matrices, from https://bottosson.github.io/posts/oklab/ */
function toOklab(red: number, green: number, blue: number): Oklab {
  const [r, g, b] = [toLinear(red), toLinear(green), toLinear(blue)]
  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  ]
}

function toOklch([lightness, a, b]: Oklab): Oklch {
  return {
    lightness,
    chroma: Math.hypot(a, b),
    hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  }
}

const distance = (one: Oklab, other: Oklab) =>
  (one[0] - other[0]) ** 2 + (one[1] - other[1]) ** 2 + (one[2] - other[2]) ** 2

const nearest = (pixel: Oklab, centres: Oklab[]) =>
  centres.reduce(
    (best, centre, index) =>
      distance(pixel, centre) < distance(pixel, centres[best]) ? index : best,
    0
  )

/** Farthest-first rather than random, so an image always gives the same colour. */
function chooseCentres(pixels: Oklab[]) {
  const centres = [pixels[0]]
  while (centres.length < CLUSTERS) {
    let farthest = pixels[0]
    let reach = 0
    for (const pixel of pixels) {
      const away = distance(pixel, centres[nearest(pixel, centres)])
      if (away > reach) {
        reach = away
        farthest = pixel
      }
    }
    if (reach === 0) break
    centres.push(farthest)
  }
  return centres
}

function cluster(pixels: Oklab[]): Cluster[] {
  let centres = chooseCentres(pixels)
  let sizes: number[] = []
  for (let round = 0; round < ITERATIONS; round += 1) {
    const sums = centres.map((): [number, number, number] => [0, 0, 0])
    sizes = centres.map(() => 0)
    for (const pixel of pixels) {
      const index = nearest(pixel, centres)
      sizes[index] += 1
      pixel.forEach((value, axis) => (sums[index][axis] += value))
    }
    centres = sums.map((sum, index) =>
      sizes[index] === 0 ? centres[index] : (sum.map((total) => total / sizes[index]) as never)
    )
  }
  return centres.map((centre, index) => ({ centre, size: sizes[index] }))
}

/** The colour an image reads as, from its RGBA pixels. It runs on a small sample, in the worker. */
export function extractColour(pixels: Uint8ClampedArray): ImageColour {
  const lab: Oklab[] = []
  for (let offset = 0; offset < pixels.length; offset += 4) {
    lab.push(toOklab(pixels[offset], pixels[offset + 1], pixels[offset + 2]))
  }
  const score = ({ centre, size }: Cluster) => size * (toOklch(centre).chroma + CHROMA_FLOOR)
  const ranked = cluster(lab)
    .filter(({ size }) => size > 0)
    .sort((one, other) => score(other) - score(one))
  const palette = ranked.map(({ centre }) => toOklch(centre))
  return {
    dominant: palette[0],
    palette,
    tone: lab.reduce((sum, [lightness]) => sum + lightness, 0) / lab.length,
    vivid: lab.filter(([, a, b]) => Math.hypot(a, b) > VIVID_CHROMA).length / lab.length
  }
}
