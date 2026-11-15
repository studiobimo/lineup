import type { UserTag } from 'lineup-contract'
import { TAGS_PER_POST, cleanUsername } from 'lineup-contract'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconButton } from '@/components/icon-button'
import { instagram } from '@/features/planner/network-profile'
import { usePlanner } from '@/features/planner/planner'
import { cn } from '@/lib/utils'

import { TagPicture } from './tag-picture'
import { isValidName, mayAddTag, type TagDraft } from './tags'

const { width, height } = instagram.cellRatio

interface Slide {
  id: string
  video: boolean
}

interface TagPickerProps {
  slides: Slide[]
  tags: TagDraft[]
  onChange: (tags: TagDraft[]) => void
}

export function TagPicker({ slides, tags, onChange }: TagPickerProps) {
  const { t } = useTranslation('provider')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string>()
  const toFocus = useRef<string>(undefined)
  const slide = slides[index] ?? slides[0]
  const size = usePlanner(({ images }) => images[slide.id])
  const here = tags.filter(({ mediaIndex = 0 }) => mediaIndex === index)

  const change = (key: string, changes: Partial<UserTag>) =>
    onChange(tags.map((tag) => (tag.key === key ? { ...tag, ...changes } : tag)))

  const add = (point?: { x: number; y: number }) => {
    if (!mayAddTag(tags)) return
    const key = crypto.randomUUID()
    onChange([...tags, { key, username: '', mediaIndex: index, ...point }])
    setSelected(key)
    toFocus.current = key
  }

  const remove = (key: string) => {
    onChange(tags.filter((tag) => tag.key !== key))
    setSelected(undefined)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{t('post.tags.title')}</legend>
      <p className="text-xs text-muted-foreground">
        {t(slide.video ? 'post.tags.videoHint' : 'post.tags.hint', { limit: TAGS_PER_POST })}
      </p>
      {slides.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {slides.map(({ id }, position) => {
            const count = tags.filter(({ mediaIndex = 0 }) => mediaIndex === position).length
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={position === index ? 'default' : 'outline'}
                aria-pressed={position === index}
                onClick={() => setIndex(position)}
              >
                {t('post.tags.slide', { position: position + 1, count })}
              </Button>
            )
          })}
        </div>
      )}
      {!slide.video && (
        <TagPicture
          image={slide.id}
          ratio={size ? size.width / size.height : width / height}
          tags={here}
          selected={selected}
          full={!mayAddTag(tags)}
          onAdd={add}
          onSelect={setSelected}
          onMove={(key, point) => change(key, point)}
          onRemove={remove}
        />
      )}
      <ul className="flex flex-col gap-1.5">
        {here.map((tag, position) => {
          const invalid = !isValidName(tag.username)
          return (
            <li key={tag.key} className="flex items-center gap-1.5">
              <Label className="sr-only" htmlFor={`tag-${tag.key}`}>
                {t('post.tags.username', { position: position + 1 })}
              </Label>
              <span aria-hidden className="text-muted-foreground">
                @
              </span>
              <Input
                id={`tag-${tag.key}`}
                ref={(input) => {
                  if (input && toFocus.current === tag.key) {
                    toFocus.current = undefined
                    input.focus()
                  }
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={31}
                placeholder={t('post.tags.placeholder')}
                value={tag.username}
                aria-invalid={invalid && tag.username !== '' ? true : undefined}
                className={cn(tag.key === selected && 'ring-1 ring-ring')}
                onFocus={() => setSelected(tag.key)}
                onChange={({ target }) =>
                  change(tag.key, { username: cleanUsername(target.value) })
                }
              />
              <IconButton
                type="button"
                variant="ghost"
                label={t('post.tags.remove', { position: position + 1 })}
                onClick={() => remove(tag.key)}
              >
                <X />
              </IconButton>
            </li>
          )
        })}
      </ul>
      {slide.video && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!mayAddTag(tags)}
          onClick={() => add()}
        >
          {t('post.tags.add')}
        </Button>
      )}
      {!mayAddTag(tags) && (
        <p className="text-xs text-muted-foreground">
          {t('post.tags.full', { limit: TAGS_PER_POST })}
        </p>
      )}
    </fieldset>
  )
}
