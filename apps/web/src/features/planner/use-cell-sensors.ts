import {
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'

import { stepBetweenCells } from './keyboard-drag'

// Dragging a pixel or two is a click that wobbled, and cells hold buttons.
const PICK_UP_DISTANCE = 6
// On touch a finger that moves at once is scrolling the page, so a drag starts from a held press.
const LONG_PRESS = { delay: 250, tolerance: 8 }

// Only Space picks up: Enter on a cell opens its menu. Either still drops what is being carried.
const keyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab]
}

/** How a cell is picked up, wherever it is, so that the board and an album feel the same. */
export const useCellSensors = () =>
  useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: PICK_UP_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: LONG_PRESS }),
    useSensor(KeyboardSensor, { coordinateGetter: stepBetweenCells, keyboardCodes })
  )
