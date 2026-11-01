import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { IconButton } from '@/components/icon-button'
import { getTheme, setTheme, subscribeToTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useSyncExternalStore(subscribeToTheme, getTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <IconButton variant="ghost" label={t(`theme.${next}`)} onClick={() => setTheme(next)}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </IconButton>
  )
}
