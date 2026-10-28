'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import CitySearch from '@/components/CitySearch'
import Container from '@/components/Container'
import TravelModeIcon from '@/components/TravelModeIcon'
import TravelModePicker from '@/components/TravelModePicker'
import UserIcon from '@/components/UserIcon'
import { useAuth } from '@/lib/AuthContext'
import { formatDate, formatTime, toDate, toDateTimeLocal } from '@/lib/dates'
import {
  deleteLocationFromFirestore,
  LocationEntry,
  updateLocationInFirestore,
  writeLocationToFirestore,
} from '@/lib/firebase'
import { useLocations } from '@/lib/LocationContext'
import { isFuture, neighborsAt, sameCity } from '@/lib/locations'
import { shortName } from '@/lib/names'
import { placeFields } from '@/lib/places'
import { notifyNewEntry } from '@/lib/push'
import { DEFAULT_TRAVEL_MODE, TravelMode } from '@/lib/travel'
import { CityOption, kmBetween, NEARBY_RADIUS_KM } from '@/lib/utils'

const HistoryView = () => {
  const { user, loading: authLoading } = useAuth()
  const { locationData, isLoading: locationsLoading, now } = useLocations()
  const router = useRouter()

  // User cards that are expanded live in the URL (?open=id1,id2), so a
  // refresh, a link or coming back from another page keeps them open.
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const expanded = new Set(searchParams.get('open')?.split(',').filter(Boolean))
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
  const [editMode, setEditMode] = useState<TravelMode>(DEFAULT_TRAVEL_MODE)
  const [editDateTime, setEditDateTime] = useState('')
  // Whether the entry's exact spot stays (it can be removed when editing).
  const [editKeepSpot, setEditKeepSpot] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Manual add-entry modal: whether it's open, the picked city, the chosen
  // date/time (datetime-local string), and whether the save is in flight.
  const [addOpen, setAddOpen] = useState(false)
  const [addCity, setAddCity] = useState<CityOption | null>(null)
  const [addDateTime, setAddDateTime] = useState('')
  const [addMode, setAddMode] = useState<TravelMode>(DEFAULT_TRAVEL_MODE)
  const [isAdding, setIsAdding] = useState(false)

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
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const params = new URLSearchParams(searchParams.toString())
    if (next.size) params.set('open', [...next].join(','))
    else params.delete('open')
    const query = params.toString()
    // Only the URL changes, so the browser's history is enough (Next.js
    // follows it); the router can wait on the server first. Replace, not
    // push: opening a card isn't a step you'd go Back through.
    window.history.replaceState(
      null,
      '',
      query ? `${pathname}?${query}` : pathname
    )
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteLocationFromFirestore({
        userId: user.uid,
        locationId: pendingDelete,
      })
      setPendingDelete(null)
    } catch {
      window.alert('Failed to delete location. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const openAdd = () => {
    setAddCity(null)
    setAddDateTime(toDateTimeLocal(new Date()))
    setAddMode(DEFAULT_TRAVEL_MODE)
    setAddOpen(true)
  }

  const closeAdd = () => {
    setAddOpen(false)
    setAddCity(null)
    setAddDateTime('')
  }

  const saveAdd = async () => {
    if (!addCity || !addDateTime || addAdjacentSame) return
    const when = new Date(addDateTime)
    if (isNaN(when.getTime())) return

    setIsAdding(true)
    const base = {
      userId: user.uid,
      city: addCity.city,
      country: addCity.country,
      latitude: addCity.latitude,
      longitude: addCity.longitude,
      travelMode: addMode,
      ...placeFields(addCity),
    }
    try {
      // Firestore converts a JS Date to a Timestamp on write.
      const id = await writeLocationToFirestore({
        userId: user.uid,
        locationData: { ...base, createdAt: when },
      })
      // Električky in that city hear about it if it's for now or planned.
      notifyNewEntry(id)
      closeAdd()
    } catch {
      window.alert('Failed to add location. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const openEdit = (location: LocationEntry) => {
    setEditingLocation(location)
    setEditCity({
      city: location.city,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      placeId: location.placeId,
      countryCode: location.countryCode,
    })
    setEditMode(location.travelMode ?? DEFAULT_TRAVEL_MODE)
    setEditDateTime(toDateTimeLocal(toDate(location.createdAt)))
    setEditKeepSpot(true)
  }

  const closeEdit = () => {
    setEditingLocation(null)
    setEditCity(null)
    setEditDateTime('')
  }

  const myLocations =
    locationData.find((u) => u.userId === user.uid)?.locations ?? []

  // Edit: the time only counts as changed if the picker value differs from the
  // original (minute precision), so an untouched time keeps its exact seconds.
  const editTimeChanged = !!(
    editingLocation &&
    editDateTime &&
    editDateTime !== toDateTimeLocal(toDate(editingLocation.createdAt))
  )
  const editTime = editTimeChanged
    ? new Date(editDateTime).getTime()
    : editingLocation
      ? toDate(editingLocation.createdAt).getTime()
      : NaN

  // The exact spot stays unless it's removed, or the city changes to one far
  // from it. (While a new city is being typed, nothing is decided yet.)
  const editSpot = editingLocation?.spot
  const editSpotFits =
    !editSpot ||
    !editCity ||
    kmBetween(
      editSpot.latitude,
      editSpot.longitude,
      editCity.latitude,
      editCity.longitude
    ) <= NEARBY_RADIUS_KM
  const editSpotRemoved = !!editSpot && !(editKeepSpot && editSpotFits)

  // Whether the picked city, travel mode, time or exact spot differs from the
  // original.
  const editChanged = !!(
    editCity &&
    editingLocation &&
    (editCity.city !== editingLocation.city ||
      editCity.country !== editingLocation.country ||
      editMode !== (editingLocation.travelMode ?? DEFAULT_TRAVEL_MODE) ||
      editTimeChanged ||
      editSpotRemoved)
  )

  // Block saving if the picked city matches the entry right before or after
  // the (possibly new) time, which would create a consecutive duplicate.
  const matchesAdjacent = (() => {
    if (!editingLocation || isNaN(editTime)) return false
    const { newer, older } = neighborsAt(
      myLocations,
      editTime,
      editingLocation.id
    )
    return sameCity(editCity, newer) || sameCity(editCity, older)
  })()

  // Same guard for the add modal.
  const addAdjacentSame = (() => {
    const t = addDateTime ? new Date(addDateTime).getTime() : NaN
    if (!addCity || isNaN(t)) return false
    const { newer, older } = neighborsAt(myLocations, t)
    return sameCity(addCity, newer) || sameCity(addCity, older)
  })()

  const saveEdit = async () => {
    if (!editingLocation?.id || !editCity || !editChanged || matchesAdjacent)
      return
    setIsSaving(true)
    const changes = {
      city: editCity.city,
      country: editCity.country,
      latitude: editCity.latitude,
      longitude: editCity.longitude,
      travelMode: editMode,
      ...placeFields(editCity),
      ...(editTimeChanged ? { createdAt: new Date(editDateTime) } : {}),
      ...(editSpotRemoved && { spot: null }),
    }
    try {
      await updateLocationInFirestore({
        userId: user.uid,
        locationId: editingLocation.id,
        locationData: changes,
      })
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
          const { userId, userName, customName, photoURL, locations } = userData
          const cardId = userId || String(userIndex)
          const isCollapsed = !expanded.has(cardId)
          const isOwn = userId === user.uid

          const firstName = shortName(userName, customName)
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
                <div className="bg-base-300 flex w-full items-center gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(cardId)}
                    aria-expanded={!isCollapsed}
                    className="flex flex-1 items-center gap-3 text-left transition-opacity hover:opacity-80"
                  >
                    <UserIcon photoURL={photoURL} />
                    <div className="flex-1">
                      <h2 className="card-title">{title}</h2>
                      <p className="text-sm opacity-70">
                        {locations.length} location
                        {locations.length !== 1 ? 's' : ''} logged
                      </p>
                    </div>
                  </button>
                  {isOwn && (
                    <button
                      type="button"
                      onClick={openAdd}
                      aria-label="Add a location entry"
                      title="Add entry"
                      className="btn btn-outline btn-sm btn-circle text-lg"
                    >
                      +
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(cardId)}
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                    className="ml-3 transition-opacity hover:opacity-80"
                  >
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
                </div>

                {/* Location Listings */}
                {!isCollapsed && (
                  <div className="divide-base-300 max-h-[55vh] divide-y overflow-y-auto">
                    {locations.map((location, locationIndex) => {
                      const formattedDate = formatDate(location.createdAt)
                      const formattedTime = formatTime(location.createdAt)

                      return (
                        <div key={location.id || locationIndex} className="p-4">
                          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                            <div>
                              <h3 className="text-lg font-medium">
                                <TravelModeIcon
                                  mode={location.travelMode}
                                  className="mr-1"
                                />
                                {location.city}, {location.country}
                              </h3>
                              <div className="flex items-center text-sm opacity-70">
                                {formattedDate} • {formattedTime}
                                {isFuture(location, now) && (
                                  <span className="badge badge-outline badge-sm ml-2">
                                    upcoming
                                  </span>
                                )}
                                {location.spot && (
                                  <span className="badge badge-outline badge-sm ml-2">
                                    exact spot
                                  </span>
                                )}
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

      {/* Edit entry modal */}
      <div className={`modal ${editingLocation ? 'modal-open' : ''}`}>
        <div className="modal-box overflow-visible">
          <h3 className="mb-4 text-lg font-bold">Edit entry</h3>
          {editingLocation && (
            <div className="flex flex-col gap-3">
              <CitySearch
                key={editingLocation.id}
                value={editCity}
                onSelect={setEditCity}
              />
              <label className="form-control w-full">
                <span className="label-text mb-1 text-sm">Date &amp; time</span>
                <input
                  type="datetime-local"
                  value={editDateTime}
                  onChange={(e) => setEditDateTime(e.target.value)}
                  className="input input-bordered text-base-content w-full"
                />
              </label>
              <TravelModePicker value={editMode} onChange={setEditMode} />
              {editingLocation.spot && (
                <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={!editSpotRemoved}
                    disabled={!editSpotFits}
                    onChange={(e) => setEditKeepSpot(e.target.checked)}
                  />
                  <span>
                    Show my exact spot on the map
                    {!editSpotFits && (
                      <span className="opacity-60">
                        {' '}
                        · removed, it&apos;s far from this city
                      </span>
                    )}
                  </span>
                </label>
              )}
            </div>
          )}
          {matchesAdjacent && (
            <div className="text-base-content/70 mt-2 text-sm">
              Same as an adjacent entry — pick a different city or time.
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

      {/* Manual add-entry modal */}
      <div className={`modal ${addOpen ? 'modal-open' : ''}`}>
        <div className="modal-box overflow-visible">
          <h3 className="mb-4 text-lg font-bold">Add location</h3>
          {addOpen && (
            <div className="flex flex-col gap-3">
              <CitySearch value={addCity} onSelect={setAddCity} />
              <label className="form-control w-full">
                <span className="label-text mb-1 text-sm">Date &amp; time</span>
                <input
                  type="datetime-local"
                  value={addDateTime}
                  onChange={(e) => setAddDateTime(e.target.value)}
                  className="input input-bordered text-base-content w-full"
                />
              </label>
              <TravelModePicker value={addMode} onChange={setAddMode} />
            </div>
          )}
          {addAdjacentSame && (
            <div className="text-base-content/70 mt-2 text-sm">
              Same as an adjacent entry — pick a different city or time.
            </div>
          )}
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeAdd}
              disabled={isAdding}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveAdd}
              disabled={isAdding || !addCity || !addDateTime || addAdjacentSame}
            >
              {isAdding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close"
          onClick={() => !isAdding && closeAdd()}
        />
      </div>
    </Container>
  )
}

// Reading the URL needs a Suspense boundary for the production build.
const HistoryPage = () => (
  <Suspense
    fallback={
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    }
  >
    <HistoryView />
  </Suspense>
)

export default HistoryPage
