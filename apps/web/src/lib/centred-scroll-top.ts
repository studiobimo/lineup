// ~keep Computed from offsets, not bounding boxes: the popup scales while it opens, which would
// skew a measured rectangle. Setting scrollTop also leaves the page and dialog where they are,
// which scrollIntoView would not.
export function centredScrollTop(item: HTMLElement, viewport: HTMLElement) {
  return Math.max(0, item.offsetTop - (viewport.clientHeight - item.offsetHeight) / 2)
}
