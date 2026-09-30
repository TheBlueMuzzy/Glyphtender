// AVATAR — a player's picture, or their initials if there's no picture.
// active: highlighted ring (whose turn it is).
// color: the player's own colour behind the initials (any CSS colour, e.g. from the game's content JSON);
//        without it the avatar uses the style's primary colour. Initials stay in on-primary, so pick colours it reads on.
import type { CSSProperties } from 'react'

type AvatarProps = { name: string; src?: string; active?: boolean; color?: string }

export function Avatar({ name, src, active, color }: AvatarProps) {
  const initials = name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
  return (
    <span className="kit-avatar" data-state={active ? 'active' : undefined} role="img" aria-label={name}
      style={{ '--kit-avatar-color': color } as CSSProperties}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  )
}
