/** Everything Instagram-specific. A second network is a second profile. */
export const instagram = {
  columns: 3,
  cellRatio: { width: 3, height: 4 },
  carouselLimit: 20,
  handleMaxLength: 30,
  nameMaxLength: 30
} as const

const { width, height } = instagram.cellRatio

export const cellShape = { aspectRatio: `${width} / ${height}` }

export const gridColumns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }
