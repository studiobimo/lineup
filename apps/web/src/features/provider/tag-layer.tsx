/**
 * The way a tag is placed and moved here is adapted from the Focal Point Picker of KokonutUI,
 * https://kokonutui.com (https://github.com/kokonut-labs/kokonutui), MIT licence,
 * copyright @dorianbaffier. From it: the pointer capture drag, the clamp to the picture and
 * the arrow key nudge. The crop previews, next/image and its colours and strings are dropped.
 */
import { type KeyboardEvent, type PointerEvent, type RefObject, useRef, useState } from 'react'
import { TAGS_PER_POST } from 'lineup-contract'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/utils'

import { TagPopover } from './tag-popover'
import { mayAddTag, nudged, pointIn, type TagDraft } from './tags'
import type { TagEditor } from './use-tag-editor'

const percent = (value = 0) => `${Math.round(value * 100)}%`

interface MarkerProps {
  tag: TagDraft
  position: number
  selected: boolean
  frame: RefObject<HTMLDivElement | null>
  onSelect: () => void
  onMove: (point: { x: number; y: number }) => void
  onRemove: () => void
}

function Marker({ tag, position, selected, frame, onSelect, onMove, onRemove }: MarkerProps) {
  const { t } = useTranslation('provider')
  const [dragging, setDragging] = useState(false)
  const name = tag.username ? `@${tag.username}` : t('post.tags.unnamed', { position })

  const at = (event: PointerEvent) => {
    const rect = frame.current?.getBoundingClientRect()
    return rect && pointIn(rect, event.clientX, event.clientY)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      return onRemove()
    }
    const point = nudged(tag, event.key, event.shiftKey)
    if (!point) return
    event.preventDefault()
    onMove(point)
  }

  return (
    <button
      type="button"
      aria-label={t('post.tags.marker', { name, x: percent(tag.x), y: percent(tag.y) })}
      aria-pressed={selected}
      className={cn(
        'absolute z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-full outline-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={{ left: percent(tag.x), top: percent(tag.y) }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return
        event.stopPropagation()
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setDragging(true)
        onSelect()
      }}
      onPointerMove={(event) => {
        const point = dragging && at(event)
        if (point) onMove(point)
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <span
        className={cn(
          'size-3 rounded-full border-2 border-background bg-primary shadow-sm',
          selected && 'ring-2 ring-ring'
        )}
      />
      <span className="pointer-events-none absolute top-full max-w-32 -translate-y-1 truncate rounded-sm bg-background/90 px-1.5 py-0.5 text-xs text-foreground shadow-sm">
        {name}
      </span>
    </button>
  )
}

interface HintProps {
  full: boolean
  visible: boolean
}

function Hint({ full, visible }: HintProps) {
  const { t } = useTranslation('provider')
  if (!visible) return null
  return (
    <p className="pointer-events-none absolute inset-x-2 top-2 z-10 rounded-sm bg-background/90 px-2 py-1 text-center text-xs text-foreground shadow-sm">
      {full ? t('post.tags.full', { limit: TAGS_PER_POST }) : t('post.tags.hint')}
    </p>
  )
}

function RemoveTag({ tag, onRemove }: { tag: TagDraft; onRemove: () => void }) {
  const { t } = useTranslation('provider')
  const flipped = (tag.x ?? 0.5) > 0.7
  return (
    <IconButton
      type="button"
      size="icon-xs"
      label={t('post.tags.remove', { name: `@${tag.username}` })}
      className={cn(
        'absolute z-20 -translate-y-1/2',
        flipped ? '-translate-x-[calc(100%+1.25rem)]' : 'translate-x-5'
      )}
      style={{ left: percent(tag.x), top: percent(tag.y) }}
      onClick={onRemove}
    >
      <X />
    </IconButton>
  )
}

interface Point {
  x: number
  y: number
}

function useLastPoint(pending?: { x?: number; y?: number }) {
  const [last, setLast] = useState<Point>()
  const x = pending?.x
  const y = pending?.y
  if (x !== undefined && y !== undefined && (last?.x !== x || last.y !== y)) setLast({ x, y })
  return last
}

interface TagLayerProps {
  editor: TagEditor
  tags: TagDraft[]
  all: TagDraft[]
}

export function TagLayer({ editor, tags, all }: TagLayerProps) {
  const { t } = useTranslation('provider')
  const frame = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLButtonElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const { selected, setSelected, pendingHere, place, change } = editor
  const full = !mayAddTag(all)
  const anchorAt = useLastPoint(pendingHere)
  const picked = tags.find(({ key }) => key === selected)
  const remove = (key: string) => {
    editor.remove(key)
    surface.current?.focus()
  }
  return (
    <div ref={frame} className="absolute inset-0 touch-manipulation">
      <button
        ref={surface}
        type="button"
        data-testid="tag-picture"
        aria-label={t('post.tags.place')}
        disabled={full}
        className="absolute inset-0 cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed"
        onClick={(event) => {
          const rect = frame.current?.getBoundingClientRect()
          if (rect)
            place(
              event.detail === 0 ? { x: 0.5, y: 0.5 } : pointIn(rect, event.clientX, event.clientY)
            )
        }}
      />
      <Hint full={full} visible={full || (!pendingHere && tags.length === 0)} />
      {anchorAt && (
        <span
          ref={dot}
          aria-hidden
          data-testid={pendingHere ? 'pending-tag' : 'tag-anchor'}
          className={cn(
            'pointer-events-none absolute z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-primary bg-background/60 shadow-sm',
            !pendingHere && 'invisible'
          )}
          style={{ left: percent(anchorAt.x), top: percent(anchorAt.y) }}
        />
      )}
      <TagPopover editor={editor} anchor={dot} returnFocus={surface} />
      {tags.map((tag, index) => (
        <Marker
          key={tag.key}
          tag={tag}
          position={index + 1}
          selected={tag.key === selected}
          frame={frame}
          onSelect={() => setSelected(tag.key)}
          onMove={(point) => change(tag.key, point)}
          onRemove={() => remove(tag.key)}
        />
      ))}
      {picked && <RemoveTag tag={picked} onRemove={() => remove(picked.key)} />}
    </div>
  )
}
