/** Everything Instagram-specific. A second network is a second profile. */
export const instagram = {
  columns: 3,
  cellRatio: { width: 3, height: 4 },
  carouselLimit: 20
} as const

export const gridColumns = { gridTemplateColumns: `repeat(${instagram.columns}, minmax(0, 1fr))` }
