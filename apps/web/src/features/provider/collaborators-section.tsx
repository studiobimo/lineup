import { POST } from 'lineup-contract'
import { PlusIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Group, GroupSeparator } from '@/components/ui/group'
import { Input } from '@/components/ui/input'

import type { PostOptions } from './post-options'
import { PostSection } from './post-section'
import { isValidName, typedUsername } from './tags'

interface CollaboratorsSectionProps {
  collaborators: PostOptions['collaborators']
  onChange: (collaborators: PostOptions['collaborators']) => void
}

export function CollaboratorsSection({ collaborators, onChange }: CollaboratorsSectionProps) {
  const { t } = useTranslation('provider')
  const [typed, setTyped] = useState('')
  const full = collaborators.length >= POST.limit.collaborators
  const again = collaborators.includes(typed)
  const mayAdd = isValidName(typed) && !full && !again
  const add = () => {
    if (!mayAdd) return
    onChange([...collaborators, typed])
    setTyped('')
  }
  const note = full
    ? t('post.collaborators.full', { limit: POST.limit.collaborators })
    : again
      ? t('post.collaborators.again')
      : t('post.collaborators.hint', { limit: POST.limit.collaborators })
  return (
    <PostSection title={t('post.collaborators.title')}>
      <Field>
        <FieldLabel>{t('post.collaborators.label')}</FieldLabel>
        <Group>
          <Input
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={30}
            placeholder={t('post.collaborators.placeholder')}
            value={typed}
            disabled={full}
            onChange={({ target }) => setTyped(typedUsername(target.value))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              add()
            }}
          />
          <GroupSeparator className="bg-field-border dark:before:bg-transparent" />
          <Button
            type="button"
            variant="outline"
            className="border-field-border"
            disabled={!mayAdd}
            onClick={add}
          >
            <PlusIcon aria-hidden="true" />
            {t('post.collaborators.add')}
          </Button>
        </Group>
        <FieldDescription>{note}</FieldDescription>
      </Field>
      <ul className="flex flex-col gap-1.5">
        {collaborators.map((name) => (
          <li key={name} className="flex items-center justify-between gap-2 text-sm">
            <span className="wrap-anywhere">@{name}</span>
            <IconButton
              type="button"
              variant="ghost"
              label={t('post.collaborators.remove', { name })}
              onClick={() => onChange(collaborators.filter((other) => other !== name))}
            >
              <XIcon />
            </IconButton>
          </li>
        ))}
      </ul>
    </PostSection>
  )
}
