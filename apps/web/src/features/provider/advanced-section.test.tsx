import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { AdvancedSection } from './advanced-section'
import { NO_OPTIONS, type PostOptions } from './post-options'

function Harness({ onChange }: { onChange: (options: PostOptions) => void }) {
  const [options, setOptions] = useState(NO_OPTIONS)
  return (
    <AdvancedSection
      options={options}
      onChange={(next) => {
        setOptions(next)
        onChange(next)
      }}
    />
  )
}

describe('AdvancedSection', () => {
  beforeAll(() => loadStrings('provider'))

  it('is closed, and says that turning comments off is best effort', async () => {
    const user = userEvent.setup()
    render(<Harness onChange={() => undefined} />)
    const trigger = screen.getByRole('button', { name: 'Advanced settings' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByText(/best effort/)).toBeInTheDocument()
  })

  it('reports the switch and the first comment', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Advanced settings' }))
    await user.click(screen.getByRole('switch', { name: 'Turn off commenting' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ commentsOff: true }))
    await user.type(screen.getByLabelText('First comment'), 'Hi')
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ commentsOff: true, firstComment: 'Hi' })
    )
  })
})
