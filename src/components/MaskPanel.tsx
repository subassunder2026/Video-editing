import React from 'react';
import {
  Circle,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Minus,
  RotateCcw,
  Slash,
  Square,
} from 'lucide-react';
import { createDefaultMask, type MaskShape, type MaskState } from '../types/grading';
import { PrecisionSlider } from './PrecisionSlider';

interface MaskPanelProps {
  mask: MaskState;
  onChange: (next: MaskState) => void;
  onCommit?: () => void;
}

const SHAPES: Array<{ id: MaskShape; label: string; icon: React.ReactNode }> = [
  { id: 'none', label: 'Off (Full Frame)', icon: <Slash className="h-3.5 w-3.5" /> },
  { id: 'ellipse', label: 'Ellipse / Circle', icon: <Circle className="h-3.5 w-3.5" /> },
  { id: 'rectangle', label: 'Rectangle', icon: <Square className="h-3.5 w-3.5" /> },
  { id: 'linear', label: 'Linear Gradient', icon: <Minus className="h-3.5 w-3.5" /> },
];

export const MaskPanel: React.FC<MaskPanelProps> = ({ mask, onChange, onCommit }) => {
  const update = <K extends keyof MaskState>(key: K, val: MaskState[K]) => {
    const autoShape = mask.shape === 'none' && key !== 'shape' ? { shape: 'ellipse' as MaskShape } : {};
    onChange({ ...mask, ...autoShape, [key]: val });
  };

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      {/* Top Mask Shape Selector & Matte Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-[#101013] p-0.5">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onChange({ ...mask, shape: s.id });
                  onCommit?.();
                }}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  mask.shape === s.id
                    ? 'bg-[#25252B] text-[#E5892E]'
                    : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={mask.shape === 'none'}
            onClick={() => onChange({ ...mask, showOverlay: !mask.showOverlay })}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-35 ${
              mask.shape !== 'none' && mask.showOverlay
                ? 'border-[#E5892E]/60 bg-[#E5892E]/15 text-[#E5892E]'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            Window Outline
          </button>

          <button
            type="button"
            disabled={mask.shape === 'none'}
            onClick={() => onChange({ ...mask, showMatte: !mask.showMatte })}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-35 ${
              mask.shape !== 'none' && mask.showMatte
                ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#E5892E]'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            {mask.showMatte ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Highlight Matte
          </button>

          <button
            type="button"
            disabled={mask.shape === 'none'}
            onClick={() => {
              onChange({ ...mask, invert: !mask.invert });
              onCommit?.();
            }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap disabled:opacity-35 ${
              mask.shape !== 'none' && mask.invert
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Invert Mask
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(createDefaultMask());
            onCommit?.();
          }}
          className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Window
        </button>
      </div>

      {/* Main Controls Grid */}
      <div className="grid min-h-0 flex-1 grid-cols-12 items-center gap-6">
        <div className="col-span-8 grid grid-cols-3 gap-x-5 gap-y-3 border-r border-white/[0.07] pr-6">
          <PrecisionSlider
            label="Position X"
            value={mask.centerX}
            min={0}
            max={1}
            step={0.005}
            defaultValue={0.5}
            decimals={3}
            onChange={(v) => update('centerX', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Position Y"
            value={mask.centerY}
            min={0}
            max={1}
            step={0.005}
            defaultValue={0.5}
            decimals={3}
            onChange={(v) => update('centerY', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Rotation"
            value={mask.rotation}
            min={-180}
            max={180}
            step={1}
            defaultValue={0}
            decimals={0}
            unit="°"
            onChange={(v) => update('rotation', v)}
            onCommit={onCommit}
          />

          <PrecisionSlider
            label={mask.shape === 'linear' ? 'Gradient Offset' : 'Width / Radius X'}
            value={mask.width}
            min={0.02}
            max={1.0}
            step={0.005}
            defaultValue={0.32}
            decimals={3}
            onChange={(v) => update('width', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Height / Radius Y"
            value={mask.height}
            min={0.02}
            max={1.0}
            step={0.005}
            defaultValue={0.36}
            decimals={3}
            onChange={(v) => update('height', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Feather Softness"
            value={mask.feather}
            min={0}
            max={0.8}
            step={0.01}
            defaultValue={0.22}
            onChange={(v) => update('feather', v)}
            onCommit={onCommit}
          />
        </div>

        {/* Concise Workflow Reference */}
        <div className="col-span-4 flex flex-col gap-2 text-xs leading-relaxed text-[#8E8E98]">
          <div className="font-semibold text-[#ECECEF]">Power Window Masking</div>
          <p className="text-[11px]">
            Restricts all color adjustments on the <span className="text-[#D4D4DC]">active serial node</span> (Primary Wheels, HDR Zones, Curves, and Finish) strictly to the masked region.
          </p>
          <p className="text-[11px]">
            Drag the amber center handle directly on the viewport to reposition the window. Use <span className="text-[#D4D4DC]">Add Node</span> to combine multiple independent masks (e.g., Node 02 brightens a subject inside an Ellipse, Node 03 darkens the outside with Invert Mask).
          </p>
        </div>
      </div>
    </div>
  );
};
