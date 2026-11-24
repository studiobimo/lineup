import { useTranslation } from 'react-i18next'

import { instagram } from '@/features/planner/network-profile'

import { MissingCopyError, VideoLimitError } from './send-post'
import { useProblemText } from './use-problem-text'

export function useSendProblem(error: Error | null) {
  const { t } = useTranslation('provider')
  const problemText = useProblemText()
  if (error instanceof MissingCopyError) return t('post.missingCopy')
  if (error instanceof VideoLimitError) {
    return t(`post.videoLimit.${error.limit}`, {
      size: instagram.videoSizeLimit / 1024 / 1024,
      minutes: instagram.reelLengthLimit / 60,
      count: instagram.videosPerPost
    })
  }
  return problemText(error)
}
