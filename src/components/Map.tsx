'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useReducer, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'

import { useAuth } from '@/lib/AuthContext'
import { formatDate, formatTime } from '@/lib/dates'
import { useLocations } from '@/lib/LocationContext'
import { travelIcon, travelImage, TravelMode } from '@/lib/travel'

// Function to create custom icon from user's photo URL
const createUserIcon = (photoURL: string | null) => {
  // Use default icon if no photo URL is provided
  if (!photoURL) {
    return new L.Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  }

  // Use an <img> with referrerpolicy="no-referrer" rather than a CSS
  // background-image: Google profile photos (lh3.googleusercontent.com) reject
  // requests that send a referrer header, which background-image always does.
  return L.divIcon({
    html: `<img src="${photoURL}" referrerpolicy="no-referrer" style="width:40px;height:40px;border-radius:50%;border:2px solid gray;box-shadow:0 1px 3px rgba(0,0,0,0.3);object-fit:cover;" />`,
    className: 'user-photo-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })
}

const LocationMarker = () => {
  const map = useMap()
  const { user } = useAuth()
  const { locationData, flySignal } = useLocations()
  const didMount = useRef(false)

  // The current user's most recent logged location (locations are ordered
  // newest-first), or undefined if they have none.
  const myLocation = locationData.find((u) => u.userId === user?.uid)
    ?.locations?.[0]

  // Fly to the user's pin whenever flySignal is bumped (e.g. after logging a
  // new location). Skip the initial mount so it only fires on real requests.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    if (myLocation) {
      map.flyTo([myLocation.latitude, myLocation.longitude], 5)
    }
    // Only react to flySignal changes, not to every location/map update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flySignal])

  // Nothing to fly to — hide the button entirely.
  if (!myLocation) return null

  const flyToMyLocation = () => {
    map.flyTo([myLocation.latitude, myLocation.longitude], 5)
  }

  return (
    <button
      onClick={flyToMyLocation}
      className="btn btn-neutral btn-xs pointer-events-auto rounded-full"
    >
      Fly to my location
    </button>
  )
}

type BaseMarker = {
  userId: string
  userName: string | null
  photoURL: string | null
  lat: number
  lng: number
  city: string
  country: string
  createdAt: Date
}

// Distance (in pixels) each avatar is pushed from the shared center when
// several users share the same city.
const SPREAD_RADIUS_PX = 8

const UserMarkers = ({ hiddenUserId }: { hiddenUserId: string | null }) => {
  const map = useMap()
  const { user } = useAuth()
  const { locationData } = useLocations()
  // Re-render on zoom so the pixel-based spread stays correct at every zoom.
  const [, forceRerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    map.on('zoomend', forceRerender)
    return () => {
      map.off('zoomend', forceRerender)
    }
  }, [map])

  // One marker per user: their most recent location. The user whose journey is
  // currently playing is hidden so only their animated marker shows.
  const base: BaseMarker[] = []
  for (const u of locationData) {
    if (u.userId === hiddenUserId) continue
    const loc = u.locations?.[0]
    if (!loc) continue
    base.push({
      userId: u.userId,
      userName: u.userName,
      photoURL: u.photoURL,
      lat: loc.latitude,
      lng: loc.longitude,
      city: loc.city,
      country: loc.country,
      createdAt:
        loc.createdAt instanceof Date ? loc.createdAt : loc.createdAt.toDate(),
    })
  }

  // Group users that share (rounded) coordinates — i.e. the same city.
  // (Plain object, not a Map — the component is named `Map` and shadows it.)
  const groups: Record<string, BaseMarker[]> = {}
  for (const m of base) {
    const key = `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`
    ;(groups[key] ??= []).push(m)
  }

  const zoom = map.getZoom()
  const placed: (BaseMarker & { renderLat: number; renderLng: number })[] = []
  for (const arr of Object.values(groups)) {
    if (arr.length === 1) {
      placed.push({ ...arr[0], renderLat: arr[0].lat, renderLng: arr[0].lng })
      continue
    }
    // Fan the group out into a circle around the shared center, using pixel
    // offsets so the spacing looks consistent regardless of zoom.
    const center = map.project([arr[0].lat, arr[0].lng], zoom)
    const radius = SPREAD_RADIUS_PX + arr.length * 2
    arr.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / arr.length
      const point = L.point(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle)
      )
      const ll = map.unproject(point, zoom)
      placed.push({ ...m, renderLat: ll.lat, renderLng: ll.lng })
    })
  }

  // First name, with "(You)" appended for the current user.
  const nameLabel = (m: BaseMarker) => {
    const first = m.userName ? m.userName.trim().split(' ')[0] : ''
    if (m.userId === user?.uid) return first ? `${first} (You)` : 'You'
    return first || 'Anonymous'
  }

  return (
    <>
      {placed.map((m) => (
        <Marker
          key={m.userId}
          position={[m.renderLat, m.renderLng]}
          icon={createUserIcon(m.photoURL)}
        >
          <Popup>
            <div className="flex flex-col items-center">
              <div className="font-semibold">{nameLabel(m)}</div>
              <div>
                {m.city}, {m.country}
              </div>
              <div className="text-xs text-gray-500">
                Last seen: {formatDate(m.createdAt)}, {formatTime(m.createdAt)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

// A marker showing the current travel mode (custom image or emoji), used by the
// journey player. The glyph sits in a `.journey-glyph` span that gets rotated /
// flipped to face the travel direction (see orientGlyph).
const makeModeIcon = (mode?: TravelMode) => {
  const image = travelImage(mode)
  const glyph = image
    ? `<img src="${image}" alt="" style="width:28px;height:28px;object-fit:contain" />`
    : `<div style="font-size:26px;line-height:1">${travelIcon(mode)}</div>`
  return L.divIcon({
    html: `<span class="journey-glyph" style="display:inline-block;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45));transition:transform 0.08s linear">${glyph}</span>`,
    className: 'journey-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

// How the moving icon orients to the travel direction:
//   rotate — nose follows the heading (plane)
//   flip   — face left/right only, never upside down (side-view vehicles)
//   none   — front-view icons stay upright (train, tram/other)
const TURN: Record<TravelMode, 'rotate' | 'flip' | 'none'> = {
  plane: 'rotate',
  car: 'flip',
  bus: 'flip',
  ship: 'flip',
  walk: 'flip',
  train: 'none',
  other: 'none',
}

// Orient a glyph element from the on-screen travel direction (dx, dy pixels).
const orientGlyph = (
  el: HTMLElement,
  mode: TravelMode | undefined,
  dx: number,
  dy: number
) => {
  const turn = TURN[mode ?? 'other']
  if (turn === 'rotate') {
    // The plane emoji rests pointing north-east (~-45°); offset so its nose
    // follows the heading.
    el.style.transform = `rotate(${(Math.atan2(dy, dx) * 180) / Math.PI + 45}deg)`
  } else if (turn === 'flip') {
    // Vehicle emojis face left by default; mirror when travelling rightward.
    // Keep the current facing while moving near-vertically (dx ~ 0).
    if (dx > 0.5) el.style.transform = 'scaleX(-1)'
    else if (dx < -0.5) el.style.transform = 'scaleX(1)'
  } else {
    el.style.transform = ''
  }
}

const lerp = (a: L.LatLng, b: L.LatLng, t: number) =>
  L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t)

// Control point for a quadratic bezier that bows a flight path sideways.
const arcControl = (a: L.LatLng, b: L.LatLng) => {
  const dLat = b.lat - a.lat
  const dLng = b.lng - a.lng
  const curve = 0.18
  return L.latLng(
    (a.lat + b.lat) / 2 - dLng * curve,
    (a.lng + b.lng) / 2 + dLat * curve
  )
}

const bezier = (a: L.LatLng, c: L.LatLng, b: L.LatLng, t: number) => {
  const mt = 1 - t
  return L.latLng(
    mt * mt * a.lat + 2 * mt * t * c.lat + t * t * b.lat,
    mt * mt * a.lng + 2 * mt * t * c.lng + t * t * b.lng
  )
}

type JourneyStop = { lat: number; lng: number; travelMode?: TravelMode }

// Overlay control + animated playback of a user's journey through their stops.
const Journey = ({
  onActiveChange,
}: {
  onActiveChange: (userId: string | null) => void
}) => {
  const map = useMap()
  const { user } = useAuth()
  const { locationData } = useLocations()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [playing, setPlaying] = useState(false)

  // A journey needs at least two stops to draw a path.
  const journeyUsers = locationData.filter(
    (u) => (u.locations?.length ?? 0) >= 2
  )

  const resolvedId =
    selectedUserId ||
    journeyUsers.find((u) => u.userId === user?.uid)?.userId ||
    journeyUsers[0]?.userId ||
    ''

  const selected = locationData.find((u) => u.userId === resolvedId)
  // Oldest -> newest; each stop's travelMode is how the user reached it.
  const stops: JourneyStop[] = selected
    ? [...selected.locations].reverse().map((l) => ({
        lat: l.latitude,
        lng: l.longitude,
        travelMode: l.travelMode,
      }))
    : []

  const stopsRef = useRef(stops)
  stopsRef.current = stops

  useEffect(() => {
    if (!playing) return
    const path = stopsRef.current
    if (path.length < 2) return

    const legs = path.slice(0, -1).map((s, i) => {
      const from = L.latLng(s.lat, s.lng)
      const to = L.latLng(path[i + 1].lat, path[i + 1].lng)
      const mode = path[i + 1].travelMode
      const distKm = from.distanceTo(to) / 1000
      return {
        from,
        to,
        mode,
        isPlane: mode === 'plane',
        control: arcControl(from, to),
        duration: Math.min(4500, Math.max(1200, distKm * 1.2)),
      }
    })

    const trail: L.LatLng[] = [legs[0].from]
    // Colour comes from the `.journey-trail` CSS rule (theme accent) rather
    // than a fixed value — see globals.css.
    const polyline = L.polyline(trail, {
      className: 'journey-trail',
      weight: 3,
      opacity: 0.85,
    }).addTo(map)
    const marker = L.marker(legs[0].from, {
      icon: makeModeIcon(legs[0].mode),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(map)

    // Smoothly frame the current leg: zoom out for long hops, in for short
    // ones (kept modest via maxZoom so short legs aren't over-zoomed). Plane
    // legs include the arc peak so it stays in view.
    const frameLeg = (leg: (typeof legs)[number]) => {
      const pts: L.LatLngExpression[] = leg.isPlane
        ? [leg.from, leg.to, leg.control]
        : [leg.from, leg.to]
      map.flyToBounds(L.latLngBounds(pts), {
        padding: [90, 90],
        maxZoom: 5,
        duration: 0.8,
      })
    }

    // Pause the marker/trail while the map is moving. Extending the polyline
    // mid-zoom makes it render out of place, so we only advance the animation
    // once the camera has settled. Framing only triggers a move at the start of
    // a leg, so no-op moves (bounds already in view) simply never pause.
    let paused = false
    const onMoveStart = () => {
      paused = true
    }
    const onMoveEnd = () => {
      paused = false
      legStart = null // restart the leg's travel timer after the camera settles
    }
    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)

    let legIndex = 0
    let shownLeg = -1
    let legStart: number | null = null
    let raf = 0
    let cancelled = false

    const step = (now: number) => {
      if (cancelled) return
      const leg = legs[legIndex]

      // Entering a new leg: snap to its start, frame it, and let the pause
      // engage before travelling.
      if (shownLeg !== legIndex) {
        marker.setIcon(makeModeIcon(leg.mode))
        marker.setLatLng(leg.from)
        shownLeg = legIndex
        legStart = null
        frameLeg(leg)
        raf = requestAnimationFrame(step)
        return
      }

      if (paused) {
        raf = requestAnimationFrame(step)
        return
      }

      if (legStart === null) legStart = now
      const t = Math.min(1, (now - legStart) / leg.duration)
      const pos = leg.isPlane
        ? bezier(leg.from, leg.control, leg.to, t)
        : lerp(leg.from, leg.to, t)
      marker.setLatLng(pos)
      trail.push(pos)
      polyline.setLatLngs(trail)

      // Point the glyph along the travel direction (sampled on screen).
      const glyph = marker.getElement()?.querySelector('.journey-glyph')
      if (glyph instanceof HTMLElement) {
        const eps = 0.02
        const a = leg.isPlane
          ? bezier(leg.from, leg.control, leg.to, Math.max(0, t - eps))
          : lerp(leg.from, leg.to, Math.max(0, t - eps))
        const b = leg.isPlane
          ? bezier(leg.from, leg.control, leg.to, Math.min(1, t + eps))
          : lerp(leg.from, leg.to, Math.min(1, t + eps))
        const pa = map.latLngToContainerPoint(a)
        const pb = map.latLngToContainerPoint(b)
        orientGlyph(glyph, leg.mode, pb.x - pa.x, pb.y - pa.y)
      }
      if (t >= 1) {
        legIndex++
        legStart = null
        if (legIndex >= legs.length) {
          setPlaying(false)
          onActiveChange(null)
          return
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.removeLayer(polyline)
      map.removeLayer(marker)
    }
    // Only (re)run when playback is toggled; stops are captured via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  if (journeyUsers.length === 0) return null

  const userLabel = (u: (typeof journeyUsers)[number]) => {
    if (u.userId === user?.uid) return 'You'
    const first = u.userName ? u.userName.trim().split(' ')[0] : ''
    return first || 'Anonymous'
  }

  return (
    <div className="rounded-box bg-base-100/90 pointer-events-auto flex items-center gap-1.5 p-1.5 shadow-md">
      <select
        className="select select-bordered select-xs sm:select-sm max-w-24 sm:max-w-40"
        value={resolvedId}
        disabled={playing}
        onChange={(e) => setSelectedUserId(e.target.value)}
      >
        {journeyUsers.map((u) => (
          <option key={u.userId} value={u.userId}>
            {userLabel(u)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-neutral btn-xs sm:btn-sm"
        onClick={() => {
          if (playing) {
            setPlaying(false)
            onActiveChange(null)
          } else {
            setPlaying(true)
            onActiveChange(resolvedId)
          }
        }}
      >
        {playing ? '■ Stop' : '▶ Play'}
        <span className="hidden sm:inline"> journey</span>
      </button>
    </div>
  )
}

const Map = () => {
  const { isLoading } = useLocations()
  // The user whose journey is currently animating (their static pin is hidden).
  const [playingUserId, setPlayingUserId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="relative flex h-[500px] w-full items-center justify-center bg-gray-100">
        Loading map data...
      </div>
    )
  }

  return (
    <div className="relative h-[500px] w-full">
      <MapContainer
        center={[48.1486, 17.1077]} // Default center (Bratislava)
        zoom={4}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <UserMarkers hiddenUserId={playingUserId} />
        {/* Top-right control stack — flexbox spacing so the gap is consistent
            across screen sizes regardless of each control's height. */}
        <div className="pointer-events-none absolute top-2 right-2 z-[1000] flex flex-col items-end gap-2">
          <Journey onActiveChange={setPlayingUserId} />
          <LocationMarker />
        </div>
      </MapContainer>
    </div>
  )
}

export default Map
