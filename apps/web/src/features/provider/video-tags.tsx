import { TAGS_PER_POST } from 'lineup-contract'
import { X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'

import { TagPopover } from './tag-popover'
import { mayAddTag, type TagDraft } from './tags'
import type { TagEditor } from './use-tag-editor'

interface VideoTagsProps {
  editor: TagEditor
  all: TagDraft[]
  here: TagDraft[]
}

export function VideoTags({ editor, all, here }: VideoTagsProps) {
  const { t } = useTranslation('provider')
  const add = useRef<HTMLButtonElement>(null)
  return (
    <div className="mt-2 flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5">
        {here.map(({ key, username }) => (
          <li key={key} className="flex items-center rounded-sm bg-muted ps-2 text-xs">
            @{username}
            <IconButton
              type="button"
              size="icon-xs"
              variant="ghost"
              label={t('post.tags.remove', { name: `@${username}` })}
              onClick={() => editor.remove(key)}
            >
              <X />
            </IconButton>
          </li>
        ))}
      </ul>
      {mayAddTag(all) ? (
        <Button ref={add} type="button" size="sm" variant="outline" onClick={() => editor.place()}>
          {t('post.tags.add')}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('post.tags.full', { limit: TAGS_PER_POST })}
        </p>
      )}
      <TagPopover editor={editor} anchor={add} returnFocus={add} />
    </div>
  )
}
