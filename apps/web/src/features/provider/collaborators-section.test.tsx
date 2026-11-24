import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadStrings } from '@/i18n/load-strings'

import { CollaboratorsSection } from './collaborators-section'
import { PostFacts } from './post-facts'

function Harness({ start = [] as string[] }) {
  const [collaborators, setCollaborators] = useState(start)
  return <CollaboratorsSection collaborators={collaborators} onChange={setCollaborators} />
}

async function open() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Collaborators' }))
  return user
}

describe('CollaboratorsSection', () => {
  beforeAll(() => loadStrings('provider'))

  it('is closed until opened, then adds a name on Enter or the button', async () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Collaborators' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    const user = await open()
    await user.type(screen.getByLabelText('Invite a collaborator'), '@Friend.One{Enter}')
    expect(screen.getByText('@friend.one')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Invite a collaborator'), 'second')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('@second')).toBeInTheDocument()
  })

  it('refuses a fourth, and says why', async () => {
    render(<Harness start={['one', 'two', 'three']} />)
    await open()
    expect(screen.getByLabelText('Invite a collaborator')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByText(/most Instagram allows, 3 collaborators/)).toBeInTheDocument()
  })

  it('refuses a name already invited, and takes one away', async () => {
    render(<Harness start={['one']} />)
    const user = await open()
    await user.type(screen.getByLabelText('Invite a collaborator'), 'one')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByText('That account is already invited.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove @one' }))
    expect(screen.queryByText('@one')).toBeNull()
  })
})

describe('PostFacts', () => {
  beforeAll(() => loadStrings('provider'))

  it('lists the invited, and the ones Instagram dropped with the reason', () => {
    render(
      <PostFacts
        collaborators={['one', 'two']}
        droppedCollaborators={[{ username: 'two', reason: 'Account is private' }]}
      />
    )
    expect(screen.getByText('Invited to collaborate: @one')).toBeInTheDocument()
    expect(
      screen.getByText('Instagram did not invite @two: Account is private')
    ).toBeInTheDocument()
  })

  it('says comments are off and shows the first comment', () => {
    render(<PostFacts commentsEnabled={false} firstComment="Link in bio" />)
    expect(screen.getByText('Comments are turned off, if Instagram allows it.')).toBeInTheDocument()
    expect(screen.getByText('First comment: Link in bio')).toBeInTheDocument()
  })

  it('shows nothing without any', () => {
    const { container } = render(<PostFacts />)
    expect(container).toBeEmptyDOMElement()
  })
})
