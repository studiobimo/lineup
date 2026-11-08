import { bands, type BandsRequest } from './bands'

export const arrangeBands = (request: BandsRequest) => Promise.resolve(bands(request))
