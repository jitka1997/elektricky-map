export type TravelMode =
  | 'plane'
  | 'car'
  | 'bus'
  | 'train'
  | 'walk'
  | 'other'
  | 'ship'

export const TRAVEL_MODES: {
  value: TravelMode
  label: string
  icon: string
}[] = [
  { value: 'train', label: 'Train', icon: '🚆' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'plane', label: 'Plane', icon: '✈️' },
  { value: 'ship', label: 'Ship', icon: '🚢' },
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'other', label: 'Other', icon: '🚊' },
]

export const DEFAULT_TRAVEL_MODE: TravelMode = 'other'

/** Emoji for a travel mode (falls back to elektricka). */
export const travelIcon = (mode?: TravelMode): string =>
  TRAVEL_MODES.find((m) => m.value === mode)?.icon ?? '🚊'

// Modes can override the emoji with a custom image served from /public. The
// generic "other" mode uses our tram favicon.
export const TRAVEL_MODE_IMAGE: Partial<Record<TravelMode, string>> = {
  other: '/favicon-32x32.png',
}

/** Custom image URL for a mode, if it has one (otherwise use travelIcon). */
export const travelImage = (mode?: TravelMode): string | undefined =>
  TRAVEL_MODE_IMAGE[mode ?? 'other']
