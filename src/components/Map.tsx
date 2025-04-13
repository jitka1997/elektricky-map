'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Define custom icon
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Define the type for our location
interface Location {
  latitude: number
  longitude: number
}

// This component has access to the map context and can place markers
const LocationMarker = () => {
  const [position, setPosition] = useState<Location | null>(null)
  const [error, setError] = useState<string | null>(null)
  const map = useMap()

  const findLocation = () => {
    setError(null)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setPosition({ latitude, longitude })
          map.flyTo([latitude, longitude], 13)
        },
        (error) => {
          setError(`Location error: ${error.message}`)
        }
      )
    } else {
      setError('Geolocation is not supported by your browser')
    }
  }

  return (
    <>
      <div className="absolute right-4 bottom-4 z-[1000]">
        <button
          onClick={findLocation}
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
        >
          Find My Location
        </button>
        {error && <div className="mt-2 text-red-500">{error}</div>}
      </div>

      {position && (
        <Marker
          position={[position.latitude, position.longitude]}
          icon={customIcon}
        >
          <Popup>You are here</Popup>
        </Marker>
      )}
    </>
  )
}

const Map = () => {
  return (
    <div className="relative h-[500px] w-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker />
      </MapContainer>
    </div>
  )
}

export default Map
