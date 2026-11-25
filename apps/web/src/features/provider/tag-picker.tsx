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

interface SlideSwitcherProps {
  slides: Slide[]
  tags: TagDraft[]
  index: number
  onSelect: (position: number) => void
}

function SlideSwitcher({ slides, tags, index, onSelect }: SlideSwitcherProps) {
  const { t } = useTranslation('provider')
  return (
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
            onClick={() => onSelect(position)}
          >
            {t('post.tags.slide', { position: position + 1, count })}
          </Button>
        )
      })}
    </div>
  )
}

interface TagRowsProps {
  tags: TagDraft[]
  selected: string | undefined
  onFocus: (key: string) => void
  onChange: (key: string, changes: Partial<UserTag>) => void
  onRemove: (key: string) => void
}

function TagRows({ tags, selected, onFocus, onChange, onRemove }: TagRowsProps) {
  const { t } = useTranslation('provider')
  return (
    <ScrollArea className="h-40 flex-none">
      {tags.length === 0 && (
        <p className="p-1 text-sm text-muted-foreground">{t('post.tags.none')}</p>
      )}
      <ul className="flex flex-col gap-1.5 p-1">
        {tags.map((tag, position) => (
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
              onFocus={() => onFocus(tag.key)}
              onChange={({ target }) =>
                onChange(tag.key, { username: typedUsername(target.value) })
              }
              // Enter would submit the post form; a tag emptied and left is dropped, not kept blank. ~keep
              onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
              onBlur={() => tag.username === '' && onRemove(tag.key)}
            />
            <IconButton
              type="button"
              variant="ghost"
              label={t('post.tags.remove', { position: position + 1 })}
              onClick={() => onRemove(tag.key)}
            >
              <X />
            </IconButton>
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}

interface PendingTagProps {
  name: string
  onName: (name: string) => void
  onConfirm: () => void
  onDiscard: () => void
}

function PendingTag({ name, onName, onConfirm, onDiscard }: PendingTagProps) {
  const { t } = useTranslation('provider')
  return (
    <div
      className="flex w-full items-center gap-1.5 rounded-sm border border-dashed border-primary p-1.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onDiscard()
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
        onChange={({ target }) => onName(typedUsername(target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onConfirm()
          } else if (event.key === 'Escape') {
            // The dialog would close on Escape too; only the pending tag should go. ~keep
            event.stopPropagation()
            onDiscard()
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
        onClick={onConfirm}
      >
        <Check />
      </IconButton>
    </div>
  )
}

interface TagActionProps extends Omit<PendingTagProps, 'name'> {
  pending: boolean
  name: string
  full: boolean
  video: boolean
  onPlace: () => void
}

function TagAction({ pending, name, full, video, onPlace, ...handlers }: TagActionProps) {
  const { t } = useTranslation('provider')
  if (pending) return <PendingTag name={name} {...handlers} />
  if (full)
    return (
      <p className="text-xs text-muted-foreground">
        {t('post.tags.full', { limit: TAGS_PER_POST })}
      </p>
    )
  if (video)
    return (
      <Button type="button" size="sm" variant="outline" onClick={onPlace}>
        {t('post.tags.add')}
      </Button>
    )
  return <p className="text-sm text-muted-foreground">{t('post.tags.tapPicture')}</p>
}

interface TagMediaProps {
  slide: Slide
  here: TagDraft[]
  pendingHere: { x?: number; y?: number } | undefined
  selected: string | undefined
  full: boolean
  onAdd: (point?: { x: number; y: number }) => void
  onSelect: (key: string) => void
  onMove: (key: string, point: Partial<UserTag>) => void
  onRemove: (key: string) => void
}

function TagMedia({
  slide,
  here,
  pendingHere,
  selected,
  full,
  onAdd,
  onSelect,
  onMove,
  onRemove
}: TagMediaProps) {
  const { t } = useTranslation('provider')
  const size = usePlanner(({ images }) => images[slide.id])
  if (slide.video)
    return (
      <div className="overflow-hidden rounded-sm bg-muted" style={cellShape}>
        <Thumbnail id={slide.id} label={t('post.tags.picture')} />
      </div>
    )
  return (
    <TagPicture
      image={slide.id}
      ratio={size ? size.width / size.height : width / height}
      tags={here}
      pending={
        pendingHere?.x === undefined ? undefined : { x: pendingHere.x, y: pendingHere.y ?? 0.5 }
      }
      selected={selected}
      full={full}
      onAdd={onAdd}
      onSelect={onSelect}
      onMove={onMove}
      onRemove={onRemove}
    />
  )
}

function usePendingTag(
  index: number,
  tags: TagDraft[],
  onChange: (tags: TagDraft[]) => void,
  clearSelection: () => void
) {
  // A place the user has chosen but not yet named. It becomes a tag only on confirming a name. ~keep
  const [pending, setPending] = useState<{ index: number; x?: number; y?: number }>()
  const [name, setName] = useState('')

  const discard = () => {
    setPending(undefined)
    setName('')
  }

  const place = (point?: { x: number; y: number }) => {
    if (!mayAddTag(tags)) return
    clearSelection()
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

  const pendingHere = pending?.index === index ? pending : undefined
  return { pendingHere, name, setName, place, confirm, discard }
}

function useTagEdits(
  tags: TagDraft[],
  onChange: (tags: TagDraft[]) => void,
  clearSelection: () => void
) {
  const change = (key: string, changes: Partial<UserTag>) =>
    onChange(tags.map((tag) => (tag.key === key ? { ...tag, ...changes } : tag)))
  const remove = (key: string) => {
    onChange(tags.filter((tag) => tag.key !== key))
    clearSelection()
  }
  return { change, remove }
}

export function TagPicker({ slides, tags, onChange }: TagPickerProps) {
  const { t } = useTranslation('provider')
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string>()
  const { pendingHere, name, setName, place, confirm, discard } = usePendingTag(
    index,
    tags,
    onChange,
    () => setSelected(undefined)
  )
  const { change, remove } = useTagEdits(tags, onChange, () => setSelected(undefined))
  const slide = slides[index] ?? slides[0]
  const here = tags.filter(({ mediaIndex = 0 }) => mediaIndex === index)
  const full = !mayAddTag(tags)

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('post.tags.title')}</legend>
      <MediaFields
        media={
          <TagMedia
            slide={slide}
            here={here}
            pendingHere={pendingHere}
            selected={selected}
            full={full}
            onAdd={place}
            onSelect={setSelected}
            onMove={(key, point) => change(key, point)}
            onRemove={remove}
          />
        }
      >
        <p className="text-xs text-muted-foreground">
          {t(slide.video ? 'post.tags.videoHint' : 'post.tags.hint', { limit: TAGS_PER_POST })}
        </p>
        {slides.length > 1 && (
          <SlideSwitcher
            slides={slides}
            tags={tags}
            index={index}
            onSelect={(position) => {
              discard()
              setIndex(position)
            }}
          />
        )}
        {/* A fixed height, so the dialog does not grow as tags come and go. ~keep */}
        <TagRows
          tags={here}
          selected={selected}
          onFocus={setSelected}
          onChange={change}
          onRemove={remove}
        />
        {/* Always present, with one height for all its states, so choosing, naming and dropping a point move nothing. ~keep */}
        <div className="flex h-14 items-center">
          <TagAction
            pending={pendingHere !== undefined}
            name={name}
            full={full}
            video={slide.video}
            onPlace={() => place()}
            onName={setName}
            onConfirm={confirm}
            onDiscard={discard}
          />
        </div>
      </MediaFields>
    </fieldset>
  )
}
