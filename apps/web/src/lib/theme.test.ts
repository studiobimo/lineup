import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getTheme, setTheme, startTheme, subscribeToTheme } from './theme'

function systemPrefers(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: dark,
    addEventListener: vi.fn()
  } as unknown as MediaQueryList)
}

describe('theme', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => document.documentElement.classList.remove('dark'))

  it('follows the system until a theme is chosen', () => {
    systemPrefers(true)
    startTheme()
    expect(getTheme()).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
  })

  it('keeps a chosen theme over the system', () => {
    systemPrefers(true)
    setTheme('light')
    expect(getTheme()).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('ignores a stored value it does not know', () => {
    systemPrefers(false)
    localStorage.setItem('theme', 'sepia')
    expect(getTheme()).toBe('light')
  })

  it('tells subscribers until they unsubscribe', () => {
    systemPrefers(false)
    const listener = vi.fn()
    const unsubscribe = subscribeToTheme(listener)
    setTheme('dark')
    unsubscribe()
    setTheme('light')
    expect(listener).toHaveBeenCalledOnce()
  })
})
