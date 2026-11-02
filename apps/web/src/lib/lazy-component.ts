import { type ComponentType, lazy } from 'react'

/** A component that arrives on demand, with whatever it cannot render without, such as strings. */
export const lazyComponent = <Props extends object>(
  load: () => Promise<ComponentType<Props>>,
  ...needs: (() => Promise<unknown>)[]
) =>
  lazy(async () => {
    const [component] = await Promise.all([load(), ...needs.map((need) => need())])
    return { default: component }
  })
