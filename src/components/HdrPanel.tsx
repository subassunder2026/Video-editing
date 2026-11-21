import React, { useState } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import {
  createDefaultHdr,
  type HdrState,
  type HdrZone,
  type HdrZoneId,
} from '../types/grading';
import { ColorWheel } from './ColorWheel';
import { PrecisionSlider } from './PrecisionSlider';

interface HdrPanelProps {
  hdr: HdrState;
  onChange: (next: HdrState) => void;
  onCommit?: () => void;
}

const ZONE_META: Record<
  HdrZoneId,
  { label: string; group: 'dark' | 'light'; defMin: number; defMax: number }
> = {
  black: { label: 'Black', group: 'dark', defMin: 0.0, defMax: 0.16 },
  dark: { label: 'Dark', group: 'dark', defMin: 0.08, defMax: 0.36 },
  shadow: { label: 'Shadow', group: 'dark', defMin: 0.22, defMax: 0.56 },
  light: { label: 'Light', group: 'light', defMin: 0.44, defMax: 0.78 },
  highlight: { label: 'Highlight', group: 'light', defMin: 0.64, defMax: 0.92 },
  specular: { label: 'Specular', group: 'light', defMin: 0.82, defMax: 1.0 },
};

const ALL_ZONES: HdrZoneId[] = ['black', 'dark', 'shadow', 'light', 'highlight', 'specular'];

export const HdrPanel: React.FC<HdrPanelProps> = ({ hdr, onChange, onCommit }) => {
  const [zoneBank, setZoneBank] = useState<'all' | 'dark' | 'light'>('all');
  const [selectedZone, setSelectedZone] = useState<HdrZoneId>('specular');

  const visibleZones: HdrZoneId[] =
    zoneBank === 'all'
      ? ALL_ZONES
      : ALL_ZONES.filter((id) => ZONE_META[id].group === zoneBank);

  const updateZone = (id: HdrZoneId, patch: Partial<HdrZone>) => {
    onChange({
      ...hdr,
      zones: {
        ...hdr.zones,
        [id]: { ...hdr.zones[id], ...patch },
      },
    });
  };

  const resetZone = (id: HdrZoneId) => {
    const def = createDefaultHdr().zones[id];
    updateZone(id, def);
  };

  const toggleMaskPreview = (id: HdrZoneId) => {
    onChange({
      ...hdr,
      previewZone: hdr.previewZone === id ? null : id,
    });
  };

  const activeZone = hdr.zones[selectedZone];
  const activeMeta = ZONE_META[selectedZone];

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      {/* Top HDR Control Strip */}
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded bg-[#101013] p-0.5 border border-white/[0.06]">
            {(
              [
                { id: 'all', label: 'All 6 Zones' },
                { id: 'dark', label: 'Dark Zones' },
                { id: 'light', label: 'Light Zones' },
              ] as const
            ).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setZoneBank(b.id)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  zoneBank === b.id
                    ? 'bg-[#25252B] text-white'
                    : 'text-[#8E8E98] hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => toggleMaskPreview(selectedZone)}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              hdr.previewZone !== null
                ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#E5892E]'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            {hdr.previewZone !== null ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {hdr.previewZone !== null
              ? `Mask: ${ZONE_META[hdr.previewZone].label}`
              : 'Show Zone Mask'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(createDefaultHdr());
            onCommit?.();
          }}
          className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset HDR
        </button>
      </div>

      {/* HDR Wheels Grid */}
      <div className="flex min-h-0 flex-1 items-center gap-3 overflow-x-auto">
        <div
          className={`grid w-full items-center gap-3 ${
            zoneBank === 'all' ? 'grid-cols-6' : 'grid-cols-3 px-6'
          }`}
        >
          {visibleZones.map((id) => {
            const z = hdr.zones[id];
            const isSelected = selectedZone === id;
            const isMasked = hdr.previewZone === id;
            return (
              <div
                key={id}
                onClick={() => {
                  setSelectedZone(id);
                  if (hdr.previewZone !== null) {
                    onChange({ ...hdr, previewZone: id });
                  }
                }}
                className={`rounded-md border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? 'border-[#E5892E]/50 bg-[#18181D]'
                    : 'border-white/[0.05] bg-[#131317]/60 hover:border-white/10'
                }`}
              >
                <ColorWheel
                  label={ZONE_META[id].label}
                  x={z.x}
                  y={z.y}
                  masterValue={z.exposure}
                  masterLabel="EV"
                  masterMin={-2}
                  masterMax={2}
                  masterDefault={0}
                  size={zoneBank === 'all' ? 92 : 124}
                  accentHighlight={isMasked}
                  onChangeWheel={(x, y) => updateZone(id, { x, y })}
                  onChangeMaster={(exposure) => updateZone(id, { exposure })}
                  onReset={() => resetZone(id)}
                  onCommit={onCommit}
                  extraFooter={
                    <div className="mt-0.5">
                      <PrecisionSlider
                        label="Sat"
                        value={z.saturation}
                        min={0}
                        max={2}
                        step={0.01}
                        defaultValue={1}
                        compact
                        onChange={(saturation) => updateZone(id, { saturation })}
                        onCommit={onCommit}
                      />
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar: Selected Zone Falloff Calibration + Global HDR Controls */}
      <div className="grid grid-cols-6 items-center gap-x-5 border-t border-white/[0.07] pt-2">
        <div className="col-span-2 flex items-center gap-4 border-r border-white/[0.07] pr-4">
          <div className="shrink-0">
            <div className="text-[11px] font-medium text-[#E5892E]">
              {activeMeta.label} Range
            </div>
            <div className="font-mono-num text-[10px] text-[#787882]">
              {(activeZone.falloffMin * 100).toFixed(0)}–{(activeZone.falloffMax * 100).toFixed(0)} IRE
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <PrecisionSlider
              label="Low Falloff"
              value={activeZone.falloffMin}
              min={0}
              max={Math.max(0.05, activeZone.falloffMax - 0.04)}
              step={0.01}
              defaultValue={activeMeta.defMin}
              compact
              onChange={(v) => updateZone(selectedZone, { falloffMin: v })}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="High Falloff"
              value={activeZone.falloffMax}
              min={Math.min(0.95, activeZone.falloffMin + 0.04)}
              max={1}
              step={0.01}
              defaultValue={activeMeta.defMax}
              compact
              onChange={(v) => updateZone(selectedZone, { falloffMax: v })}
              onCommit={onCommit}
            />
          </div>
        </div>

        <PrecisionSlider
          label="Global EV"
          value={hdr.globalExposure}
          min={-3}
          max={3}
          step={0.02}
          defaultValue={0}
          unit=" EV"
          compact
          onChange={(v) => onChange({ ...hdr, globalExposure: v })}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Global Sat"
          value={hdr.globalSaturation}
          min={0}
          max={2}
          step={0.01}
          defaultValue={1}
          compact
          onChange={(v) => onChange({ ...hdr, globalSaturation: v })}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Global Temp"
          value={hdr.globalTemp}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #3575c9 0%, #24242A 50%, #d9822b 100%)"
          onChange={(v) => onChange({ ...hdr, globalTemp: v })}
          onCommit={onCommit}
        />
        <PrecisionSlider
          label="Global Tint"
          value={hdr.globalTint}
          min={-1}
          max={1}
          step={0.01}
          defaultValue={0}
          compact
          trackGradient="linear-gradient(90deg, #39a868 0%, #24242A 50%, #c84bb4 100%)"
          onChange={(v) => onChange({ ...hdr, globalTint: v })}
          onCommit={onCommit}
        />
      </div>
    </div>
  );
};
