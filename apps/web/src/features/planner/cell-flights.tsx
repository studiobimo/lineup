import { m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { coverOf, flightsBetween } from './board'
import { type Box, cellBox, cellElement, dragStore, ground, launch } from './drag-target'
import { settle } from './motion'
import { plannerStore } from './planner'
import { Thumbnail } from './thumbnail'

const MAX_FLIGHTS = 24
const RECEIVING_SCALE = 0.94

interface Flight {
  from: string
  to: string
  image: string
  fromBox: Box
  toBox: Box
  width: number
  height: number
  picture?: HTMLCanvasElement
}

const widthOf = ({ left, right }: Box) => right - left

const staysPut = ({ fromBox, toBox }: Flight) =>
  fromBox.left === toBox.left && fromBox.top === toBox.top

const heading = (flight: Flight): Flight => ({
  ...flight,
  toBox: cellBox(flight.to) ?? flight.toBox
})

function copyOfPicture(cell: string) {
  const source = cellElement(cell)?.querySelector('canvas')
  if (!source) return undefined
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  copy.className = 'size-full object-cover'
  copy.getContext('2d')?.drawImage(source, 0, 0)
  return copy
}

function FlightPicture({ image, picture }: Pick<Flight, 'image' | 'picture'>) {
  if (!picture) return <Thumbnail id={image} label="" />
  return <div className="size-full" ref={(node) => void node?.append(picture)} />
}

export function CellFlights() {
  const reduced = useReducedMotion()
  const [flights, setFlights] = useState<Flight[]>([])
  const inbound = useRef(new Map<string, number>())

  useEffect(() => {
    if (reduced) return
    return plannerStore.subscribe(({ board }, { board: before }) => {
      if (board === before) return
      const { airborne } = dragStore.getState()
      const departures = flightsBetween(before, board)
        .filter(({ from }) => !airborne.has(from))
        .slice(0, MAX_FLIGHTS)
        .flatMap((flight) => {
          const fromBox = cellBox(flight.from)
          if (!fromBox) return []
          const showing = flight.image === coverOf(before, flight.from)
          return [{ ...flight, fromBox, picture: showing ? copyOfPicture(flight.from) : undefined }]
        })
      launch(departures.map(({ to }) => to))
      requestAnimationFrame(() => {
        const arrivals = departures.flatMap((departure) => {
          const toBox = cellBox(departure.to)
          if (!toBox) {
            ground([departure.to])
            return []
          }
          const { width, height } = toBox
          const count = inbound.current.get(departure.to) ?? 0
          inbound.current.set(departure.to, count + 1)
          return [{ ...departure, toBox, width, height }]
        })
        flushSync(() => {
          setFlights((current) => [
            ...current.map(heading),
            ...arrivals.toSorted((one, other) => +staysPut(one) - +staysPut(other))
          ])
        })
      })
    })
  }, [reduced])

  const arrive = ({ from, to }: Flight) => {
    setFlights((current) => current.filter((flight) => flight.from !== from || flight.to !== to))
    const left = (inbound.current.get(to) ?? 1) - 1
    if (left > 0) inbound.current.set(to, left)
    else {
      inbound.current.delete(to)
      ground([to])
    }
  }

  return flights.map((flight) => {
    const { from, to, image, fromBox, toBox, width, height, picture } = flight
    const receiving = staysPut(flight)
    return (
      <m.div
        key={`${from}:${to}`}
        aria-hidden
        data-flight
        className="pointer-events-none fixed top-0 left-0 z-40 origin-top-left overflow-hidden bg-muted"
        style={{ width, height }}
        initial={{ x: fromBox.left, y: fromBox.top, scale: widthOf(fromBox) / width }}
        animate={{ x: toBox.left, y: toBox.top, scale: widthOf(toBox) / width }}
        transition={settle}
        onAnimationComplete={receiving ? undefined : () => arrive(flight)}
      >
        <m.div
          className="size-full"
          animate={receiving ? { scale: [1, RECEIVING_SCALE, 1] } : undefined}
          transition={{ duration: settle.visualDuration, ease: 'easeInOut' }}
          onAnimationComplete={receiving ? () => arrive(flight) : undefined}
        >
          <FlightPicture image={image} picture={picture} />
        </m.div>
      </m.div>
    )
  })
}
