// TEXT — words, by role. Size and font come from the style; never set them yourself.
// kind: display (huge title) | title | heading | body | label | caption (quiet)
import type { ReactNode } from 'react'

type Kind = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption'
const tagFor = { display: 'h1', title: 'h2', heading: 'h3', body: 'p', label: 'span', caption: 'span' } as const

export function Text({ kind = 'body', children }: { kind?: Kind; children: ReactNode }) {
  const Tag = tagFor[kind]
  return <Tag className="kit-text" data-kind={kind}>{children}</Tag>
}
