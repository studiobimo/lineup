import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

import { cellsThatCrossed } from './board'
import { type Box, cellBox, dragStore, ground, launch } from './drag-target'
import { settle } from './motion'
import { plannerStore } from './planner'
import { CellThumbnail } from './thumbnail'

// A bulk move should not start hundreds of flights, and most of them would be off screen anyway.
const MAX_FLIGHTS = 24

interface Flight {
  id: string
  from: Box
  to: Box
  width: number
  height: number
}

const widthOf = ({ left, right }: Box) => right - left

const heading = (flight: Flight): Flight => ({ ...flight, to: cellBox(flight.id) ?? flight.to })

/** The tray scrolls, so it clips its cells. A cell changing container flies above it instead. */
export function CellFlights() {
  const reduced = useReducedMotion()
  const [flights, setFlights] = useState<Flight[]>([])

  useEffect(() => {
    if (reduced) return
    return plannerStore.subscribe(({ board }, { board: before }) => {
      if (board === before) return
      const { airborne } = dragStore.getState()
      const departures = cellsThatCrossed(before, board)
        .filter((id) => !airborne.has(id))
        .slice(0, MAX_FLIGHTS)
        .flatMap((id) => {
          const from = cellBox(id)
          return from ? [{ id, from }] : []
        })
      launch(departures.map(({ id }) => id))
      // The board has changed but the page has not, until React has committed it.
      requestAnimationFrame(() => {
        const arrivals = departures.flatMap((departure) => {
          const to = cellBox(departure.id)
          if (to) return [{ ...departure, to, width: to.width, height: to.height }]
          ground([departure.id])
          return []
        })
        // A cell moved again while it is in the air heads for its new place.
        setFlights((current) => [...current.map(heading), ...arrivals])
      })
    })
  }, [reduced])

  const arrive = (id: string) => {
    setFlights((current) => current.filter((flight) => flight.id !== id))
    ground([id])
  }

  return flights.map(({ id, from, to, width, height }) => (
    <m.div
      key={id}
      aria-hidden
      data-flight
      className="pointer-events-none fixed top-0 left-0 z-40 origin-top-left overflow-hidden bg-muted"
      style={{ width, height }}
      initial={{ x: from.left, y: from.top, scale: widthOf(from) / width }}
      animate={{ x: to.left, y: to.top, scale: widthOf(to) / width }}
      transition={settle}
      onAnimationComplete={() => arrive(id)}
    >
      <CellThumbnail id={id} label="" />
    </m.div>
  ))
}
