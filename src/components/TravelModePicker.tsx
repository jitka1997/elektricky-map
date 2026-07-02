'use client'

import React from 'react'

import TravelModeIcon from '@/components/TravelModeIcon'
import { TRAVEL_MODES, TravelMode } from '@/lib/travel'

interface Props {
  value: TravelMode
  onChange: (mode: TravelMode) => void
  label?: string
}

const TravelModePicker: React.FC<Props> = ({
  value,
  onChange,
  label = 'How did you travel?',
}) => {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-text text-sm">{label}</span>
      <div className="flex flex-wrap gap-2">
        {TRAVEL_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            aria-pressed={value === mode.value}
            title={mode.label}
            className={`btn btn-sm ${
              value === mode.value ? 'btn-neutral' : 'btn-outline'
            }`}
          >
            <TravelModeIcon mode={mode.value} />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TravelModePicker
