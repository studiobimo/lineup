import { POST } from 'lineup-contract'
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { PostOptions } from './post-options'
import { PostSection } from './post-section'

interface AltTextSectionProps {
  slides: { id: string; video: boolean }[]
  altTexts: PostOptions['altTexts']
  onChange: (altTexts: PostOptions['altTexts']) => void
}

export function AltTextSection({ slides, altTexts, onChange }: AltTextSectionProps) {
  const { t } = useTranslation('provider')
  const pictures = slides.flatMap(({ id, video }, index) => (video ? [] : [{ id, index }]))
  if (pictures.length === 0) return null
  const change = (index: number, text: string) => {
    const next = slides.map((_, slide) => altTexts[slide] ?? '')
    next[index] = text
    onChange(next)
  }
  return (
    <PostSection title={t('post.alt.title')}>
      <p className="text-xs text-muted-foreground">{t('post.alt.hint')}</p>
      {pictures.map(({ id, index }) => (
        <div key={id} className="flex flex-col gap-1.5">
          <Label htmlFor={`post-alt-${index}`}>
            {t('post.alt.slide', { position: index + 1 })}
          </Label>
          <Textarea
            id={`post-alt-${index}`}
            value={altTexts[index] ?? ''}
            maxLength={POST.limit.altText}
            onChange={({ target }) => change(index, target.value)}
          />
        </div>
      ))}
    </PostSection>
  )
}
