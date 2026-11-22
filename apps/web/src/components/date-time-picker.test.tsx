import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n/config'

import { centredScrollTop } from '@/lib/centred-scroll-top'

import { DateTimePicker } from './date-time-picker'

function Harness({
  initial = '2030-05-10T14:30',
  hourCycle = 12,
  onBlur,
  minDate = new Date(2030, 4, 8)
}: {
  initial?: string
  hourCycle?: 12 | 24
  onBlur?: () => void
  minDate?: Date
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
        minDate={minDate}
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
    await user.click(await screen.findByRole('button', { name: /Monday, May 20/ }))
    expect(current()).toHaveTextContent(/T09:00$/)
  })

  describe('minimum time', () => {
    const min = new Date(2030, 4, 10, 14, 31)
    const disabled = (list: string, name: string) => expect(option(list, name)).toBeDisabled()
    const enabled = (list: string, name: string) => expect(option(list, name)).toBeEnabled()

    it('disables earlier days, hours and minutes on the minimum day', async () => {
      const user = userEvent.setup()
      render(<Harness minDate={min} initial="2030-05-10T14:45" />)
      await open(user)
      expect(screen.getByRole('button', { name: /May 9, 2030/ })).toBeDisabled()
      expect(screen.getByRole('button', { name: /Friday, May 10/ })).toBeEnabled()
      disabled('Hour', '01')
      enabled('Hour', '02')
      enabled('Hour', '03')
      enabled('Minute', '45')
    })

    it('disables earlier minutes in the minimum hour and AM once the morning is past', async () => {
      const user = userEvent.setup()
      render(<Harness minDate={min} initial="2030-05-10T14:45" />)
      await open(user)
      disabled('AM or PM', 'AM')
      enabled('AM or PM', 'PM')
      await user.click(option('Hour', '02'))
      disabled('Minute', '30')
      enabled('Minute', '31')
      await user.click(option('Hour', '03'))
      enabled('Minute', '00')
    })

    it('frees every time on a later day', async () => {
      const user = userEvent.setup()
      render(<Harness minDate={min} initial="2030-05-11T09:00" />)
      await open(user)
      enabled('Hour', '01')
      enabled('AM or PM', 'AM')
    })

    it('moves the minute up when the minimum hour is chosen', async () => {
      const user = userEvent.setup()
      render(<Harness minDate={min} initial="2030-05-10T15:00" />)
      await open(user)
      await user.click(option('Hour', '02'))
      expect(current()).toHaveTextContent('2030-05-10T14:31')
    })

    it('moves the time to the minimum when the day becomes the minimum day', async () => {
      const user = userEvent.setup()
      render(<Harness minDate={min} initial="2030-05-11T09:15" />)
      await open(user)
      await user.click(screen.getByRole('button', { name: /Friday, May 10/ }))
      expect(current()).toHaveTextContent('2030-05-10T14:31')
      await user.click(option('AM or PM', 'PM'))
      expect(current()).toHaveTextContent('2030-05-10T14:31')
    })

    it('moves an unchosen default time to the next valid minute', async () => {
      const user = userEvent.setup()
      render(<Harness initial="" minDate={new Date(2030, 4, 10, 15, 7)} />)
      await user.click(screen.getByRole('button', { name: 'Pick a date and time' }))
      await user.click(screen.getByRole('button', { name: /Friday, May 10/ }))
      expect(current()).toHaveTextContent('2030-05-10T15:07')
    })
  })

  it('names weekdays and months in the active language', async () => {
    const user = userEvent.setup()
    await i18n.changeLanguage('es')
    try {
      render(<Harness />)
      await user.click(screen.getByRole('button', { name: /2030/ }))
      await screen.findByRole('listbox', { name: /Hora|Hour/ })
      expect(screen.getByText(/mayo de 2030|mayo 2030/i)).toBeInTheDocument()
      expect(screen.queryByText('May 2030')).not.toBeInTheDocument()
    } finally {
      await i18n.changeLanguage('en')
    }
  })

  it('centres an item in its viewport', () => {
    const item = { offsetTop: 300, offsetHeight: 32 } as HTMLElement
    const viewport = { clientHeight: 200 } as HTMLElement
    expect(centredScrollTop(item, viewport)).toBe(216)
    expect(centredScrollTop({ offsetTop: 10, offsetHeight: 32 } as HTMLElement, viewport)).toBe(0)
  })
})
