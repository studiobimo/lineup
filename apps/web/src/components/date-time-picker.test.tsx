import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { DateTimePicker } from './date-time-picker'

function Harness({
  initial = '2030-05-10T14:30',
  hourCycle = 12,
  onBlur
}: {
  initial?: string
  hourCycle?: 12 | 24
  onBlur?: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <DateTimePicker
        id="when"
        value={value}
        onChange={setValue}
        onBlur={onBlur}
        hourCycle={hourCycle}
        minDate={new Date(2030, 4, 8)}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

const current = () => screen.getByTestId('value')

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /2030|Pick/ }))
  return screen.findByRole('listbox', { name: 'Hour' })
}
const option = (list: string, name: string) =>
  within(screen.getByRole('listbox', { name: list })).getByRole('option', { name })

describe('DateTimePicker', () => {
  it('sets the day, hour, minute and period', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await open(user)

    await user.click(screen.getByRole('button', { name: /May 20, 2030/ }))
    expect(current()).toHaveTextContent('2030-05-20T14:30')
    await user.click(option('Hour', '09'))
    await user.click(option('Minute', '05'))
    await user.click(option('AM or PM', 'AM'))
    expect(current()).toHaveTextContent('2030-05-20T09:05')
    await user.click(option('AM or PM', 'PM'))
    expect(current()).toHaveTextContent('2030-05-20T21:05')
  })

  it('treats 12 PM as noon and 12 AM as midnight', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await open(user)
    await user.click(option('Hour', '12'))
    expect(current()).toHaveTextContent('2030-05-10T12:30')
    await user.click(option('AM or PM', 'AM'))
    expect(current()).toHaveTextContent('2030-05-10T00:30')
  })

  it('clears the value and reports blur when it closes', async () => {
    const user = userEvent.setup()
    const onBlur = vi.fn()
    render(<Harness onBlur={onBlur} />)
    await open(user)
    expect(onBlur).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(current()).toHaveTextContent(/^$/)
    await user.keyboard('{Escape}')
    expect(onBlur).toHaveBeenCalledOnce()
  })

  it('disables days before the minimum', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await open(user)
    expect(screen.getByRole('button', { name: /May 7, 2030/ })).toBeDisabled()
  })

  it('moves through a time column with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await open(user)
    option('Minute', '30').focus()
    await user.keyboard('{ArrowDown}')
    expect(current()).toHaveTextContent('2030-05-10T14:31')
    await user.keyboard('{End}')
    expect(current()).toHaveTextContent('2030-05-10T14:59')
    await user.keyboard('{Home}')
    expect(current()).toHaveTextContent('2030-05-10T14:00')
    await user.keyboard('{ArrowUp}')
    expect(current()).toHaveTextContent('2030-05-10T14:00')
  })

  it('shows 00 to 23 and no period in 24-hour mode', async () => {
    const user = userEvent.setup()
    render(<Harness hourCycle={24} />)
    await open(user)
    expect(screen.queryByRole('listbox', { name: 'AM or PM' })).not.toBeInTheDocument()
    await user.click(option('Hour', '23'))
    expect(current()).toHaveTextContent('2030-05-10T23:30')
  })

  it('starts empty, then fills in a default time when a day is picked', async () => {
    const user = userEvent.setup()
    render(<Harness initial="" />)
    await user.click(screen.getByRole('button', { name: 'Pick a date and time' }))
    await user.click(
      await screen
        .findByRole('button', { name: /today/i })
        .catch(() => screen.getByRole('button', { name: 'Today' }))
    )
    expect(current()).toHaveTextContent(/T09:00$/)
  })
})
