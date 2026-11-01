import { describe, expect, it } from 'vitest'

import { extractColour } from './colour'
import { sortByColour, type SortStrategy } from './sort'

const swatches: Record<string, [number, number, number]> = {
  red: [220, 30, 30],
  orange: [240, 130, 20],
  yellow: [240, 220, 40],
  green: [40, 170, 60],
  teal: [20, 170, 170],
  blue: [40, 80, 220],
  purple: [130, 50, 200],
  pink: [235, 60, 150],
  paleBlue: [170, 200, 240],
  navy: [20, 30, 90],
  white: [250, 250, 250],
  grey: [128, 128, 128],
  black: [12, 12, 12]
}

const cell = (id: string) => ({
  id,
  colour: extractColour(Uint8ClampedArray.of(...swatches[id], 255))
})

const cells = Object.keys(swatches).map(cell)

/** Reversed, so that nothing passes by leaving the input as it was. */
const sorted = (strategy: SortStrategy) => sortByColour([...cells].reverse(), strategy)

describe('sortByColour', () => {
  it('runs a rainbow from red, with the greys together at the end', () => {
    expect(sorted('rainbow')).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'teal',
      'paleBlue',
      'blue',
      'navy',
      'purple',
      'pink',
      'white',
      'grey',
      'black'
    ])
  })

  it('runs light to dark across every image', () => {
    const order = sorted('lightToDark')
    expect(order[0]).toBe('white')
    expect(order.at(-1)).toBe('black')
    const lightness = order.map((id) => cell(id).colour.dominant.lightness)
    expect(lightness).toEqual([...lightness].sort((one, other) => other - one))
  })

  it('groups colour families, each light to dark, with the greys at the end', () => {
    const order = sorted('grouped')
    expect(order.indexOf('paleBlue')).toBeLessThan(order.indexOf('blue'))
    expect(order.indexOf('blue')).toBeLessThan(order.indexOf('navy'))
    expect(order.slice(-3)).toEqual(['white', 'grey', 'black'])
  })

  it('never lets a grey land among the colours, whatever its stray hue', () => {
    const stray = {
      id: 'stray',
      colour: {
        dominant: { lightness: 0.6, chroma: 0.02, hue: 150 },
        palette: []
      }
    }
    const order = sortByColour([stray, cell('green'), cell('blue'), cell('black')], 'rainbow')
    expect(order).toEqual(['green', 'blue', 'stray', 'black'])
  })

  it('gives the same order for the same images, however they start', () => {
    for (const strategy of ['rainbow', 'lightToDark', 'grouped'] as const) {
      expect(sortByColour([...cells].reverse(), strategy)).toEqual(sortByColour(cells, strategy))
    }
  })

  it('breaks a tie on the id', () => {
    const twin = { ...cell('red'), id: 'a-twin' }
    expect(sortByColour([cell('red'), twin], 'rainbow')).toEqual(['a-twin', 'red'])
  })

  it('leaves an image with no colour yet at the end', () => {
    expect(sortByColour([{ id: 'unread' }, cell('black')], 'lightToDark')).toEqual([
      'black',
      'unread'
    ])
  })

  it('does not touch what it is given', () => {
    const input = [...cells]
    sortByColour(input, 'rainbow')
    expect(input).toEqual(cells)
  })

  it('sorts 300 images in under 100 ms', () => {
    const many = Array.from({ length: 300 }, (_, index) => ({
      id: String(index),
      colour: {
        dominant: {
          lightness: (index * 7) % 100,
          chroma: ((index * 11) % 30) / 100,
          hue: (index * 13) % 360
        },
        palette: []
      }
    }))
    const start = performance.now()
    sortByColour(many, 'grouped')
    expect(performance.now() - start).toBeLessThan(100)
  })
})
