import type { UserTag } from 'lineup-contract'
import { TAGS_PER_POST } from 'lineup-contract'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconButton } from '@/components/icon-button'
import { cellShape, instagram } from '@/features/planner/network-profile'
import { usePlanner } from '@/features/planner/planner'
import { Thumbnail } from '@/features/planner/thumbnail'
import { cn } from '@/lib/utils'

import { MediaFields } from './media-fields'
import { TagPicture } from './tag-picture'
import { isValidName, mayAddTag, type TagDraft, typedUsername } from './tags'

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
  // A place the user has chosen but not yet named. It becomes a tag only on confirming a name. ~keep
  const [pending, setPending] = useState<{ index: number; x?: number; y?: number }>()
  const [name, setName] = useState('')
  const slide = slides[index] ?? slides[0]
  const size = usePlanner(({ images }) => images[slide.id])
  const here = tags.filter(({ mediaIndex = 0 }) => mediaIndex === index)

  const change = (key: string, changes: Partial<UserTag>) =>
    onChange(tags.map((tag) => (tag.key === key ? { ...tag, ...changes } : tag)))

  const pendingHere = pending?.index === index ? pending : undefined

  const discard = () => {
    setPending(undefined)
    setName('')
  }

  const place = (point?: { x: number; y: number }) => {
    if (!mayAddTag(tags)) return
    setSelected(undefined)
    setName('')
    setPending({ index, ...point })
  }

  const confirm = () => {
    if (!pending || !name || !isValidName(name)) return
    const { x, y } = pending
    const key = crypto.randomUUID()
    onChange([
      ...tags,
      { key, username: name, mediaIndex: pending.index, ...(x !== undefined && { x, y }) }
    ])
    discard()
  }

  const remove = (key: string) => {
    onChange(tags.filter((tag) => tag.key !== key))
    setSelected(undefined)
  }

  const full = !mayAddTag(tags)
  const media = slide.video ? (
    <div className="overflow-hidden rounded-sm bg-muted" style={cellShape}>
      <Thumbnail id={slide.id} label={t('post.tags.picture')} />
    </div>
  ) : (
    <TagPicture
      image={slide.id}
      ratio={size ? size.width / size.height : width / height}
      tags={here}
      pending={
        pendingHere?.x === undefined ? undefined : { x: pendingHere.x, y: pendingHere.y ?? 0.5 }
      }
      selected={selected}
      full={full}
      onAdd={place}
      onSelect={setSelected}
      onMove={(key, point) => change(key, point)}
      onRemove={remove}
    />
  )

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('post.tags.title')}</legend>
      <MediaFields media={media}>
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
                  onClick={() => {
                    discard()
                    setIndex(position)
                  }}
                >
                  {t('post.tags.slide', { position: position + 1, count })}
                </Button>
              )
            })}
          </div>
        )}
        {/* A fixed height, so the dialog does not grow as tags come and go. ~keep */}
        <ScrollArea className="h-40 flex-none">
          {here.length === 0 && (
            <p className="p-1 text-sm text-muted-foreground">{t('post.tags.none')}</p>
          )}
          <ul className="flex flex-col gap-1.5 p-1">
            {here.map((tag, position) => (
              <li key={tag.key} className="flex items-center gap-1.5">
                <Label className="sr-only" htmlFor={`tag-${tag.key}`}>
                  {t('post.tags.username', { position: position + 1 })}
                </Label>
                <span aria-hidden className="text-muted-foreground">
                  @
                </span>
                <Input
                  id={`tag-${tag.key}`}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  placeholder={t('post.tags.placeholder')}
                  value={tag.username}
                  className={cn(tag.key === selected && 'ring-1 ring-ring')}
                  onFocus={() => setSelected(tag.key)}
                  onChange={({ target }) =>
                    change(tag.key, { username: typedUsername(target.value) })
                  }
                  // Enter would submit the post form; a tag emptied and left is dropped, not kept blank. ~keep
                  onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
                  onBlur={() => tag.username === '' && remove(tag.key)}
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
            ))}
          </ul>
        </ScrollArea>
        {/* Always present, with one height for all its states, so choosing, naming and dropping a point move nothing. ~keep */}
        <div className="flex h-14 items-center">
          {pendingHere ? (
            <div
              className="flex w-full items-center gap-1.5 rounded-sm border border-dashed border-primary p-1.5"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) discard()
              }}
            >
              <Label className="sr-only" htmlFor="tag-pending">
                {t('post.tags.pending')}
              </Label>
              <span aria-hidden className="text-muted-foreground">
                @
              </span>
              <Input
                id="tag-pending"
                // The user just asked for this field, so it takes focus as it appears. ~keep
                ref={(input) => input?.focus()}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={30}
                placeholder={t('post.tags.placeholder')}
                value={name}
                onChange={({ target }) => setName(typedUsername(target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    confirm()
                  } else if (event.key === 'Escape') {
                    // The dialog would close on Escape too; only the pending tag should go. ~keep
                    event.stopPropagation()
                    discard()
                  }
                }}
              />
              <IconButton
                type="button"
                variant="ghost"
                label={t('post.tags.confirm')}
                disabled={name === ''}
                // Keeps focus in the field, so confirming is not read as clicking elsewhere. ~keep
                onPointerDown={(event) => event.preventDefault()}
                onClick={confirm}
              >
                <Check />
              </IconButton>
            </div>
          ) : full ? (
            <p className="text-xs text-muted-foreground">
              {t('post.tags.full', { limit: TAGS_PER_POST })}
            </p>
          ) : slide.video ? (
            <Button type="button" size="sm" variant="outline" onClick={() => place()}>
              {t('post.tags.add')}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t('post.tags.tapPicture')}</p>
          )}
        </div>
      </MediaFields>
    </fieldset>
  )
}
