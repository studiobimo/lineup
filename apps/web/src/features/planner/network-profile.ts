/** Everything Instagram-specific. A second network is a second profile. */
export const instagram = {
  columns: 3,
  cellRatio: { width: 3, height: 4 },
  carouselLimit: 20,
  /** A video of either kind, Reel or carousel item, and how many one post may hold (ADR-0022). */
  videoSizeLimit: 300 * 1024 * 1024,
  reelLengthLimit: 15 * 60,
  videosPerPost: 1,
  captionLimit: 2200,
  handleMaxLength: 30,
  nameMaxLength: 30
} as const

const { width, height } = instagram.cellRatio

export const cellShape = { aspectRatio: `${width} / ${height}` }

export const gridColumns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }
