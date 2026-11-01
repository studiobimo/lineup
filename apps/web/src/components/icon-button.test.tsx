import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { TooltipCreateHandle, TooltipProvider } from '@/components/ui/tooltip'

import { IconButton, SharedTooltip } from './icon-button'

describe('IconButton', () => {
  it('names the button and shows the same words on hover', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider delay={0}>
        <IconButton label="Add one">
          <Plus />
        </IconButton>
      </TooltipProvider>
    )

    expect(screen.queryByText('Add one')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button', { name: 'Add one' }))
    expect(await screen.findByText('Add one')).toBeInTheDocument()
  })

  it('shares one tooltip across buttons with the same handle', async () => {
    const user = userEvent.setup()
    const handle = TooltipCreateHandle<string>()
    render(
      <TooltipProvider delay={0}>
        <IconButton label="First" tooltip={handle}>
          <Plus />
        </IconButton>
        <IconButton label="Second" tooltip={handle}>
          <Plus />
        </IconButton>
        <SharedTooltip handle={handle} />
      </TooltipProvider>
    )

    await user.hover(screen.getByRole('button', { name: 'Second' }))
    expect(await screen.findByText('Second')).toBeInTheDocument()
    expect(screen.queryByText('First')).not.toBeInTheDocument()
  })
})
