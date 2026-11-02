import { useTranslation } from 'react-i18next'

import { LazyOverlay } from '@/components/lazy-overlay'
import { closeAlbum, useOpenAlbumId } from '@/features/albums/album-store'
import { loadStrings } from '@/i18n/load-strings'
import { lazyComponent } from '@/lib/lazy-component'

import { CellMenu } from './cell-menu'
import { closeLightbox, useLightboxId } from './lightbox-store'

const Lightbox = lazyComponent(() => import('./lightbox').then(({ Lightbox }) => Lightbox))
const AlbumDialog = lazyComponent(
  () => import('@/features/albums/album-dialog').then(({ AlbumDialog }) => AlbumDialog),
  () => loadStrings('albums')
)

function OpenAlbum() {
  const { t } = useTranslation('planner')
  const id = useOpenAlbumId()
  if (!id) return null
  return (
    <LazyOverlay name={t('albumName')} onClose={closeAlbum}>
      <AlbumDialog key={id} id={id} />
    </LazyOverlay>
  )
}

function OpenImage() {
  const { t } = useTranslation('planner')
  const id = useLightboxId()
  if (!id) return null
  return (
    <LazyOverlay name={t('lightboxName')} onClose={closeLightbox}>
      <Lightbox id={id} />
    </LazyOverlay>
  )
}

/** Everything that opens over the board, whichever cell or key opened it. */
export function PlannerOverlays() {
  return (
    <>
      <OpenImage />
      <OpenAlbum />
      <CellMenu />
    </>
  )
}
