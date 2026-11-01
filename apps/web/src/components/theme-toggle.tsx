import { Moon, Sun } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getTheme, setTheme, subscribeToTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useSyncExternalStore(subscribeToTheme, getTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(`theme.${next}`)}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
