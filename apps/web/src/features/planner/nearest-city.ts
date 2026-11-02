type City = [name: string, country: string, latitude: number, longitude: number]

// Farther than this from any city, a photo is from nowhere in particular: at sea, or in the wild.
const MAX_KM = 100
const KM_PER_DEGREE = 111.32

const radians = (degrees: number) => (degrees * Math.PI) / 180

/** Flat rather than spherical, because it only has to be right over a hundred kilometres. */
function kmBetween(latitude: number, longitude: number, [, , otherLat, otherLng]: City) {
  const east = Math.abs(longitude - otherLng)
  const wrapped = Math.min(east, 360 - east) * Math.cos(radians((latitude + otherLat) / 2))
  return Math.hypot(latitude - otherLat, wrapped) * KM_PER_DEGREE
}

/** The nearest city as `Miami, US`, the only part of a position that is ever kept. */
export function nearestCity(latitude: number, longitude: number, cities: City[]) {
  let nearest: City | undefined
  let reach = MAX_KM
  for (const city of cities) {
    const away = kmBetween(latitude, longitude, city)
    if (away < reach) {
      nearest = city
      reach = away
    }
  }
  return nearest && `${nearest[0]}, ${nearest[1]}`
}
