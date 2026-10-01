// THE CAROUSEL'S PAGES — plain maths, no browser: given where each item sits in the row and how wide the window
// onto it is, which items make up each page, how far the row slides to show it, and how much of the window that
// page fills (the rest is clipped, so the start of the next page's first item never peeks in, cut in half).
// A page = as many WHOLE items as fit, starting from the first one not yet shown (an item wider than the window
// gets a page of its own). The last page may leave space after its items.

/** One item in the row: its left edge and width, in px from the row's start. */
export type ItemBox = { left: number; width: number }
/** One page: its first item, how far (px) the row slides left to show it, and the width its whole items take. */
export type CarouselPage = { first: number; offset: number; width: number }

export function carouselPages(items: ItemBox[], view: number): CarouselPage[] {
  const end = Math.max(0, ...items.map((it) => it.left + it.width))
  if (items.length === 0 || view <= 0 || end <= view + 0.5) return [{ first: 0, offset: 0, width: Math.max(end, view) }] // everything fits
  const pages: CarouselPage[] = []
  let first = 0
  while (first < items.length) {
    const start = items[first].left
    // the page runs to the last item that fits whole (always at least its first item)
    let next = first + 1
    while (next < items.length && items[next].left + items[next].width - start <= view + 0.5) next++
    const last = items[next - 1]
    pages.push({ first, offset: start, width: last.left + last.width - start })
    first = next
  }
  return pages
}

/** Which page shows this item. */
export function pageOf(pages: CarouselPage[], index: number): number {
  let at = 0
  pages.forEach((p, i) => { if (p.first <= index) at = i })
  return at
}
