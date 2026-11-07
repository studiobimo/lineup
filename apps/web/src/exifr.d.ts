// The package types its entry point, and not the much smaller builds this app imports.
declare module 'exifr/dist/mini.esm.mjs' {
  export { gps, parse } from 'exifr'
}
// The same reader with HEIC support, which mini leaves out.
declare module 'exifr/dist/lite.esm.mjs' {
  export { gps, parse } from 'exifr'
}
