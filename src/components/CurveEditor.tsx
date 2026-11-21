import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { evaluateCurveToLut } from '../engine/curveMath';
import type {
  CurvePoint,
  CurvesState,
  CustomCurveChannel,
  SecondaryCurveType,
} from '../types/grading';

interface CurveEditorProps {
  curves: CurvesState;
  lumaHistogram?: Float32Array;
  onChangeCurve: (key: keyof CurvesState, points: CurvePoint[]) => void;
  onResetAllCurves: () => void;
  onCommit?: () => void;
}

const CUSTOM_CHANNELS: Array<{
  id: CustomCurveChannel;
  label: string;
  stroke: string;
}> = [
  { id: 'master', label: 'Y Master', stroke: '#ECECEF' },
  { id: 'red', label: 'Red', stroke: '#E85D5D' },
  { id: 'green', label: 'Green', stroke: '#4CC37A' },
  { id: 'blue', label: 'Blue', stroke: '#5594F5' },
];

const SECONDARY_MODES: Array<{
  id: SecondaryCurveType;
  label: string;
  xAxis: 'hue' | 'lum' | 'sat';
  yAxisDesc: string;
  cyclic: boolean;
}> = [
  { id: 'hueVsHue', label: 'Hue vs Hue', xAxis: 'hue', yAxisDesc: 'Hue Shift (±90°)', cyclic: true },
  { id: 'hueVsSat', label: 'Hue vs Sat', xAxis: 'hue', yAxisDesc: 'Saturation', cyclic: true },
  { id: 'hueVsLum', label: 'Hue vs Lum', xAxis: 'hue', yAxisDesc: 'Luminance', cyclic: true },
  { id: 'lumVsSat', label: 'Lum vs Sat', xAxis: 'lum', yAxisDesc: 'Saturation', cyclic: false },
  { id: 'satVsSat', label: 'Sat vs Sat', xAxis: 'sat', yAxisDesc: 'Saturation', cyclic: false },
  { id: 'satVsLum', label: 'Sat vs Lum', xAxis: 'sat', yAxisDesc: 'Luminance', cyclic: false },
];

const HUE_ANCHORS = [
  { label: 'R', x: 0.01, color: '#EF4444' },
  { label: 'Y', x: 0.167, color: '#EAB308' },
  { label: 'G', x: 0.333, color: '#22C55E' },
  { label: 'C', x: 0.50, color: '#06B6D4' },
  { label: 'B', x: 0.667, color: '#3B82F6' },
  { label: 'M', x: 0.833, color: '#EC4899' },
];

const CUSTOM_PRESETS: Array<{ label: string; points: CurvePoint[] }> = [
  {
    label: 'Linear',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    label: 'Soft S-Curve',
    points: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.20 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.80 },
      { x: 1, y: 1 },
    ],
  },
  {
    label: 'Film Toe',
    points: [
      { x: 0, y: 0.045 },
      { x: 0.22, y: 0.19 },
      { x: 0.55, y: 0.56 },
      { x: 0.84, y: 0.86 },
      { x: 1, y: 0.96 },
    ],
  },
  {
    label: 'Matte Fade',
    points: [
      { x: 0, y: 0.09 },
      { x: 0.25, y: 0.24 },
      { x: 0.75, y: 0.76 },
      { x: 1, y: 0.93 },
    ],
  },
];

