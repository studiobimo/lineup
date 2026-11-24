export interface PostOptions {
  altTexts: string[]
  collaborators: string[]
}

export const NO_OPTIONS: PostOptions = { altTexts: [], collaborators: [] }

interface Slide {
  id: string
  video: boolean
}

export function toAltTexts(altTexts: string[], slides: Slide[]) {
  const kept = slides.map(({ video }, index) => (video ? '' : (altTexts[index] ?? '').trim()))
  return kept.some(Boolean) ? kept : undefined
}
