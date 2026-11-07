import { toastManager } from '@/components/ui/toast'
import i18n from '@/i18n/config'

type Options = Pick<Parameters<typeof toastManager.add>[0], 'type' | 'title' | 'description'>

/** For what has to be read or acted on: it stays until dismissed, as nobody reads to a timer. */
export function lastingToast(options: Options) {
  const id = toastManager.add({
    ...options,
    timeout: 0,
    actionProps: {
      children: i18n.t('common:dismiss'),
      onClick: () => toastManager.close(id)
    }
  })
}
