import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  createDefaultPrimaries,
  createDefaultWheel,
  type PrimariesState,
  type PrimarySubMode,
  type WheelValue,
} from '../types/grading';
import { ColorWheel } from './ColorWheel';
import { PrecisionSlider } from './PrecisionSlider';

interface PrimaryPanelProps {
  primaries: PrimariesState;
  onChange: (next: PrimariesState) => void;
  onCommit?: () => void;
}

export const PrimaryPanel: React.FC<PrimaryPanelProps> = ({
  primaries,
  onChange,
  onCommit,
}) => {
  const [subMode, setSubMode] = useState<PrimarySubMode>('wheels');

  const updateField = <K extends keyof PrimariesState>(key: K, val: PrimariesState[K]) => {
    onChange({ ...primaries, [key]: val });
  };

  const updateWheel = (
    key: 'lift' | 'gamma' | 'gain' | 'offset' | 'logShadows' | 'logMidtones' | 'logHighlights',
    patch: Partial<WheelValue>
  ) => {
    onChange({
      ...primaries,
      [key]: { ...primaries[key], ...patch },
    });
  };

  // Helper for Primaries Bars mode (converts R/G/B offset directly to wheel x/y approximation or master)
  const renderBarGroup = (
    title: string,
    key: 'lift' | 'gamma' | 'gain' | 'offset'
  ) => {
    const w = primaries[key];
    return (
      <div className="flex flex-1 flex-col gap-2.5 border-r border-white/[0.06] px-3 last:border-r-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#D4D4DC]">{title}</span>
          <button
            type="button"
            onClick={() => {
              updateField(key, createDefaultWheel());
              onCommit?.();
            }}
            className="text-[#6E6E78] transition-colors hover:text-white"
            title={`Reset ${title}`}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
        <PrecisionSlider
          label="Red / Cyan"
          value={w.x}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #19a8b8 0%, #24242A 50%, #d94c4c 100%)"
          onChange={(v) => updateWheel(key, { x: v })}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Green / Magenta"
          value={-w.y}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #c946b4 0%, #24242A 50%, #3fb568 100%)"
          onChange={(v) => updateWheel(key, { y: -v })}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Master Luma"
          value={w.luma}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          onChange={(v) => updateWheel(key, { luma: v })}
          onCommit={onCommit}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      {/* Sub-mode switcher + reset */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-1 rounded bg-[#101013] p-0.5 border border-white/[0.06]">
          {(
            [
              { id: 'wheels', label: 'Primary Wheels' },
              { id: 'log', label: 'Log Wheels' },
              { id: 'bars', label: 'Primary Bars' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSubMode(m.id)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                subMode === m.id
                  ? 'bg-[#25252B] text-white'
                  : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(createDefaultPrimaries());
            onCommit?.();
          }}
          className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Primaries
        </button>
      </div>

      {/* Main Wheels / Log / Bars Deck */}
      <div className="flex min-h-0 flex-1 items-center gap-4">
        {subMode === 'wheels' && (
          <div className="grid w-full grid-cols-4 gap-5 px-2">
            <ColorWheel
              label="Lift"
              x={primaries.lift.x}
              y={primaries.lift.y}
              masterValue={primaries.lift.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('lift', { x, y })}
              onChangeMaster={(luma) => updateWheel('lift', { luma })}
              onReset={() => updateField('lift', createDefaultWheel())}
              onCommit={onCommit}
            />
            <ColorWheel
              label="Gamma"
              x={primaries.gamma.x}
              y={primaries.gamma.y}
              masterValue={primaries.gamma.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('gamma', { x, y })}
              onChangeMaster={(luma) => updateWheel('gamma', { luma })}
              onReset={() => updateField('gamma', createDefaultWheel())}
              onCommit={onCommit}
            />
            <ColorWheel
              label="Gain"
              x={primaries.gain.x}
              y={primaries.gain.y}
              masterValue={primaries.gain.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('gain', { x, y })}
              onChangeMaster={(luma) => updateWheel('gain', { luma })}
              onReset={() => updateField('gain', createDefaultWheel())}
              onCommit={onCommit}
            />
            <ColorWheel
              label="Offset"
              x={primaries.offset.x}
              y={primaries.offset.y}
              masterValue={primaries.offset.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('offset', { x, y })}
              onChangeMaster={(luma) => updateWheel('offset', { luma })}
              onReset={() => updateField('offset', createDefaultWheel())}
              onCommit={onCommit}
            />
          </div>
        )}

        {subMode === 'log' && (
          <div className="grid w-full grid-cols-4 items-center gap-5 px-2">
            <ColorWheel
              label="Log Shadows"
              x={primaries.logShadows.x}
              y={primaries.logShadows.y}
              masterValue={primaries.logShadows.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('logShadows', { x, y })}
              onChangeMaster={(luma) => updateWheel('logShadows', { luma })}
              onReset={() => updateField('logShadows', createDefaultWheel())}
              onCommit={onCommit}
            />
            <ColorWheel
              label="Log Midtones"
              x={primaries.logMidtones.x}
              y={primaries.logMidtones.y}
              masterValue={primaries.logMidtones.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('logMidtones', { x, y })}
              onChangeMaster={(luma) => updateWheel('logMidtones', { luma })}
              onReset={() => updateField('logMidtones', createDefaultWheel())}
              onCommit={onCommit}
            />
            <ColorWheel
              label="Log Highlights"
              x={primaries.logHighlights.x}
              y={primaries.logHighlights.y}
              masterValue={primaries.logHighlights.luma}
              size={128}
              onChangeWheel={(x, y) => updateWheel('logHighlights', { x, y })}
              onChangeMaster={(luma) => updateWheel('logHighlights', { luma })}
              onReset={() => updateField('logHighlights', createDefaultWheel())}
              onCommit={onCommit}
            />
            <div className="flex flex-col gap-3 border-l border-white/[0.07] pl-4">
              <div className="text-xs font-medium text-[#D4D4DC]">Log Zone Crossover</div>
              <PrecisionSlider
                label="Low Range"
                value={primaries.logLowRange}
                min={0.05}
                max={0.55}
                step={0.01}
                defaultValue={0.30}
                onChange={(v) => updateField('logLowRange', v)}
                onCommit={onCommit}
              />
              <PrecisionSlider
                label="High Range"
                value={primaries.logHighRange}
                min={0.45}
                max={0.95}
                step={0.01}
                defaultValue={0.68}
                onChange={(v) => updateField('logHighRange', v)}
                onCommit={onCommit}
              />
              <p className="text-[11px] leading-relaxed text-[#6E6E78]">
                Log wheels isolate shadows, midtones, and highlights with smooth tonal roll-off boundaries.
              </p>
            </div>
          </div>
        )}

        {subMode === 'bars' && (
          <div className="flex w-full items-stretch py-2">
            {renderBarGroup('Lift', 'lift')}
            {renderBarGroup('Gamma', 'gamma')}
            {renderBarGroup('Gain', 'gain')}
            {renderBarGroup('Offset', 'offset')}
          </div>
        )}
      </div>

      {/* Primary Adjustment Strip (2 rows x 5 precision sliders) */}
      <div className="grid grid-cols-5 gap-x-5 gap-y-2 border-t border-white/[0.07] pt-2.5">
        <PrecisionSlider
          label="Exposure"
          value={primaries.exposure}
          min={-3}
          max={3}
          step={0.02}
          defaultValue={0}
          unit=" EV"
          compact
          onChange={(v) => updateField('exposure', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Contrast"
          value={primaries.contrast}
          min={0.2}
          max={2.0}
          step={0.01}
          defaultValue={1}
          compact
          onChange={(v) => updateField('contrast', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Pivot"
          value={primaries.pivot}
          min={0.1}
          max={0.9}
          step={0.005}
          defaultValue={0.435}
          decimals={3}
          compact
          onChange={(v) => updateField('pivot', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Temperature"
          value={primaries.temperature}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #3575c9 0%, #24242A 50%, #d9822b 100%)"
          onChange={(v) => updateField('temperature', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Tint"
          value={primaries.tint}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #39a868 0%, #24242A 50%, #c84bb4 100%)"
          onChange={(v) => updateField('tint', v)}
          onCommit={onCommit}
        />

        <PrecisionSlider
          label="Saturation"
          value={primaries.saturation}
          min={0}
          max={2}
          step={0.01}
          defaultValue={1}
          compact
          onChange={(v) => updateField('saturation', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Color Boost"
          value={primaries.vibrance}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          onChange={(v) => updateField('vibrance', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Shadows"
          value={primaries.shadows}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          onChange={(v) => updateField('shadows', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Highlights"
          value={primaries.highlights}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          onChange={(v) => updateField('highlights', v)}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Midtone Detail"
          value={primaries.midtoneDetail}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          onChange={(v) => updateField('midtoneDetail', v)}
          onCommit={onCommit}
        />
      </div>
    </div>
  );
};
