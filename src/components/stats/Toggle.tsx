type Props<T extends string> = {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}

// A small segmented switch, e.g. "By time | By visits".
const Toggle = <T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) => (
  <div className="join" role="group" aria-label={label}>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        aria-pressed={value === v}
        onClick={() => onChange(v)}
        className={`btn btn-xs join-item ${value === v ? 'btn-neutral' : 'btn-ghost border-base-300'}`}
      >
        {text}
      </button>
    ))}
  </div>
)

export default Toggle
