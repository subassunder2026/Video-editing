import React, { useRef, useState } from 'react';

interface PrecisionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  decimals?: number;
  trackGradient?: string;
  compact?: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
}

export const PrecisionSlider: React.FC<PrecisionSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue = 0,
  unit = '',
  decimals = 2,
  trackGradient,
  compact = false,
  onChange,
  onCommit,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const range = max - min;
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const defPct = Math.max(0, Math.min(100, ((defaultValue - min) / range) * 100));
  const isModified = Math.abs(value - defaultValue) > step * 0.4;

  const updateFromClientX = (clientX: number, fine: boolean, startX?: number, startVal?: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let next: number;
    if (fine && startX !== undefined && startVal !== undefined) {
      const dx = (clientX - startX) / rect.width;
      next = startVal + dx * range * 0.2;
    } else {
      const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      next = min + norm * range;
    }
    const snapped = Math.round(next / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(snapped.toFixed(4))));
    onChange(clamped);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const startX = e.clientX;
    const startVal = value;
    if (!e.shiftKey) {
      updateFromClientX(e.clientX, false);
    }

    const onMove = (ev: PointerEvent) => {
      updateFromClientX(ev.clientX, ev.shiftKey, startX, startVal);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
    onCommit?.();
  };

  const fillLeft = Math.min(pct, defPct);
  const fillWidth = Math.abs(pct - defPct);

  return (
    <div
      className={`no-select flex flex-col ${compact ? 'gap-1' : 'gap-1.5'}`}
      onDoubleClick={handleDoubleClick}
      title="Drag to adjust · Shift+Drag for fine precision · Double-click to reset"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
        <span
          className={`truncate font-medium transition-colors ${
            isModified ? 'text-[#ECECEF]' : 'text-[#8E8E98]'
          }`}
        >
          {label}
        </span>
        <span
          className={`font-mono-num shrink-0 text-[11px] ${
            isModified ? 'text-[#E5892E]' : 'text-[#6E6E78]'
          }`}
        >
          {value > 0 && defaultValue === 0 ? '+' : ''}
          {value.toFixed(decimals)}
          {unit}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onKeyDown={(e) => {
          const mult = e.shiftKey ? 0.25 : 1;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Math.min(max, Number((value + step * 4 * mult).toFixed(4))));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(min, Number((value - step * 4 * mult).toFixed(4))));
          } else if (e.key === '0' || e.key === 'Backspace') {
            e.preventDefault();
            onChange(defaultValue);
          }
        }}
        className="group relative flex h-4 cursor-ew-resize items-center focus-visible:outline-none"
      >
        {/* Rail */}
        <div
          className="relative h-[4px] w-full overflow-hidden rounded-full bg-[#24242A]"
          style={trackGradient ? { background: trackGradient } : undefined}
        >
          {!trackGradient && (
            <div
              className="absolute top-0 bottom-0 bg-[#E5892E]/85 transition-[opacity]"
              style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
            />
          )}
        </div>

        {/* Center / Default tick mark */}
        <div
          className="pointer-events-none absolute top-1/2 h-2.5 w-[1px] -translate-y-1/2 bg-white/25"
          style={{ left: `${defPct}%` }}
        />

        {/* Thumb */}
        <div
          className={`pointer-events-none absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border transition-transform ${
            dragging
              ? 'scale-110 border-[#E5892E] bg-[#ECECEF]'
              : 'border-[#0C0C0E] bg-[#D4D4DC] group-hover:bg-white'
          }`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
};
