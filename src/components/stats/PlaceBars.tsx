import type { PlaceTotal } from '@/lib/stats'

type Props = {
  items: PlaceTotal[]
  format: (value: number) => string
}

// Horizontal bars, one per city, scaled to the largest value.
const PlaceBars = ({ items, format }: Props) => {
  const max = items[0]?.value || 1
  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ place, value }) => (
        <li
          key={place.key}
          title={`${place.city}, ${place.country}: ${format(value)}`}
          className="grid grid-cols-[minmax(6rem,10rem)_minmax(0,1fr)_5.5rem] items-center gap-3 text-sm"
        >
          <span className="truncate">{place.city}</span>
          <span className="bg-base-300 h-3 overflow-hidden rounded-full">
            <span
              className="bg-base-content block h-full rounded-full"
              style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">
            {format(value)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default PlaceBars
