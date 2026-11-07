import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { NotFound } from './components/not-found'
import { RouteError } from './components/route-error'
import { routeTree } from './routeTree.gen'

export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
