import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import type { Spacing } from './publish-timing'
import { ScheduleWarning } from './schedule-warning'

const mocks = vi.hoisted(() => ({ spacing: undefined as unknown, misordered: false }))
vi.mock('./use-spacing', () => ({ useSpacing: () => mocks.spacing }))
vi.mock('./use-misordered', () => ({ isMisordered: () => mocks.misordered }))

const slot = { cell: 'c', at: 0, gap: 15 * 60_000, video: true }
const close: Spacing = {
  near: [{ side: 'before', slot, position: 3 }],
  suggested: new Date('2030-01-01T10:15:00')
}

describe('the schedule warning', () => {
  beforeAll(() => loadStrings('provider'))
  beforeEach(() => {
    mocks.spacing = undefined
    mocks.misordered = false
  })

  it('shows nothing when there is room', () => {
    render(<ScheduleWarning cell="a" when="x" onUse={() => undefined} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names the post by its place on the grid, and says why', () => {
    mocks.spacing = close
    render(<ScheduleWarning cell="a" when="x" onUse={() => undefined} />)
    expect(screen.getByText(/position 3 on your grid needs about 15 minutes/)).toBeInTheDocument()
    expect(screen.getByText(/A post with a video can take several minutes/)).toBeInTheDocument()
  })

  it('offers the suggested time, and sets it when pressed', async () => {
    mocks.spacing = close
    const onUse = vi.fn()
    render(<ScheduleWarning cell="a" when="x" onUse={onUse} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /^Use / }))
    expect(onUse).toHaveBeenCalledWith('2030-01-01T10:15')
  })

  it('offers no button when there is no room, and says so', () => {
    mocks.spacing = { ...close, suggested: undefined }
    render(<ScheduleWarning cell="a" when="x" onUse={() => undefined} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/no time between these posts/)).toBeInTheDocument()
  })

  it('gives one alert when the order is wrong too', () => {
    mocks.spacing = close
    mocks.misordered = true
    render(<ScheduleWarning cell="a" when="x" onUse={() => undefined} />)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText(/will not go out in the order of your grid/)).toBeInTheDocument()
  })
})
