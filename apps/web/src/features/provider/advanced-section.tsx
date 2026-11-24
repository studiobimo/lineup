import { POST } from 'lineup-contract'
import { useTranslation } from 'react-i18next'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import type { PostOptions } from './post-options'
import { PostSection } from './post-section'

interface AdvancedSectionProps {
  options: PostOptions
  onChange: (options: PostOptions) => void
}

export function AdvancedSection({ options, onChange }: AdvancedSectionProps) {
  const { t } = useTranslation('provider')
  const { commentsOff, firstComment } = options
  return (
    <PostSection title={t('post.advanced.title')}>
      <Field>
        <FieldLabel>
          <Switch
            checked={commentsOff}
            onCheckedChange={(checked) => onChange({ ...options, commentsOff: checked })}
          />
          {t('post.advanced.commentsOff')}
        </FieldLabel>
        <FieldDescription>{t('post.advanced.commentsNote')}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t('post.advanced.firstComment')}</FieldLabel>
        <Textarea
          value={firstComment}
          maxLength={POST.limit.firstComment}
          onChange={({ target }) => onChange({ ...options, firstComment: target.value })}
        />
        <FieldDescription>
          {t('post.advanced.firstCommentHint')}{' '}
          {t('post.advanced.firstCommentCount', {
            count: firstComment.length,
            limit: POST.limit.firstComment
          })}
        </FieldDescription>
      </Field>
    </PostSection>
  )
}
