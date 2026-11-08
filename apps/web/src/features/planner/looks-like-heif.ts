const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
  'heif'
])

export async function looksLikeHeif(file: Blob) {
  const head = new Uint8Array(await file.slice(4, 12).arrayBuffer())
  const text = String.fromCharCode(...head)
  return text.startsWith('ftyp') && HEIF_BRANDS.has(text.slice(4, 8))
}
