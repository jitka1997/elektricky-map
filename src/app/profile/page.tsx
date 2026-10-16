'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import Container from '@/components/Container'
import NotificationSettings from '@/components/NotificationSettings'
import { useAuth } from '@/lib/AuthContext'
import { toDateTimeLocal } from '@/lib/dates'
import { saveJsonFile } from '@/lib/download'
import { exportAllData, updateUserProfile } from '@/lib/firebase'
import { resizeImageToDataUrl } from '@/lib/image'
import { useLocations } from '@/lib/LocationContext'
import { shortName } from '@/lib/names'

const MAX_NAME_LENGTH = 30

const ProfilePage = () => {
  const { user, loading } = useAuth()
  const { locationData, isLoading: locationsLoading } = useLocations()
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  // Form edits; `undefined` means untouched, so the saved value is shown.
  const [nameEdit, setNameEdit] = useState<string | undefined>(undefined)
  const [photoEdit, setPhotoEdit] = useState<string | null | undefined>(
    undefined
  )
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  if (loading || locationsLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const me = locationData.find((u) => u.userId === user.uid)
  const savedName = me?.customName ?? null
  const savedPhoto = me?.customPhoto ?? null

  const name = nameEdit ?? savedName ?? ''
  const photo = photoEdit === undefined ? savedPhoto : photoEdit
  const newName = name.trim() || null
  const dirty = newName !== savedName || photo !== savedPhoto

  // What others will see: the chosen photo, else the Google one.
  const previewPhoto = photo ?? user.photoURL
  const googleFirstName = shortName(user.displayName) || 'Your Google name'

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setProfileError(null)
    setSaved(false)
    try {
      setPhotoEdit(await resizeImageToDataUrl(file))
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Could not use that image'
      )
    }
  }

  const saveProfile = async () => {
    setIsSaving(true)
    setProfileError(null)
    try {
      await updateUserProfile({
        userId: user.uid,
        customName: newName,
        customPhoto: photo,
      })
      setNameEdit(undefined)
      setPhotoEdit(undefined)
      setSaved(true)
    } catch {
      setProfileError('Failed to save your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const downloadBackup = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const data = await exportAllData()
      const stamp = toDateTimeLocal(new Date())
        .replace('T', '_')
        .replace(':', '-')
      await saveJsonFile(data, `elektricky-backup-${stamp}.json`)
    } catch (error) {
      // Closing the iOS share sheet isn't an error.
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setExportError('Failed to create the backup. Please try again.')
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Container className="text-base-content py-8">
      <h1 className="mb-8 text-3xl font-bold">Profile</h1>

      <div className="space-y-6">
        <section className="card bg-base-200 shadow-md">
          <div className="card-body gap-4">
            <h2 className="card-title">How others see you</h2>

            <div className="flex items-center gap-4">
              <div className="border-base-300 bg-base-300 h-20 w-20 shrink-0 overflow-hidden rounded-full border">
                {previewPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewPhoto}
                    alt="Your profile photo"
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="btn btn-outline btn-sm"
                >
                  Change photo
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoEdit(null)
                      setSaved(false)
                    }}
                    className="link text-base-content text-sm"
                  >
                    Use my Google photo
                  </button>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    choosePhoto(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1 text-sm">Display name</span>
              <input
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                placeholder={googleFirstName}
                onChange={(e) => {
                  setNameEdit(e.target.value)
                  setSaved(false)
                }}
                className="input input-bordered text-base-content placeholder:text-base-content/50 w-full"
              />
              <span className="mt-1 text-xs opacity-70">
                Leave empty to use your Google first name.
              </span>
            </label>

            {profileError && (
              <div className="text-sm text-red-500">{profileError}</div>
            )}

            <div className="card-actions items-center justify-end">
              {saved && !dirty && (
                <span className="text-sm opacity-70">Saved ✓</span>
              )}
              <button
                type="button"
                onClick={saveProfile}
                disabled={!dirty || isSaving}
                className="btn btn-neutral"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </section>

        <NotificationSettings />

        <section className="card bg-base-200 shadow-md">
          <div className="card-body gap-3">
            <h2 className="card-title">Backup</h2>
            <p className="text-sm opacity-80">
              Download a copy of everyone&apos;s locations and profiles as a
              file. A backup is also made automatically every night.
            </p>
            {exportError && (
              <div className="text-sm text-red-500">{exportError}</div>
            )}
            <div className="card-actions justify-end">
              <button
                type="button"
                onClick={downloadBackup}
                disabled={isExporting}
                className="btn btn-outline"
              >
                {isExporting ? 'Preparing...' : 'Download backup'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Container>
  )
}

export default ProfilePage
