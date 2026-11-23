export const instagram = {
  columns: 3,
  cellRatio: { width: 3, height: 4 },
  carouselLimit: 20,
  videoSizeLimit: 300 * 1024 * 1024,
  reelLengthLimit: 15 * 60,
  videosPerPost: 1,
  captionLimit: 2200,
  handleMaxLength: 30,
  nameMaxLength: 30,
  // ~keep
  // How long Instagram can take to put a post on the grid, so a later post does not go out first.
  // A guess to be tuned with real publish times: the base for a picture, the base for anything
  // with a video, and a minute more for each step of size over the free part.
  publishGap: {
    imageMs: 5 * 60_000,
    videoMs: 15 * 60_000,
    freeBytes: 100 * 1024 * 1024,
    stepBytes: 50 * 1024 * 1024,
    stepMs: 60_000
  }
} as const

const { width, height } = instagram.cellRatio

export const cellShape = { aspectRatio: `${width} / ${height}` }

export const gridColumns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }
