import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { provider } from '@/config/provider'
import { usePlanner } from '@/features/planner/planner'

import { MoveFailure, movePosts } from './move-posts'
import { formatPostTime, toFieldTime } from './post-time'
import type { Move, Room } from './publish-timing'
import { PROVIDER_KEY } from './queries'
import { useRoom } from './use-spacing'

interface MakeRoomProps {
  cell: string
  from: number
  onUse: (when: string) => void
}

const time = (at: number) => formatPostTime(new Date(at).toISOString())

function usePosition() {
  const grid = usePlanner(({ board }) => board.grid)
  return (cell: string) => grid.indexOf(cell) + 1
}

function Moves({ moves }: { moves: Move[] }) {
  const { t } = useTranslation('provider')
  const position = usePosition()
  return (
    <ul className="mx-6 flex list-disc flex-col gap-1 pl-5 text-sm">
      {moves.map(({ cell, from, to }) => (
        <li key={cell}>
          {t('post.room.move', { position: position(cell), from: time(from), to: time(to) })}
        </li>
      ))}
    </ul>
  )
}

function Failure({ failure }: { failure: MoveFailure }) {
  const { t } = useTranslation('provider')
  const position = usePosition()
  const named = (moves: Move[]) =>
    moves
      .map(({ cell, to }) => t('post.room.post', { position: position(cell), time: time(to) }))
      .join(', ')
  return (
    <Alert variant="error">
      <AlertDescription>
        <p>{t('post.room.failed')}</p>
        {failure.moved.length > 0 && <p>{t('post.room.moved', { posts: named(failure.moved) })}</p>}
        <p>{t('post.room.left', { posts: named(failure.left) })}</p>
      </AlertDescription>
    </Alert>
  )
}

export function MakeRoom({ cell, from, onUse }: MakeRoomProps) {
  const { t } = useTranslation('provider')
  const queryClient = useQueryClient()
  const room = useRoom(cell, from)
  const [asking, setAsking] = useState<Room>()
  const [failure, setFailure] = useState<MoveFailure>()
  const move = useMutation({
    mutationFn: ({ moves }: Room) => movePosts(moves),
    onMutate: () => setFailure(undefined),
    onSuccess: (_, { start }) => onUse(toFieldTime(start)),
    onError: (error) => {
      if (error instanceof MoveFailure) setFailure(error)
    },
    onSettled: () => {
      setAsking(undefined)
      void queryClient.invalidateQueries({ queryKey: [PROVIDER_KEY] })
    }
  })
  return (
    <>
      {room && (
        <Alert variant="warning">
          <AlertDescription>{t('post.room.noFit')}</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" variant="outline" onClick={() => setAsking(room)}>
              {t('post.room.offer')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {failure && <Failure failure={failure} />}
      <ConfirmDialog
        open={Boolean(asking)}
        onOpenChange={(open) => !open && !move.isPending && setAsking(undefined)}
        title={t('post.room.title')}
        description={t('post.room.description', {
          provider: provider.name,
          time: asking && time(asking.start.getTime())
        })}
        cancelLabel={t('post.room.cancel')}
        actions={
          <Button loading={move.isPending} onClick={() => asking && move.mutate(asking)}>
            {t('post.room.confirm')}
          </Button>
        }
      >
        {asking && <Moves moves={asking.moves} />}
      </ConfirmDialog>
    </>
  )
}
