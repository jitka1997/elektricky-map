import { travelIcon, travelImage, TravelMode } from '@/lib/travel'

interface Props {
  mode?: TravelMode
  className?: string
}

// Renders a travel mode's glyph: a custom image (e.g. the tram) when the mode
// has one, otherwise its emoji.
const TravelModeIcon = ({ mode, className = '' }: Props) => {
  const image = travelImage(mode)
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className={`inline-block h-[1.2em] w-[1.2em] object-contain align-[-0.2em] ${className}`}
      />
    )
  }
  return (
    <span aria-hidden className={className}>
      {travelIcon(mode)}
    </span>
  )
}

export default TravelModeIcon
