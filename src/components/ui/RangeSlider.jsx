import { useCallback, useRef } from 'react';
import './RangeSlider.css';

/**
 * Dual-handle range slider (like a volume slider).
 *
 * Props:
 *   min       — minimum value (number)
 *   max       — maximum value (number)
 *   value     — [rangeStart, rangeEnd]
 *   onChange  — ([start, end]) => void
 *   label     — optional label
 *   disabled  — disables interaction
 *   formatLabel — optional (num) => string for tick labels
 */
export default function RangeSlider({
  min = 0,
  max = 100,
  value = [0, 100],
  onChange,
  label,
  disabled = false,
  formatLabel,
}) {
  const trackRef = useRef(null);
  const lo = Math.max(min, Math.min(value[0], value[1]));
  const hi = Math.max(lo, Math.min(value[1], max));
  const range = max - min || 1;

  const leftPct = ((lo - min) / range) * 100;
  const widthPct = ((hi - lo) / range) * 100;

  const fmt = formatLabel || ((n) => String(n));

  const handleMinChange = useCallback(
    (e) => {
      const v = Number(e.target.value);
      onChange?.([Math.min(v, hi), hi]);
    },
    [hi, onChange],
  );

  const handleMaxChange = useCallback(
    (e) => {
      const v = Number(e.target.value);
      onChange?.([lo, Math.max(v, lo)]);
    },
    [lo, onChange],
  );

  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {label && (
        <label className="text-2xs font-bold uppercase tracking-wide text-slate-500 mb-0.5">
          {label}
        </label>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap min-w-[2.5rem] text-right">
          {fmt(min)}
        </span>

        <div className="relative flex-1 h-10 flex items-center" ref={trackRef}>
          {/* Background track */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-200" />

          {/* Active range fill */}
          <div
            className="absolute h-1.5 rounded-full bg-brand-500 transition-all duration-75"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />

          {/* Value labels above thumbs */}
          {lo !== min || hi !== max ? (
            <>
              <div
                className="absolute -top-0.5 text-2xs font-bold text-brand-700 tabular-nums select-none transition-all duration-75"
                style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
              >
                {fmt(lo)}
              </div>
              <div
                className="absolute -top-0.5 text-2xs font-bold text-brand-700 tabular-nums select-none transition-all duration-75"
                style={{ left: `${leftPct + widthPct}%`, transform: 'translateX(-50%)' }}
              >
                {hi !== lo ? fmt(hi) : null}
              </div>
            </>
          ) : null}

          {/* Min slider */}
          <input
            type="range"
            min={min}
            max={max}
            value={lo}
            onChange={handleMinChange}
            disabled={disabled}
            className="range-slider-input absolute inset-x-0 w-full h-1.5 z-[3]"
          />

          {/* Max slider */}
          <input
            type="range"
            min={min}
            max={max}
            value={hi}
            onChange={handleMaxChange}
            disabled={disabled}
            className="range-slider-input absolute inset-x-0 w-full h-1.5 z-[4]"
          />
        </div>

        <span className="text-xs text-slate-500 font-medium tabular-nums whitespace-nowrap min-w-[2.5rem]">
          {fmt(max)}
        </span>
      </div>
    </div>
  );
}
