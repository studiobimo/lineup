type City = [name: string, country: string, latitude: number, longitude: number]

const MAX_KM = 100
const KM_PER_DEGREE = 111.32

const radians = (degrees: number) => (degrees * Math.PI) / 180

function kmBetween(latitude: number, longitude: number, [, , otherLat, otherLng]: City) {
  const east = Math.abs(longitude - otherLng)
  const wrapped = Math.min(east, 360 - east) * Math.cos(radians((latitude + otherLat) / 2))
  return Math.hypot(latitude - otherLat, wrapped) * KM_PER_DEGREE
}

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
