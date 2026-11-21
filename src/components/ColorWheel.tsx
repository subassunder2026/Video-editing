import React, { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { wheelToRgbOffset } from '../types/grading';

interface ColorWheelProps {
  label: string;
  x: number;
  y: number;
  masterValue: number;
  masterLabel?: string;
  masterMin?: number;
  masterMax?: number;
  masterDefault?: number;
  masterUnit?: string;
  size?: number;
  accentHighlight?: boolean;
  onChangeWheel: (x: number, y: number) => void;
  onChangeMaster: (val: number) => void;
  onReset: () => void;
  onCommit?: () => void;
  extraFooter?: React.ReactNode;
}

export const ColorWheel: React.FC<ColorWheelProps> = ({
  label,
  x,
  y,
  masterValue,
  masterLabel = 'Y',
  masterMin = -1,
  masterMax = 1,
  masterDefault = 0,
  masterUnit = '',
  size = 132,
  accentHighlight = false,
  onChangeWheel,
  onChangeMaster,
  onReset,
  onCommit,
  extraFooter,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLDivElement>(null);
  const [draggingWheel, setDraggingWheel] = useState(false);

  const radius = size / 2;
  const innerRadius = radius - 10;

  const isDirty =
    Math.hypot(x, y) > 0.002 || Math.abs(masterValue - masterDefault) > 0.002;

  const [rOff, gOff, bOff] = wheelToRgbOffset(x, y);

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingWheel(true);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = x;
    const startY = y;

    const computePos = (cx: number, cy: number, fine: boolean) => {
      const el = wheelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let nx: number;
      let ny: number;

      if (fine) {
        nx = startX + ((cx - startClientX) / innerRadius) * 0.25;
        ny = startY + ((cy - startClientY) / innerRadius) * 0.25;
      } else {
        nx = (cx - (rect.left + rect.width / 2)) / innerRadius;
        ny = (cy - (rect.top + rect.height / 2)) / innerRadius;
      }

      const mag = Math.hypot(nx, ny);
      if (mag > 1) {
        nx /= mag;
        ny /= mag;
      }
      onChangeWheel(Number(nx.toFixed(4)), Number(ny.toFixed(4)));
    };

    if (!e.shiftKey) {
      computePos(e.clientX, e.clientY, false);
    }

    const onMove = (ev: PointerEvent) => computePos(ev.clientX, ev.clientY, ev.shiftKey);
    const onUp = () => {
      setDraggingWheel(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleMasterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startVal = masterValue;
    const span = masterMax - masterMin;

    const update = (cx: number, fine: boolean) => {
      const el = masterRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let next: number;
      if (fine) {
        next = startVal + ((cx - startX) / rect.width) * span * 0.25;
      } else {
        const norm = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
        next = masterMin + norm * span;
      }
      onChangeMaster(Number(Math.max(masterMin, Math.min(masterMax, next)).toFixed(3)));
    };

    if (!e.shiftKey) update(e.clientX, false);

    const onMove = (ev: PointerEvent) => update(ev.clientX, ev.shiftKey);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const puckX = radius + x * innerRadius;
  const puckY = radius + y * innerRadius;
  const masterSpan = masterMax - masterMin;
  const masterPct = Math.max(0, Math.min(100, ((masterValue - masterMin) / masterSpan) * 100));
  const masterDefPct = Math.max(
    0,
    Math.min(100, ((masterDefault - masterMin) / masterSpan) * 100)
  );

  return (
    <div className="no-select flex flex-col items-center gap-2">
      {/* Header row */}
      <div className="flex w-full items-center justify-between px-1">
        <span
          className={`text-xs font-medium tracking-tight ${
            accentHighlight
              ? 'text-[#E5892E]'
              : isDirty
                ? 'text-[#ECECEF]'
                : 'text-[#A0A0AA]'
          }`}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            onReset();
            onCommit?.();
          }}
          disabled={!isDirty}
          title={`Reset ${label}`}
          className={`flex h-5 w-5 items-center justify-center rounded transition-colors ${
            isDirty
              ? 'text-[#A0A0AA] hover:bg-white/10 hover:text-white'
              : 'cursor-default text-[#3A3A42]'
          }`}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {/* Circular Color Wheel */}
      <div
        ref={wheelRef}
        onPointerDown={handleWheelPointerDown}
        onDoubleClick={() => {
          onChangeWheel(0, 0);
          onCommit?.();
        }}
        title="Drag to grade chromaticity · Shift+Drag for fine control · Double-click to center"
        style={{ width: size, height: size }}
        className={`relative cursor-crosshair rounded-full border transition-colors ${
          accentHighlight
            ? 'border-[#E5892E]/70'
            : draggingWheel
              ? 'border-white/30'
              : 'border-white/10'
        }`}
      >
        {/* Subtle spectral outer ring matching wheelToRgbOffset angle mapping:
            0deg (right)=Red, 60deg (top-right)=Yellow, 120deg (top-left)=Green,
            180deg (left)=Cyan, 240deg (bottom-left)=Blue, 300deg (bottom-right)=Magenta.
            CSS conic-gradient starts at 12 o'clock (top) and goes clockwise:
            0deg(top)=Lime/Yellow-Green -> 30deg=Yellow -> 90deg(right)=Red -> 150deg=Magenta -> 210deg=Blue -> 270deg(left)=Cyan -> 330deg=Green */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full opacity-80"
          style={{
            background:
              'conic-gradient(from 0deg, #98e024 0deg, #f2d629 30deg, #ef4444 90deg, #e037c6 150deg, #3b63f6 210deg, #19d4e6 270deg, #27d65b 330deg, #98e024 360deg)',
          }}
        />
        {/* Inner dark neutral dish */}
        <div className="pointer-events-none absolute inset-[4px] rounded-full bg-[#131317] shadow-inner" />

        {/* Subtle radial chroma hint inside dish */}
        <div
          className="pointer-events-none absolute inset-[5px] rounded-full opacity-[0.14]"
          style={{
            background:
              'conic-gradient(from 0deg, #98e024 0deg, #f2d629 30deg, #ef4444 90deg, #e037c6 150deg, #3b63f6 210deg, #19d4e6 270deg, #27d65b 330deg, #98e024 360deg)',
            maskImage: 'radial-gradient(circle, transparent 22%, black 100%)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 22%, black 100%)',
          }}
        />

        {/* SVG Crosshairs, concentric calibration rings & active vector */}
        <svg
          width={size}
          height={size}
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <circle
            cx={radius}
            cy={radius}
            r={innerRadius * 0.5}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
          <line
            x1={radius}
            y1={10}
            x2={radius}
            y2={size - 10}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          <line
            x1={10}
            y1={radius}
            x2={size - 10}
            y2={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
          {Math.hypot(x, y) > 0.005 && (
            <line
              x1={radius}
              y1={radius}
              x2={puckX}
              y2={puckY}
              stroke="#E5892E"
              strokeWidth="1.25"
              strokeOpacity="0.85"
            />
          )}
          {/* Center dot */}
          <circle cx={radius} cy={radius} r={1.8} fill="rgba(255,255,255,0.3)" />
          {/* Control Puck */}
          <circle
            cx={puckX}
            cy={puckY}
            r={5.5}
            fill={draggingWheel ? '#FFFFFF' : '#ECECEF'}
            stroke="#0C0C0E"
            strokeWidth="1.75"
          />
          <circle cx={puckX} cy={puckY} r={2} fill="#0C0C0E" />
        </svg>
      </div>

      {/* Master Luminance / Exposure Roller Bar */}
      <div className="flex w-full flex-col gap-1 px-0.5">
        <div
          ref={masterRef}
          onPointerDown={handleMasterPointerDown}
          onDoubleClick={() => {
            onChangeMaster(masterDefault);
            onCommit?.();
          }}
          title={`Drag ${masterLabel} · Shift+Drag for fine control · Double-click to reset`}
          className="relative flex h-4 w-full cursor-ew-resize items-center"
        >
          <div className="relative h-[5px] w-full overflow-hidden rounded-full bg-[#222228]">
            <div
              className="absolute top-0 bottom-0 bg-[#E5892E]"
              style={{
                left: `${Math.min(masterPct, masterDefPct)}%`,
                width: `${Math.abs(masterPct - masterDefPct)}%`,
              }}
            />
          </div>
          <div
            className="pointer-events-none absolute top-1/2 h-2.5 w-[1px] -translate-y-1/2 bg-white/30"
            style={{ left: `${masterDefPct}%` }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-black/80 bg-[#D8D8E0]"
            style={{ left: `${masterPct}%` }}
          />
        </div>

        {/* Numeric RGBY Telemetry Readout */}
        <div className="font-mono-num grid grid-cols-4 gap-0.5 text-center text-[10px] leading-tight text-[#787882]">
          <span className={Math.abs(rOff) > 0.005 ? 'text-[#E06C6C]' : ''}>
            {rOff >= 0 ? '+' : ''}
            {rOff.toFixed(2)}
          </span>
          <span className={Math.abs(gOff) > 0.005 ? 'text-[#62C47F]' : ''}>
            {gOff >= 0 ? '+' : ''}
            {gOff.toFixed(2)}
          </span>
          <span className={Math.abs(bOff) > 0.005 ? 'text-[#669DF2]' : ''}>
            {bOff >= 0 ? '+' : ''}
            {bOff.toFixed(2)}
          </span>
          <span
            className={
              Math.abs(masterValue - masterDefault) > 0.005 ? 'text-[#E5892E]' : 'text-[#A0A0AA]'
            }
          >
            {masterLabel}:{masterValue >= 0 && masterDefault === 0 ? '+' : ''}
            {masterValue.toFixed(2)}
            {masterUnit}
          </span>
        </div>
      </div>

      {extraFooter && <div className="w-full">{extraFooter}</div>}
    </div>
  );
};
