import { describe, expect, it } from 'vitest'

import cities from './cities.json'
import { nearestCity } from './nearest-city'

const lookUp = (latitude: number, longitude: number) =>
  nearestCity(latitude, longitude, cities as never)

describe('nearestCity', () => {
  it.each([
    ['Miami, US', 25.7617, -80.1918],
    ['Boston, US', 42.3601, -71.0589],
    ['Orlando, US', 28.5383, -81.3792],
    ['London, GB', 51.5074, -0.1278],
    ['Tokyo, JP', 35.68, 139.69]
  ])('finds %s', (city, latitude, longitude) => {
    expect(lookUp(latitude, longitude)).toBe(city)
  })

  it('finds nothing in the middle of an ocean', () => {
    expect(lookUp(30, -40)).toBeUndefined()
  })

  it('finds a city across the date line', () => {
    expect(nearestCity(0, 179.9, [['Over the line', 'XX', 0, -179.9]])).toBe('Over the line, XX')
  })

  // A guard against something pathological, and no budget: other tests run beside it.
  it('searches every city quickly enough for a batch', () => {
    const start = performance.now()
    for (let photo = 0; photo < 300; photo += 1) lookUp(40, -74)
    expect(performance.now() - start).toBeLessThan(2000)
  })
})
