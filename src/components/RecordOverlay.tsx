'use client'

import L from 'leaflet'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  Polyline,
  Rectangle,
  Tooltip,
  useMap,
} from 'react-leaflet'

import { useAuth } from '@/lib/AuthContext'
import { useLocations } from '@/lib/LocationContext'
import { describeRecord, recordShape } from '@/lib/records'
import { periodStart, personStats, toPeople } from '@/lib/stats'
import { readStatsView, statsQuery } from '@/lib/statsParams'

// Map tiles look the same in both themes, so the drawing uses one strong color.
const COLOR = '#c2410c'

// Draws a stats record on the map (e.g. the route of the longest time away)
// from the URL — `/?record=longest-away&user=…&period=all` — with a card
// explaining it and a link back to the stats view it came from.
const RecordOverlay = () => {
  const map = useMap()
  const { user } = useAuth()
  const { locationData } = useLocations()
  const searchParams = useSearchParams()
  const view = readStatsView(searchParams)
  const [now] = useState(() => Date.now())

  // Plain values for the memo below, so it only reruns when these change.
  const { user: userParam, period, record } = view
  const myId = user?.uid

  const result = useMemo(() => {
    const person = toPeople(locationData, now).find(
      (p) => p.id === (userParam ?? myId)
    )
    if (!person || !record) return null
    const stats = personStats(
      person.entries,
      person.stays,
      periodStart(period, now),
      now
    )
    const isMe = person.id === myId
    const periodWord = period === 'year' ? 'this year' : 'overall'
    const text = describeRecord(
      record,
      stats,
      periodWord,
      isMe ? null : person.name
    )
    const shape = recordShape(record, stats, now)
    return text && shape ? { text, shape, isMe, name: person.name } : null
  }, [locationData, now, userParam, period, record, myId])

  // Fit the map around the whole record, leaving room for the card on top.
  useEffect(() => {
    if (!result) return
    const { shape } = result
    const bounds = L.latLngBounds(
      shape.stops.map((s) => [s.place.lat, s.place.lng])
    )
    if (shape.circle)
      bounds.extend(
        L.latLng(shape.circle.center.lat, shape.circle.center.lng).toBounds(
          shape.circle.radiusKm * 2000
        )
      )
    if (shape.box)
      bounds.extend([
        [shape.box.south, shape.box.west],
        [shape.box.north, shape.box.east],
      ])
    map.fitBounds(bounds, {
      paddingTopLeft: [40, 140],
      paddingBottomRight: [40, 40],
      maxZoom: 8,
    })
  }, [map, result])

  // Only label the cities whose labels fit without covering each other; the
  // rest show their label when you hover or tap the dot. Recomputed on zoom.
  const [labelled, setLabelled] = useState<Set<number>>(new Set())
  useEffect(() => {
    if (!result) return
    const { stops } = result.shape
    const priority = { main: 0, home: 1, stop: 2 }
    const order = stops
      .map((_, i) => i)
      .sort((a, b) => priority[stops[a].kind] - priority[stops[b].kind])
    const placeLabels = () => {
      const taken: { x1: number; y1: number; x2: number; y2: number }[] = []
      const shown = new Set<number>()
      for (const i of order) {
        const p = map.latLngToContainerPoint([
          stops[i].place.lat,
          stops[i].place.lng,
        ])
        // Roughly the size of a Leaflet tooltip with this text, above the dot.
        const width = stops[i].label.length * 6.5 + 20
        const box = {
          x1: p.x - width / 2,
          x2: p.x + width / 2,
          y1: p.y - 42,
          y2: p.y - 10,
        }
        const overlaps = taken.some(
          (t) =>
            t.x1 < box.x2 && box.x1 < t.x2 && t.y1 < box.y2 && box.y1 < t.y2
        )
        if (overlaps) continue
        taken.push(box)
        shown.add(i)
      }
      setLabelled(shown)
    }
    const frame = requestAnimationFrame(placeLabels)
    map.on('zoomend moveend', placeLabels)
    return () => {
      cancelAnimationFrame(frame)
      map.off('zoomend moveend', placeLabels)
    }
  }, [map, result])
  const hiddenLabels = result ? result.shape.stops.length - labelled.size : 0

  // Back to the same stats view, scrolled to the record you came from.
  const backHref = `/stats${statsQuery(
    new URLSearchParams(searchParams.toString()),
    { record: null }
  )}${record ? `#record-${record}` : ''}`
  const year = new Date(now).getFullYear()

  return (
    <>
      {result?.shape.circle && (
        <Circle
          center={[
            result.shape.circle.center.lat,
            result.shape.circle.center.lng,
          ]}
          radius={result.shape.circle.radiusKm * 1000}
          pathOptions={{
            color: COLOR,
            weight: 1.5,
            dashArray: '6 6',
            fillOpacity: 0.06,
          }}
        />
      )}
      {result?.shape.box && (
        <Rectangle
          bounds={[
            [result.shape.box.south, result.shape.box.west],
            [result.shape.box.north, result.shape.box.east],
          ]}
          pathOptions={{
            color: COLOR,
            weight: 1.5,
            dashArray: '6 6',
            fillOpacity: 0.06,
          }}
        />
      )}
      {result?.shape.path && (
        <Polyline
          positions={result.shape.path.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: COLOR, weight: 4, opacity: 0.85 }}
        >
          {result.shape.pathLabel && (
            <Tooltip permanent direction="center">
              {result.shape.pathLabel}
            </Tooltip>
          )}
        </Polyline>
      )}
      {result?.shape.stops.map((stop, i) => (
        <CircleMarker
          key={`${stop.place.key}-${i}`}
          center={[stop.place.lat, stop.place.lng]}
          radius={stop.kind === 'main' ? 8 : 6}
          pathOptions={{
            color: COLOR,
            weight: 2,
            fillColor: stop.kind === 'home' ? '#ffffff' : COLOR,
            fillOpacity: 1,
          }}
        >
          {/* Remounted when it changes: Leaflet can't switch a tooltip
              between permanent and on-hover in place. */}
          <Tooltip
            key={labelled.has(i) ? 'shown' : 'hover'}
            permanent={labelled.has(i)}
            direction="top"
            offset={[0, -8]}
          >
            {stop.label}
          </Tooltip>
        </CircleMarker>
      ))}

      <div className="pointer-events-none absolute top-2 right-2 left-12 z-[1000] flex">
        <div className="rounded-box bg-base-100/95 text-base-content pointer-events-auto flex max-w-md flex-col gap-1 p-3 shadow-md">
          {result ? (
            <>
              <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
                {result.isMe ? 'You' : result.name} ·{' '}
                {view.period === 'year' ? year : 'All time'}
              </span>
              <span className="font-bold">
                {result.text.label}: {result.text.value}
              </span>
              <span className="text-sm opacity-80">{result.text.detail}</span>
              {hiddenLabels > 0 && (
                <span className="text-xs opacity-70">
                  Tap a dot or zoom in to see the other{' '}
                  {hiddenLabels === 1 ? 'city' : `${hiddenLabels} cities`}.
                </span>
              )}
            </>
          ) : (
            <span className="text-sm">There&apos;s nothing to show here.</span>
          )}
          <div className="mt-1 flex gap-2">
            {/* `!` because Leaflet colors every link inside the map blue. */}
            <Link
              href={backHref}
              className="btn btn-neutral btn-xs text-neutral-content!"
            >
              ← Back to stats
            </Link>
            <Link href="/" className="btn btn-ghost btn-xs text-base-content!">
              Close
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default RecordOverlay
