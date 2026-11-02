import { beforeEach, describe, expect, it, vi } from 'vitest'

import { boardStore, plannerStore } from '@/features/planner/planner'

import { backfillColours } from './backfill-colours'
import type { ImageColour } from './colour'

const colour: ImageColour = {
  dominant: { lightness: 0.6, chroma: 0.2, hue: 30 },
  palette: [{ lightness: 0.6, chroma: 0.2, hue: 30 }],
  tone: 0.6,
  vivid: 0.5
}

const stored = (id: string, extra = {}) => ({
  id,
  width: 10,
  height: 10,
  createdAt: '2026-11-01T00:00:00.000Z',
  thumbnail: new Blob(['thumbnail']),
  publish: new Blob(['publish']),
  ...extra
})

function fakeWorker(answer: (kind: string) => ImageColour | null) {
  const sent: string[] = []
  const worker = {
    onmessage: null as ((event: { data: ImageColour | null }) => void) | null,
    postMessage({ kind }: { kind: string }) {
      sent.push(kind)
      queueMicrotask(() => worker.onmessage?.({ data: answer(kind) }))
    },
    terminate: vi.fn()
  }
  return { worker, sent, create: () => worker as unknown as Worker }
}

describe('backfillColours', () => {
  beforeEach(async () => {
    await boardStore.deleteImages((await boardStore.listImages()).map(({ id }) => id))
    await boardStore.saveBoard({ tray: [], grid: [] })
    plannerStore.setState({ ready: false, session: 'starting' })
  })

  async function open(...images: ReturnType<typeof stored>[]) {
    await Promise.all(images.map((image) => boardStore.putImage(image)))
    await boardStore.saveBoard({ tray: images.map(({ id }) => id), grid: [] })
    await plannerStore.getState().load()
  }

  it('gives a board saved before colours existed its colours, and keeps them', async () => {
    await open(stored('old'))
    expect(plannerStore.getState().images.old.colour).toBeUndefined()

    const { worker, create } = fakeWorker(() => colour)
    await backfillColours(create)

    expect(plannerStore.getState().images.old.colour).toEqual(colour)
    expect((await boardStore.listImages())[0].colour).toEqual(colour)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('leaves the board and its undo history as they were', async () => {
    await open(stored('old'))
    const { board, past } = plannerStore.getState()

    await backfillColours(fakeWorker(() => colour).create)

    expect(plannerStore.getState().board).toEqual(board)
    expect(plannerStore.getState().past).toEqual(past)
  })

  it('starts no worker when every image has its colour', async () => {
    await open(stored('new', { colour }))
    const { create, sent } = fakeWorker(() => colour)
    await backfillColours(create)
    expect(sent).toEqual([])
  })

  it('moves on from an image it cannot read', async () => {
    await open(stored('bad'), stored('good'))
    let calls = 0
    await backfillColours(fakeWorker(() => (calls++ === 0 ? null : colour)).create)
    const { images } = plannerStore.getState()
    expect([images.bad.colour, images.good.colour].filter(Boolean)).toHaveLength(1)
  })

  it('stops when the page gives up the board', async () => {
    await open(stored('a'), stored('b'))
    const { create, sent } = fakeWorker(() => {
      plannerStore.setState({ session: 'elsewhere' })
      return colour
    })
    await backfillColours(create)
    expect(sent).toHaveLength(1)
  })
})
