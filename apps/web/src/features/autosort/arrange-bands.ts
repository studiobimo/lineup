import { bands, type BandsRequest } from './bands'

/**
 * The one way into Bands. It answers asynchronously, though it need not yet, so that its callers
 * already cope with a request to the Worker: this body is all that would change.
 */
export const arrangeBands = (request: BandsRequest) => Promise.resolve(bands(request))
