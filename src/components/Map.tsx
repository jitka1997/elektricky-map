'use client'

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'

import { LocationData } from '@/app/page'

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

  // Create an HTML element for the custom icon
  const iconHtml = document.createElement('div')
  iconHtml.style.backgroundImage = `url(${photoURL})`
  iconHtml.style.backgroundSize = 'cover'
  iconHtml.style.width = '40px'
  iconHtml.style.height = '40px'
  iconHtml.style.borderRadius = '50%'
  iconHtml.style.border = '2px solid gray'
  iconHtml.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)'

  // Create a divIcon instead of a standard icon
  return L.divIcon({
    html: iconHtml,
    className: 'user-photo-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  })
}

const LocationMarker = () => {
  const [error, setError] = useState<string | null>(null)
  const map = useMap()

  const findLocation = () => {
    setError(null)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
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
      <div className="absolute top-2 right-2 z-[1000]">
        <button
          onClick={findLocation}
          className="btn btn-primary btn-xs rounded-full"
        >
          My Location
        </button>
        {error && <div className="mt-2 text-red-500">{error}</div>}
      </div>
    </>
  )
}

interface MapProps {
  locationData?: LocationData[]
}

const Map = ({ locationData = [] }: MapProps) => {
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
        {/* Add markers for each user's last position */}
        {locationData.map((userData) => {
          // Check if userData.locations is empty
          if (!userData.locations || userData.locations.length === 0) {
            return null
          }
          const lastLocation = userData.locations[0]
          return (
            <Marker
              key={userData.userId}
              position={[lastLocation.latitude, lastLocation.longitude]}
              icon={createUserIcon(userData.photoURL)}
            >
              <Popup>
                <div className="flex flex-col items-center">
                  <div>
                    {lastLocation.city}, {lastLocation.country}
                  </div>
                  <div className="text-xs text-gray-500">
                    Last seen: {lastLocation.createdAt.toLocaleString()}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}

export default Map
