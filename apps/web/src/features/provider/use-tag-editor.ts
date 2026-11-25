import type { UserTag } from 'lineup-contract'
import { useState } from 'react'

import { isValidName, mayAddTag, type TagDraft } from './tags'

interface Pending {
  index: number
  x?: number
  y?: number
}

export function useTagEditor(
  tags: TagDraft[],
  index: number,
  onChange: (tags: TagDraft[]) => void
) {
  const [selected, setSelected] = useState<string>()
  const [pending, setPending] = useState<Pending>()
  const [name, setName] = useState('')

  const pendingHere = pending?.index === index ? pending : undefined

  const change = (key: string, changes: Partial<UserTag>) =>
    onChange(tags.map((tag) => (tag.key === key ? { ...tag, ...changes } : tag)))

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
    if (!pending) return
    if (!name || !isValidName(name)) return discard()
    const { x, y } = pending
    onChange([
      ...tags,
      {
        key: crypto.randomUUID(),
        username: name,
        mediaIndex: pending.index,
        ...(x !== undefined && { x, y })
      }
    ])
    discard()
  }

  const remove = (key: string) => {
    onChange(tags.filter((tag) => tag.key !== key))
    setSelected(undefined)
  }

  return {
    selected,
    setSelected,
    pendingHere,
    name,
    setName,
    change,
    discard,
    place,
    confirm,
    remove
  }
}

export type TagEditor = ReturnType<typeof useTagEditor>
