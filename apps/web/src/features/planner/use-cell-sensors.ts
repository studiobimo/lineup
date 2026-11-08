import {
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'

import { stepBetweenCells } from './keyboard-drag'

const PICK_UP_DISTANCE = 6
const LONG_PRESS = { delay: 250, tolerance: 8 }

const keyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab]
}

export const useCellSensors = () =>
  useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: PICK_UP_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: LONG_PRESS }),
    useSensor(KeyboardSensor, { coordinateGetter: stepBetweenCells, keyboardCodes })
  )
