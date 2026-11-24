import { AltTextSection } from './alt-text-section'
import { CollaboratorsSection } from './collaborators-section'
import type { PostOptions } from './post-options'

interface PostSectionsProps {
  slides: { id: string; video: boolean }[]
  options: PostOptions
  onChange: (options: PostOptions) => void
}

export function PostSections({ slides, options, onChange }: PostSectionsProps) {
  return (
    <>
      <AltTextSection
        slides={slides}
        altTexts={options.altTexts}
        onChange={(altTexts) => onChange({ ...options, altTexts })}
      />
      <CollaboratorsSection
        collaborators={options.collaborators}
        onChange={(collaborators) => onChange({ ...options, collaborators })}
      />
    </>
  )
}
