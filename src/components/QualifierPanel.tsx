import React from 'react';
import { Eye, EyeOff, FlipHorizontal2, Power, RotateCcw } from 'lucide-react';
import { createDefaultQualifier, type QualifierState } from '../types/grading';
import { ColorWheel } from './ColorWheel';
import { PrecisionSlider } from './PrecisionSlider';

interface QualifierPanelProps {
  qualifier: QualifierState;
  onChange: (next: QualifierState) => void;
  onCommit?: () => void;
}

export const QualifierPanel: React.FC<QualifierPanelProps> = ({
  qualifier,
  onChange,
  onCommit,
}) => {
  const update = <K extends keyof QualifierState>(key: K, val: QualifierState[K]) => {
    const autoEnable = key !== 'enabled' && key !== 'showMatte' ? { enabled: true } : {};
    onChange({ ...qualifier, ...autoEnable, [key]: val });
  };

  // Visualize Hue center & width on a 0..360 bar
  const hueStart = (qualifier.hueCenter - qualifier.hueWidth * 0.5 + 360) % 360;
  const widthPct = Math.min(100, (qualifier.hueWidth / 360) * 100);
  const leftPct = (hueStart / 360) * 100;

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      {/* Top Controls */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onChange({ ...qualifier, enabled: !qualifier.enabled });
              onCommit?.();
            }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              qualifier.enabled
                ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#E5892E]'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {qualifier.enabled ? 'HSL Key Active' : 'Enable HSL Keyer'}
          </button>

          <button
            type="button"
            onClick={() =>
              onChange({
                ...qualifier,
                enabled: true,
                showMatte: !qualifier.showMatte,
              })
            }
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              qualifier.showMatte
                ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#E5892E]'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            {qualifier.showMatte ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Highlight Matte
          </button>

          <button
            type="button"
            onClick={() => {
              onChange({ ...qualifier, enabled: true, invert: !qualifier.invert });
              onCommit?.();
            }}
            className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              qualifier.invert
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/[0.08] bg-[#18181D] text-[#A0A0AA] hover:text-white'
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Invert Selection
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(createDefaultQualifier());
            onCommit?.();
          }}
          className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Qualifier
        </button>
      </div>

      {/* Main Content: Left HSL Key Ranges + Right Secondary Grading Controls */}
      <div className="grid min-h-0 flex-1 grid-cols-12 items-center gap-6">
        {/* Matte Isolation Ranges (7 cols) */}
        <div className="col-span-7 flex flex-col gap-3 border-r border-white/[0.07] pr-6">
          {/* Hue Range Visual Strip */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#D4D4DC]">Hue Key Spectrum</span>
              <span className="font-mono-num text-[#8E8E98]">
                Center {qualifier.hueCenter.toFixed(0)}° · Width {qualifier.hueWidth.toFixed(0)}°
              </span>
            </div>
            <div
              className="relative h-3.5 w-full overflow-hidden rounded border border-white/10"
              style={{
                background:
                  'linear-gradient(90deg, #EF4444 0%, #EAB308 16.7%, #22C55E 33.3%, #06B6D4 50%, #3B82F6 66.7%, #EC4899 83.3%, #EF4444 100%)',
              }}
            >
              <div className="absolute inset-0 bg-black/55" />
              <div
                className="absolute top-0 bottom-0 border-x border-white bg-transparent"
                style={{
                  left: `${leftPct}%`,
                  width: `${Math.min(widthPct, 100 - leftPct)}%`,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                }}
              />
              {leftPct + widthPct > 100 && (
                <div
                  className="absolute top-0 bottom-0 border-r border-white"
                  style={{ left: '0%', width: `${leftPct + widthPct - 100}%` }}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            <PrecisionSlider
              label="Hue Center"
              value={qualifier.hueCenter}
              min={0}
              max={360}
              step={1}
              defaultValue={30}
              decimals={0}
              unit="°"
              compact
              onChange={(v) => update('hueCenter', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Hue Width"
              value={qualifier.hueWidth}
              min={5}
              max={180}
              step={1}
              defaultValue={45}
              decimals={0}
              unit="°"
              compact
              onChange={(v) => update('hueWidth', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Hue Softness"
              value={qualifier.hueSoftness}
              min={0}
              max={90}
              step={1}
              defaultValue={18}
              decimals={0}
              unit="°"
              compact
              onChange={(v) => update('hueSoftness', v)}
              onCommit={onCommit}
            />

            <PrecisionSlider
              label="Sat Low"
              value={qualifier.satMin}
              min={0}
              max={Math.max(0.05, qualifier.satMax - 0.02)}
              step={0.01}
              defaultValue={0.15}
              compact
              onChange={(v) => update('satMin', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Sat High"
              value={qualifier.satMax}
              min={Math.min(0.95, qualifier.satMin + 0.02)}
              max={1}
              step={0.01}
              defaultValue={1}
              compact
              onChange={(v) => update('satMax', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Sat Soft"
              value={qualifier.satSoftness}
              min={0}
              max={0.5}
              step={0.01}
              defaultValue={0.12}
              compact
              onChange={(v) => update('satSoftness', v)}
              onCommit={onCommit}
            />

            <PrecisionSlider
              label="Luma Low"
              value={qualifier.lumMin}
              min={0}
              max={Math.max(0.05, qualifier.lumMax - 0.02)}
              step={0.01}
              defaultValue={0.12}
              compact
              onChange={(v) => update('lumMin', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Luma High"
              value={qualifier.lumMax}
              min={Math.min(0.95, qualifier.lumMin + 0.02)}
              max={1}
              step={0.01}
              defaultValue={0.92}
              compact
              onChange={(v) => update('lumMax', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Luma Soft"
              value={qualifier.lumSoftness}
              min={0}
              max={0.5}
              step={0.01}
              defaultValue={0.12}
              compact
              onChange={(v) => update('lumSoftness', v)}
              onCommit={onCommit}
            />
          </div>
        </div>

        {/* Secondary Grade Applied Strictly Inside Matte (5 cols) */}
        <div className="col-span-5 flex items-center gap-5">
          <div className="w-36 shrink-0">
            <ColorWheel
              label="Keyed Tint"
              x={qualifier.secTintX}
              y={qualifier.secTintY}
              masterValue={qualifier.secGamma}
              masterLabel="Gam"
              masterMin={-0.5}
              masterMax={0.5}
              masterDefault={0}
              size={118}
              onChangeWheel={(x, y) =>
                onChange({ ...qualifier, enabled: true, secTintX: x, secTintY: y })
              }
              onChangeMaster={(secGamma) => update('secGamma', secGamma)}
              onReset={() =>
                onChange({ ...qualifier, secTintX: 0, secTintY: 0, secGamma: 0 })
              }
              onCommit={onCommit}
            />
          </div>

          <div className="flex flex-1 flex-col gap-3">
            <div className="text-xs font-medium text-[#D4D4DC]">Secondary Grade</div>
            <PrecisionSlider
              label="Hue Shift"
              value={qualifier.secHueShift}
              min={-180}
              max={180}
              step={1}
              defaultValue={0}
              decimals={0}
              unit="°"
              onChange={(v) => update('secHueShift', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Saturation"
              value={qualifier.secSaturation}
              min={0}
              max={2}
              step={0.01}
              defaultValue={1}
              onChange={(v) => update('secSaturation', v)}
              onCommit={onCommit}
            />
            <PrecisionSlider
              label="Luminance Gain"
              value={qualifier.secGain}
              min={0.2}
              max={2}
              step={0.01}
              defaultValue={1}
              onChange={(v) => update('secGain', v)}
              onCommit={onCommit}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
