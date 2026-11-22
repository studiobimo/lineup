import { describe, expect, it } from 'vitest'

import type { Board } from './board-store'
import {
  type ActionContext,
  type ActionSurface,
  boardCellContext,
  cellContext,
  selectionContext,
  visibleActions
} from './cell-actions'

const keys = (surface: ActionSurface, context: ActionContext) =>
  visibleActions(surface, context).map(({ key }) => key)

const menuKeys = (context: ActionContext) =>
  (['menuOpen', 'menuPost', 'menuEdit'] as const).flatMap((surface) => keys(surface, context))

const board: Board = {
  tray: ['t'],
  grid: ['g', 'l', 'p'],
  locked: ['l'],
  posts: {
    p: {
      id: 'post',
      accountId: 'account',
      scheduledFor: '2030-01-01T00:00:00.000Z',
      timeZone: 'UTC',
      caption: '',
      status: 'scheduled'
    }
  }
}

describe('board action visibility', () => {
  it.each([
    [
      'a tray cell',
      't',
      true,
      ['openImage', 'select', 'moveToGrid', 'remove'],
      ['openImage', 'moveToGrid', 'remove']
    ],
    [
      'a grid cell that can schedule',
      'g',
      true,
      ['openImage', 'select', 'schedule', 'lock', 'moveToTray', 'remove'],
      ['openImage', 'schedule', 'lock', 'moveToTray', 'remove']
    ],
    [
      'a grid cell with no connection',
      'g',
      false,
      ['openImage', 'select', 'lock', 'moveToTray', 'remove'],
      ['openImage', 'lock', 'moveToTray', 'remove']
    ],
    [
      'a locked cell',
      'l',
      true,
      ['openImage', 'select', 'schedule', 'lock'],
      ['openImage', 'schedule', 'lock']
    ],
    ['a posted cell', 'p', true, ['openImage', 'select', 'postDetails'], ['openImage']]
  ])(
    'shows the same actions in the menu and the cell controls for %s',
    (_, id, canSchedule, menu, controls) => {
      const context = boardCellContext(board, id, canSchedule)
      expect(menuKeys(context)).toEqual(menu)
      expect(keys('controls', context)).toEqual(controls)
    }
  )

  it('labels the lock toggle and the selection from the cell', () => {
    const locked = cellContext({
      id: 'l',
      container: 'grid',
      locked: true,
      posted: false,
      canSchedule: false,
      selected: true
    })
    expect(visibleActions('menuPost', locked).map(({ action }) => action.label(locked))).toEqual([
      'deselect',
      'unlock'
    ])
  })

  it('offers a selection only the moves and removal that apply', () => {
    const both = selectionContext(board, ['t', 'g'])
    expect([...keys('selectionMove', both), ...keys('selectionRemove', both)]).toEqual([
      'moveToGrid',
      'moveToTray',
      'remove'
    ])
    const tray = selectionContext(board, ['t'])
    expect(keys('selectionMove', tray)).toEqual(['moveToGrid'])
  })
})
