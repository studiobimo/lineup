// The package types its entry point, and not the much smaller build this app imports.
declare module 'exifr/dist/mini.esm.mjs' {
  export { gps, parse } from 'exifr'
}
