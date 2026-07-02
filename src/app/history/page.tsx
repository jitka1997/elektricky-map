'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import CitySearch from '@/components/CitySearch'
import Container from '@/components/Container'
import UserIcon from '@/components/UserIcon'
import { useAuth } from '@/lib/AuthContext'
import {
  deleteLocationFromFirestore,
  LocationEntry,
  updateLocationInFirestore,
} from '@/lib/firebase'
import { useLocations } from '@/lib/LocationContext'
import { CityOption } from '@/lib/utils'

const HistoryPage = () => {
  const { user, loading: authLoading } = useAuth()
  const {
    locationData,
    isLoading: locationsLoading,
    removeLocation,
    updateLocation,
  } = useLocations()
  const router = useRouter()

  // User card ids that are currently expanded (empty = all collapsed).
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Location id awaiting delete confirmation (drives the modal), and whether
  // the delete request is in flight.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // Location being edited (drives the edit modal), the newly picked city, and
  // whether the save request is in flight.
  const [editingLocation, setEditingLocation] = useState<LocationEntry | null>(
    null
  )
  const [editCity, setEditCity] = useState<CityOption | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  const loading = authLoading || locationsLoading

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteLocationFromFirestore({
        userId: user.uid,
        locationId: pendingDelete,
      })
      removeLocation(user.uid, pendingDelete)
      setPendingDelete(null)
    } catch {
      window.alert('Failed to delete location. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openEdit = (location: LocationEntry) => {
    setEditingLocation(location)
    setEditCity({
      city: location.city,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
    })
  }

  const closeEdit = () => {
    setEditingLocation(null)
    setEditCity(null)
  }

  // Whether the picked city differs from the location being edited.
  const editChanged = !!(
    editCity &&
    editingLocation &&
    (editCity.city !== editingLocation.city ||
      editCity.country !== editingLocation.country)
  )

  // The locations adjacent to the one being edited. Locations are newest-first,
  // so the older (chronologically previous) neighbour is the next index and the
  // newer one is the previous index.
  const myLocations =
    locationData.find((u) => u.userId === user.uid)?.locations ?? []
  const editingIndex = editingLocation
    ? myLocations.findIndex((l) => l.id === editingLocation.id)
    : -1
  const olderLocation =
    editingIndex >= 0 ? myLocations[editingIndex + 1] : undefined
  const newerLocation =
    editingIndex >= 1 ? myLocations[editingIndex - 1] : undefined

  const sameCity = (loc?: LocationEntry) =>
    !!(
      editCity &&
      loc &&
      editCity.city.trim().toLowerCase() === loc.city.trim().toLowerCase() &&
      editCity.country.trim().toLowerCase() === loc.country.trim().toLowerCase()
    )

  // Block saving if the picked city matches either adjacent location, which
  // would create a redundant consecutive duplicate.
  const matchesAdjacent = sameCity(olderLocation) || sameCity(newerLocation)

  const saveEdit = async () => {
    if (!editingLocation?.id || !editCity || !editChanged || matchesAdjacent)
      return
    setIsSaving(true)
    const changes = {
      city: editCity.city,
      country: editCity.country,
      latitude: editCity.latitude,
      longitude: editCity.longitude,
    }
    try {
      await updateLocationInFirestore({
        userId: user.uid,
        locationId: editingLocation.id,
        locationData: changes,
      })
      updateLocation(user.uid, editingLocation.id, changes)
      closeEdit()
    } catch {
      window.alert('Failed to update location. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filter out users with no location data
  const usersWithLocations = locationData.filter(
    (userData) => userData.locations && userData.locations.length > 0
  )

  if (usersWithLocations.length === 0) {
    return (
      <Container className="text-base-content py-8">
        <div className="card bg-base-200 shadow-md">
          <div className="card-body text-center">
            <h2 className="card-title justify-center">No Locations Found</h2>
            <p>No location data available.</p>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container className="text-base-content py-8">
      <h1 className="mb-8 text-3xl font-bold">Location History</h1>

      <div className="space-y-10">
        {usersWithLocations.map((userData, userIndex) => {
          // User information
          const { userId, userName, photoURL, locations } = userData
          const cardId = userId || String(userIndex)
          const isCollapsed = !expanded.has(cardId)
          const isOwn = userId === user.uid

          const firstName = userName ? userName.trim().split(' ')[0] : ''
          const title = isOwn
            ? firstName
              ? `${firstName} (You)`
              : 'You'
            : firstName || 'Anonymous'

          return (
            <div
              key={cardId}
              className="card bg-base-200 overflow-hidden shadow-md"
            >
              <div className="card-body p-0">
                {/* User Header — click to collapse/expand */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(cardId)}
                  aria-expanded={!isCollapsed}
                  className="bg-base-300 hover:bg-base-300/70 flex w-full items-center gap-3 p-4 text-left transition-colors"
                >
                  <UserIcon photoURL={photoURL} />
                  <div className="flex-1">
                    <h2 className="card-title">{title}</h2>
                    <p className="text-sm opacity-70">
                      {locations.length} location
                      {locations.length !== 1 ? 's' : ''} logged
                    </p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`h-5 w-5 transition-transform ${
                      isCollapsed ? '' : 'rotate-180'
                    }`}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </button>

                {/* Location Listings */}
                {!isCollapsed && (
                  <div className="divide-base-300 max-h-[55vh] divide-y overflow-y-auto">
                    {locations.map((location, locationIndex) => {
                      const date = new Date(location.createdAt.toLocaleString())
                      const formattedDate = date.toLocaleDateString()
                      const formattedTime = date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })

                      return (
                        <div key={location.id || locationIndex} className="p-4">
                          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                              <h3 className="text-lg font-medium">
                                {location.city}, {location.country}
                              </h3>
                              <div className="flex items-center text-sm opacity-70">
                                {formattedDate} • {formattedTime}
                              </div>
                            </div>
                            {isOwn && location.id && (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEdit(location)}
                                  className="btn btn-outline btn-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete(location.id!)}
                                  className="btn btn-error btn-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation modal */}
      <div className={`modal ${pendingDelete ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="text-lg font-bold">Delete location?</h3>
          <p className="py-4">This action cannot be undone.</p>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close"
          onClick={() => !isDeleting && setPendingDelete(null)}
        />
      </div>

      {/* Edit location modal */}
      <div className={`modal ${editingLocation ? 'modal-open' : ''}`}>
        <div className="modal-box overflow-visible">
          <h3 className="mb-4 text-lg font-bold">Edit location</h3>
          {editingLocation && (
            <CitySearch
              key={editingLocation.id}
              value={editCity}
              onSelect={setEditCity}
            />
          )}
          {matchesAdjacent && (
            <div className="text-base-content/70 mt-2 text-sm">
              Same as an adjacent location — pick a different city.
            </div>
          )}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeEdit}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveEdit}
              disabled={isSaving || !editChanged || matchesAdjacent}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close"
          onClick={() => !isSaving && closeEdit()}
        />
      </div>
    </Container>
  )
}

export default HistoryPage
