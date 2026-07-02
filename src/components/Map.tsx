'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useReducer, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'

import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'

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
    <div className="absolute top-2 right-2 z-[1000]">
      <button
        onClick={flyToMyLocation}
        className="btn btn-primary btn-xs rounded-full"
      >
        Fly to my location
      </button>
    </div>
  )
}

type BaseMarker = {
  userId: string
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

const UserMarkers = () => {
  const map = useMap()
  const { locationData } = useLocations()
  // Re-render on zoom so the pixel-based spread stays correct at every zoom.
  const [, forceRerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    map.on('zoomend', forceRerender)
    return () => {
      map.off('zoomend', forceRerender)
    }
  }, [map])

  // One marker per user: their most recent location.
  const base: BaseMarker[] = []
  for (const u of locationData) {
    const loc = u.locations?.[0]
    if (!loc) continue
    base.push({
      userId: u.userId,
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
              <div>
                {m.city}, {m.country}
              </div>
              <div className="text-xs text-gray-500">
                Last seen: {m.createdAt.toLocaleString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

const Map = () => {
  const { isLoading } = useLocations()

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
        <LocationMarker />
        <UserMarkers />
      </MapContainer>
    </div>
  )
}

export default Map
