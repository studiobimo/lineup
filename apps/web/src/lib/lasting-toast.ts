import { toastManager } from '@/components/ui/toast'
import i18n from '@/i18n/config'

type Options = Pick<Parameters<typeof toastManager.add>[0], 'type' | 'title' | 'description'>

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
