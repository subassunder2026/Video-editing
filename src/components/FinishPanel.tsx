import React, { useRef, useState } from 'react';
import { FileUp, RotateCcw, Trash2 } from 'lucide-react';
import { parseCubeLut } from '../engine/cubeLut';
import { createDefaultFinish, type CubeLutData, type FinishState } from '../types/grading';
import { PrecisionSlider } from './PrecisionSlider';

interface FinishPanelProps {
  finish: FinishState;
  lut: CubeLutData | null;
  onChangeFinish: (next: FinishState) => void;
  onChangeLut: (lut: CubeLutData | null, lutName: string | null) => void;
  onCommit?: () => void;
}

export const FinishPanel: React.FC<FinishPanelProps> = ({
  finish,
  lut,
  onChangeFinish,
  onChangeLut,
  onCommit,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lutError, setLutError] = useState<string | null>(null);

  const update = <K extends keyof FinishState>(key: K, val: FinishState[K]) => {
    onChangeFinish({ ...finish, [key]: val });
  };

  const handleLutFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLutError(null);
    try {
      const text = await file.text();
      const parsed = parseCubeLut(text, file.name.replace(/\.cube$/i, ''));
      onChangeLut(parsed, parsed.title);
      onCommit?.();
    } catch (err) {
      setLutError(err instanceof Error ? err.message : 'Unable to parse .cube file.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col justify-between gap-2.5">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
        <div className="text-xs font-medium text-[#D4D4DC]">
          Creative Finishing, Optical Film Emulation & 3D LUT Input
        </div>
        <button
          type="button"
          onClick={() => {
            onChangeFinish(createDefaultFinish());
            onChangeLut(null, null);
            onCommit?.();
          }}
          className="flex items-center gap-1.5 rounded border border-white/[0.08] px-2.5 py-1 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
        >
          <RotateCcw className="h-3 w-3" />
          Reset Finish
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-6 pt-1">
        {/* Column 1: Split Toning */}
        <div className="flex flex-col gap-2.5 border-r border-white/[0.06] pr-5">
          <div className="text-xs font-semibold text-[#ECECEF]">Split Toning</div>
          <PrecisionSlider
            label="Shadow Hue"
            value={finish.splitShadowHue}
            min={0}
            max={360}
            step={1}
            defaultValue={215}
            decimals={0}
            unit="°"
            compact
            trackGradient="linear-gradient(90deg, #EF4444 0%, #EAB308 16.7%, #22C55E 33.3%, #06B6D4 50%, #3B82F6 66.7%, #EC4899 83.3%, #EF4444 100%)"
            onChange={(v) => update('splitShadowHue', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Shadow Saturation"
            value={finish.splitShadowSat}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('splitShadowSat', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Highlight Hue"
            value={finish.splitHighlightHue}
            min={0}
            max={360}
            step={1}
            defaultValue={38}
            decimals={0}
            unit="°"
            compact
            trackGradient="linear-gradient(90deg, #EF4444 0%, #EAB308 16.7%, #22C55E 33.3%, #06B6D4 50%, #3B82F6 66.7%, #EC4899 83.3%, #EF4444 100%)"
            onChange={(v) => update('splitHighlightHue', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Highlight Saturation"
            value={finish.splitHighlightSat}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('splitHighlightSat', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Tonal Balance"
            value={finish.splitBalance}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('splitBalance', v)}
            onCommit={onCommit}
          />
        </div>

        {/* Column 2: Vignette */}
        <div className="flex flex-col gap-2.5 border-r border-white/[0.06] pr-5">
          <div className="text-xs font-semibold text-[#ECECEF]">Optical Vignette</div>
          <PrecisionSlider
            label="Amount"
            value={finish.vignetteAmount}
            min={-1}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('vignetteAmount', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Midpoint"
            value={finish.vignetteMidpoint}
            min={0.1}
            max={0.9}
            step={0.01}
            defaultValue={0.58}
            compact
            onChange={(v) => update('vignetteMidpoint', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Roundness"
            value={finish.vignetteRoundness}
            min={0.2}
            max={1.5}
            step={0.01}
            defaultValue={0.85}
            compact
            onChange={(v) => update('vignetteRoundness', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Feather"
            value={finish.vignetteFeather}
            min={0.1}
            max={1.0}
            step={0.01}
            defaultValue={0.55}
            compact
            onChange={(v) => update('vignetteFeather', v)}
            onCommit={onCommit}
          />
        </div>

        {/* Column 3: Halation & Film Grain */}
        <div className="flex flex-col gap-2.5 border-r border-white/[0.06] pr-5">
          <div className="text-xs font-semibold text-[#ECECEF]">Film Halation & Grain</div>
          <PrecisionSlider
            label="Halation Strength"
            value={finish.halationAmount}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('halationAmount', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Halation Threshold"
            value={finish.halationThreshold}
            min={0.4}
            max={0.98}
            step={0.01}
            defaultValue={0.78}
            compact
            onChange={(v) => update('halationThreshold', v)}
            onCommit={onCommit}
          />
          <div className="my-0.5 h-[1px] bg-white/[0.06]" />
          <PrecisionSlider
            label="Film Grain Amount"
            value={finish.grainAmount}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            compact
            onChange={(v) => update('grainAmount', v)}
            onCommit={onCommit}
          />
          <PrecisionSlider
            label="Grain Size"
            value={finish.grainSize}
            min={0.5}
            max={3.0}
            step={0.05}
            defaultValue={1.2}
            compact
            onChange={(v) => update('grainSize', v)}
            onCommit={onCommit}
          />
        </div>

        {/* Column 4: 3D .CUBE LUT Loader */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold text-[#ECECEF]">3D LUT (.cube)</div>
          <input
            ref={fileRef}
            type="file"
            accept=".cube,.CUBE"
            onChange={handleLutFile}
            className="hidden"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded border border-white/15 bg-[#1B1B20] px-3 py-2 text-xs font-medium text-[#ECECEF] transition-colors hover:border-[#E5892E]/60 hover:bg-[#222228] whitespace-nowrap"
            >
              <FileUp className="h-3.5 w-3.5 text-[#E5892E]" />
              {lut ? 'Replace .cube LUT' : 'Load .cube 3D LUT'}
            </button>
            {lut && (
              <button
                type="button"
                onClick={() => {
                  onChangeLut(null, null);
                  onCommit?.();
                }}
                title="Remove LUT from node"
                className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-[#8E8E98] transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {lut ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-[11px] text-[#A0A0AA]">
                <span className="font-medium text-[#ECECEF]">{lut.title}</span>
                <span className="mx-1.5 text-[#5A5A64]">·</span>
                <span className="font-mono-num">{lut.size}×{lut.size}×{lut.size}</span>
              </div>
              <PrecisionSlider
                label="LUT Intensity"
                value={finish.lutMix}
                min={0}
                max={1}
                step={0.01}
                defaultValue={1}
                onChange={(v) => update('lutMix', v)}
                onCommit={onCommit}
              />
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#787882]">
              Import any standard 17³ / 33³ / 65³ Adobe or DaVinci .cube 3D LUT for real-time trilinear GPU processing on this node.
            </p>
          )}

          {lutError && <p className="text-[11px] text-red-400">{lutError}</p>}
        </div>
      </div>
    </div>
  );
};