export const CurveEditor: React.FC<CurveEditorProps> = ({
  curves,
  lumaHistogram,
  onChangeCurve,
  onResetAllCurves,
  onCommit,
}) => {
  const [group, setGroup] = useState<'custom' | SecondaryCurveType>('custom');
  const [customChannel, setCustomChannel] = useState<CustomCurveChannel>('master');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeKey: keyof CurvesState = group === 'custom' ? customChannel : group;
  const secondaryMeta = SECONDARY_MODES.find((m) => m.id === group);
  const isCyclic = Boolean(secondaryMeta?.cyclic);
  const points = curves[activeKey];

  const width = 560;
  const height = 216;
  const padX = 16;
  const padY = 14;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const toSvgX = (x: number) => padX + x * innerW;
  const toSvgY = (y: number) => padY + (1 - y) * innerH;

  const lutPath = useMemo(() => {
    const lut = evaluateCurveToLut(points, 128, isCyclic);
    let d = '';
    for (let i = 0; i < lut.length; i++) {
      const x = toSvgX(i / (lut.length - 1));
      const y = toSvgY(lut[i]);
      d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [points, isCyclic]);

  // Ghost paths for R/G/B when viewing Custom Curves
  const ghostPaths = useMemo(() => {
    if (group !== 'custom') return [];
    return CUSTOM_CHANNELS.filter((c) => c.id !== customChannel).map((ch) => {
      const lut = evaluateCurveToLut(curves[ch.id], 64, false);
      let d = '';
      for (let i = 0; i < lut.length; i++) {
        const x = toSvgX(i / (lut.length - 1));
        const y = toSvgY(lut[i]);
        d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return { id: ch.id, stroke: ch.stroke, d };
    });
  }, [group, customChannel, curves]);

  const histogramPath = useMemo(() => {
    if (group !== 'custom' || !lumaHistogram || lumaHistogram.length === 0) return '';
    let maxVal = 0.001;
    for (let i = 0; i < lumaHistogram.length; i++) {
      if (lumaHistogram[i] > maxVal) maxVal = lumaHistogram[i];
    }
    let d = `M ${padX} ${padY + innerH}`;
    for (let i = 0; i < lumaHistogram.length; i++) {
      const x = toSvgX(i / (lumaHistogram.length - 1));
      const norm = Math.sqrt(lumaHistogram[i] / maxVal);
      const y = padY + innerH - norm * innerH * 0.72;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    d += ` L ${padX + innerW} ${padY + innerH} Z`;
    return d;
  }, [group, lumaHistogram]);

  const clientToNorm = (clientX: number, clientY: number): CurvePoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0.5, y: 0.5 };
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * width;
    const sy = ((clientY - rect.top) / rect.height) * height;
    const nx = Math.max(0, Math.min(1, (sx - padX) / innerW));
    const ny = Math.max(0, Math.min(1, 1 - (sy - padY) / innerH));
    return { x: Number(nx.toFixed(4)), y: Number(ny.toFixed(4)) };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const pt = clientToNorm(e.clientX, e.clientY);

    // Hit-test existing control points
    let hit = -1;
    let bestDist = 0.045;
    points.forEach((p, idx) => {
      const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (dist < bestDist) {
        bestDist = dist;
        hit = idx;
      }
    });

    let workingPoints = [...points];
    let dragIndex = hit;

    if (dragIndex === -1) {
      workingPoints.push(pt);
      workingPoints.sort((a, b) => a.x - b.x);
      dragIndex = workingPoints.findIndex((p) => p.x === pt.x && p.y === pt.y);
      onChangeCurve(activeKey, workingPoints);
    }

    setActiveIdx(dragIndex);
    const isFirstEndpoint = !isCyclic && dragIndex === 0;
    const isLastEndpoint = !isCyclic && dragIndex === workingPoints.length - 1;

    const onMove = (ev: PointerEvent) => {
      const next = clientToNorm(ev.clientX, ev.clientY);
      const updated = workingPoints.map((p, idx) => {
        if (idx !== dragIndex) return p;
        let clampedX = next.x;
        if (isFirstEndpoint) {
          clampedX = 0;
        } else if (isLastEndpoint) {
          clampedX = 1;
        } else {
          const prevX = dragIndex > 0 ? workingPoints[dragIndex - 1].x + 0.015 : 0.005;
          const nextX =
            dragIndex < workingPoints.length - 1
              ? workingPoints[dragIndex + 1].x - 0.015
              : 0.995;
          clampedX = Math.max(prevX, Math.min(nextX, next.x));
        }
        return { x: Number(clampedX.toFixed(4)), y: next.y };
      });
      workingPoints = updated;
      onChangeCurve(activeKey, updated);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit?.();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleRemovePoint = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCyclic && (idx === 0 || idx === points.length - 1)) return;
    if (points.length <= 2) return;
    const next = points.filter((_, i) => i !== idx);
    onChangeCurve(activeKey, next);
    setActiveIdx(null);
    onCommit?.();
  };

  const handleResetCurrent = () => {
    const def =
      group === 'custom'
        ? [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]
        : [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 },
          ];
    onChangeCurve(activeKey, def);
    setActiveIdx(null);
    onCommit?.();
  };

  const addHueAnchor = (anchorX: number) => {
    const exists = points.findIndex((p) => Math.abs(p.x - anchorX) < 0.025);
    if (exists !== -1) {
      setActiveIdx(exists);
      return;
    }
    const lut = evaluateCurveToLut(points, 256, isCyclic);
    const sampleY = lut[Math.round(anchorX * 255)] ?? 0.5;
    const next = [...points, { x: anchorX, y: Number(sampleY.toFixed(4)) }].sort(
      (a, b) => a.x - b.x
    );
    onChangeCurve(activeKey, next);
    onCommit?.();
  };

  const activeStroke =
    group === 'custom'
      ? CUSTOM_CHANNELS.find((c) => c.id === customChannel)?.stroke ?? '#ECECEF'
      : '#E5892E';

  const activePoint = activeIdx !== null ? points[activeIdx] : null;

  return (
    <div className="no-select flex h-full gap-4">
      {/* Left vertical curve mode selector */}
      <div className="flex w-40 shrink-0 flex-col justify-between border-r border-white/[0.07] pr-3">
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => {
              setGroup('custom');
              setActiveIdx(null);
            }}
            className={`flex items-center justify-between rounded px-2.5 py-1.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
              group === 'custom'
                ? 'bg-[#E5892E]/15 text-[#E5892E]'
                : 'text-[#A0A0AA] hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <span>Custom RGBY</span>
          </button>

          <div className="my-1.5 h-[1px] bg-white/[0.06]" />

          {SECONDARY_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setGroup(m.id);
                setActiveIdx(null);
              }}
              className={`flex items-center justify-between rounded px-2.5 py-1.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                group === m.id
                  ? 'bg-[#E5892E]/15 text-[#E5892E]'
                  : 'text-[#A0A0AA] hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onResetAllCurves();
            onCommit?.();
          }}
          className="flex items-center justify-center gap-1.5 rounded border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset All Curves
        </button>
      </div>

      {/* Main Spline Canvas Area */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Sub-toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {group === 'custom' ? (
            <div className="flex items-center gap-1 rounded bg-[#101013] p-0.5 border border-white/[0.06]">
              {CUSTOM_CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setCustomChannel(ch.id);
                    setActiveIdx(null);
                  }}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                    customChannel === ch.id
                      ? 'bg-[#25252B] text-white'
                      : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ch.stroke }}
                  />
                  {ch.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[#A0A0AA]">
              <span className="font-medium text-[#ECECEF]">{secondaryMeta?.label}</span>
              <span className="text-[#5A5A64]">·</span>
              <span className="text-[11px] text-[#8E8E98]">
                Vertical axis: {secondaryMeta?.yAxisDesc}
              </span>
            </div>
          )}

          {/* Presets or Hue Anchors + Reset */}
          <div className="flex items-center gap-1.5">
            {group === 'custom' && customChannel === 'master' && (
              <div className="flex items-center gap-1">
                {CUSTOM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      onChangeCurve('master', preset.points.map((p) => ({ ...p })));
                      onCommit?.();
                    }}
                    className="rounded border border-white/[0.08] bg-[#18181D] px-2 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {secondaryMeta?.xAxis === 'hue' && (
              <div className="flex items-center gap-1">
                <span className="mr-1 text-[10px] text-[#787882]">Pin Hue:</span>
                {HUE_ANCHORS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => addHueAnchor(a.x)}
                    title={`Add ${a.label} control point`}
                    className="flex h-5 w-5 items-center justify-center rounded border border-white/10 bg-[#18181D] text-[10px] font-semibold transition-transform hover:scale-105"
                    style={{ color: a.color }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleResetCurrent}
              className="flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        {/* SVG Graph */}
        <div className="relative flex-1 overflow-hidden rounded border border-white/[0.08] bg-[#101013]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            onPointerDown={handleSvgPointerDown}
            className="h-full w-full cursor-crosshair"
          >
            <defs>
              <linearGradient id="hueSpectrumX" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="16.7%" stopColor="#EAB308" />
                <stop offset="33.3%" stopColor="#22C55E" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="66.7%" stopColor="#3B82F6" />
                <stop offset="83.3%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <linearGradient id="lumSpectrumX" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0A0A0D" />
                <stop offset="50%" stopColor="#7A7A85" />
                <stop offset="100%" stopColor="#F4F4F6" />
              </linearGradient>
              <linearGradient id="satSpectrumX" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#52525B" />
                <stop offset="100%" stopColor="#E5892E" />
              </linearGradient>
            </defs>

            {/* Grid lines (quarters) */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1={toSvgX(t)}
                  y1={padY}
                  x2={toSvgX(t)}
                  y2={padY + innerH}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <line
                  x1={padX}
                  y1={toSvgY(t)}
                  x2={padX + innerW}
                  y2={toSvgY(t)}
                  stroke={
                    t === 0.5 && group !== 'custom'
                      ? 'rgba(255,255,255,0.22)'
                      : 'rgba(255,255,255,0.06)'
                  }
                  strokeWidth="1"
                  strokeDasharray={t === 0.5 && group !== 'custom' ? '4 4' : undefined}
                />
              </g>
            ))}

            {/* Reference diagonal for Custom Curves */}
            {group === 'custom' && (
              <line
                x1={toSvgX(0)}
                y1={toSvgY(0)}
                x2={toSvgX(1)}
                y2={toSvgY(1)}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}

            {/* Luma histogram backdrop on Custom Curves */}
            {histogramPath && <path d={histogramPath} fill="rgba(255,255,255,0.07)" />}

            {/* Bottom spectrum guide bar for Secondary Curves */}
            {secondaryMeta && (
              <rect
                x={padX}
                y={height - 6}
                width={innerW}
                height={4}
                rx={2}
                fill={
                  secondaryMeta.xAxis === 'hue'
                    ? 'url(#hueSpectrumX)'
                    : secondaryMeta.xAxis === 'lum'
                      ? 'url(#lumSpectrumX)'
                      : 'url(#satSpectrumX)'
                }
                opacity={0.85}
              />
            )}

            {/* Inactive ghost channel curves */}
            {ghostPaths.map((g) => (
              <path
                key={g.id}
                d={g.d}
                fill="none"
                stroke={g.stroke}
                strokeWidth="1.2"
                strokeOpacity="0.32"
              />
            ))}

            {/* Active Spline Curve */}
            <path d={lutPath} fill="none" stroke={activeStroke} strokeWidth="2.1" />

            {/* Control Knots */}
            {points.map((p, idx) => {
              const cx = toSvgX(p.x);
              const cy = toSvgY(p.y);
              const isSelected = idx === activeIdx;
              return (
                <g
                  key={`${idx}_${p.x}`}
                  onDoubleClick={(e) => handleRemovePoint(idx, e)}
                  onContextMenu={(e) => handleRemovePoint(idx, e)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 5.5 : 4.2}
                    fill={isSelected ? '#E5892E' : '#ECECEF'}
                    stroke="#0C0C0E"
                    strokeWidth="1.5"
                    className="cursor-grab"
                  />
                </g>
              );
            })}
          </svg>

          {/* Subtle footer coordinate telemetry */}
          <div className="pointer-events-none absolute right-2.5 bottom-2 flex items-center gap-3 text-[10px] text-[#787882]">
            <span>Click to add · Drag to sculpt · Double-click point to delete</span>
            {activePoint && (
              <span className="font-mono-num text-[#ECECEF]">
                In {(activePoint.x * 100).toFixed(0)}% · Out {(activePoint.y * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
