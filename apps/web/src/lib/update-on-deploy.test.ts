import { describe, expect, it, vi } from 'vitest'

import { updateOnDeploy } from './update-on-deploy'

function setup(controlled = true) {
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null
  }) as unknown as ServiceWorkerContainer
  const page = Object.assign(new EventTarget(), { visibilityState: 'visible' }) as {
    visibilityState: DocumentVisibilityState
  } & EventTarget
  const reload = vi.fn()
  updateOnDeploy(container, page as unknown as Document, reload)
  const take = () => container.dispatchEvent(new Event('controllerchange'))
  const hide = () => {
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
  }
  const touch = () => page.dispatchEvent(new Event('pointerdown'))
  return { reload, take, hide, touch }
}

describe('updateOnDeploy', () => {
  it('reloads an untouched page as soon as a new version takes over', () => {
    const { reload, take } = setup()
    take()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('waits until a page in use is hidden', () => {
    const { reload, take, hide, touch } = setup()
    touch()
    take()
    expect(reload).not.toHaveBeenCalled()
    hide()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('leaves the first install alone, since that page is already current', () => {
    const { reload, take } = setup(false)
    take()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once however often control changes', () => {
    const { reload, take } = setup()
    take()
    take()
    expect(reload).toHaveBeenCalledOnce()
  })
})
