import { POST } from 'lineup-contract'
import { useTranslation } from 'react-i18next'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
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
      {pictures.map(({ id, index }) => (
        <Field key={id}>
          <FieldLabel>{t('post.alt.slide', { position: index + 1 })}</FieldLabel>
          <Textarea
            value={altTexts[index] ?? ''}
            maxLength={POST.limit.altText}
            onChange={({ target }) => change(index, target.value)}
          />
          {index === pictures[0].index && <FieldDescription>{t('post.alt.hint')}</FieldDescription>}
        </Field>
      ))}
    </PostSection>
  )
}
