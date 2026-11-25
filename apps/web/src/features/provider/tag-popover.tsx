import { Check } from 'lucide-react'
import { type RefObject, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverPopup } from '@/components/ui/popover'

import { typedUsername } from './tags'
import type { TagEditor } from './use-tag-editor'

interface TagPopoverProps {
  editor: TagEditor
  anchor: RefObject<HTMLElement | null>
  returnFocus: RefObject<HTMLElement | null>
}

export function TagPopover({ editor, anchor, returnFocus }: TagPopoverProps) {
  const { t } = useTranslation('provider')
  const input = useRef<HTMLInputElement>(null)
  const { name, setName, confirm, discard } = editor
  return (
    <Popover open={editor.pendingHere !== undefined} onOpenChange={(open) => !open && discard()}>
      <PopoverPopup
        tooltipStyle
        anchor={anchor}
        initialFocus={input}
        finalFocus={returnFocus}
        className="z-50"
      >
        <div className="flex items-center gap-1.5 py-1">
          <Label className="sr-only" htmlFor="tag-pending">
            {t('post.tags.pending')}
          </Label>
          <span aria-hidden className="text-muted-foreground">
            @
          </span>
          <Input
            id="tag-pending"
            ref={input}
            size="sm"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            placeholder={t('post.tags.placeholder')}
            value={name}
            className="w-40"
            onChange={({ target }) => setName(typedUsername(target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirm()
              } else if (event.key === 'Escape') {
                event.stopPropagation()
                discard()
              }
            }}
          />
          <IconButton
            type="button"
            size="icon-sm"
            variant="ghost"
            label={t('post.tags.confirm')}
            disabled={name === ''}
            onClick={confirm}
          >
            <Check />
          </IconButton>
        </div>
      </PopoverPopup>
    </Popover>
  )
}
