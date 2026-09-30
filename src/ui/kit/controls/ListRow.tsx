// LIST ROW — a label (+ optional detail line) on the left, a control or value on the right.
// The building block of settings, lobbies and scoreboards. With onClick the whole row is a button.
import type { ReactNode } from 'react'

type ListRowProps = { label: ReactNode; detail?: ReactNode; children?: ReactNode; onClick?: () => void }

export function ListRow({ label, detail, children, onClick }: ListRowProps) {
  const inside = (
    <>
      <span className="kit-listrow-text">
        <span>{label}</span>
        {detail && <span className="kit-listrow-detail">{detail}</span>}
      </span>
      {children}
    </>
  )
  return onClick
    ? <button type="button" className="kit-listrow kit-target" onClick={onClick}>{inside}</button>
    : <div className="kit-listrow">{inside}</div>
}
