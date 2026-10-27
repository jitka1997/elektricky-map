// An entry's exact spot: where you were when you logged it, if you chose to
// show it. It's saved next to the city, which stays what Stats, Together and
// notifications use; only the map pin sits on the spot.

/** Only a position at least this precise (in metres) can be shown as your
 * exact spot: phone GPS is usually within 5–20 m, while a computer locating
 * itself by Wi-Fi can be off by hundreds of metres or more. */
export const SPOT_ACCURACY_M = 100

export type Spot = { latitude: number; longitude: number }

/** A GPS reading, with how far off it may be (in metres). */
export type Here = Spot & { accuracy: number }

// 4 decimals is about 10 m: enough to find someone, and no more exact.
const round = (degrees: number) => Math.round(degrees * 1e4) / 1e4

/** The spot to save for a GPS reading, rounded to about 10 m. */
export const toSpot = ({ latitude, longitude }: Spot): Spot => ({
  latitude: round(latitude),
  longitude: round(longitude),
})

/** Where an entry's pin goes: its exact spot if shown, otherwise the city. */
export const pinOf = (entry: Spot & { spot?: Spot }): Spot =>
  entry.spot ?? { latitude: entry.latitude, longitude: entry.longitude }
