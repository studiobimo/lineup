export interface PostOptions {
  altTexts: string[]
  collaborators: string[]
  commentsOff: boolean
  firstComment: string
}

export const NO_OPTIONS: PostOptions = {
  altTexts: [],
  collaborators: [],
  commentsOff: false,
  firstComment: ''
}

interface Slide {
  id: string
  video: boolean
}

export const sentOptions = (
  { altTexts, collaborators, commentsOff, firstComment }: PostOptions,
  slides: Slide[]
) => {
  const described = toAltTexts(altTexts, slides)
  return {
    ...(described && { altTexts: described }),
    ...(collaborators.length > 0 && { collaborators }),
    ...(commentsOff && { commentsEnabled: false }),
    ...(firstComment.trim() && { firstComment })
  }
}

export function toAltTexts(altTexts: string[], slides: Slide[]) {
  const kept = slides.map(({ video }, index) => (video ? '' : (altTexts[index] ?? '').trim()))
  return kept.some(Boolean) ? kept : undefined
}
