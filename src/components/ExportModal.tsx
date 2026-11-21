import React, { useState } from 'react';
import { Download, FileCode2, Image as ImageIcon, X } from 'lucide-react';

interface ExportModalProps {
  open: boolean;
  initialTab: 'frame' | 'lut';
  sourceDimensions: { width: number; height: number };
  mediaName: string;
  onClose: () => void;
  onExportImage: (format: 'image/png' | 'image/jpeg' | 'image/webp', quality: number) => void;
  onExportCubeLut: (size: 17 | 33, title: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  initialTab,
  sourceDimensions,
  mediaName,
  onClose,
  onExportImage,
  onExportCubeLut,
}) => {
  const [tab, setTab] = useState<'frame' | 'lut'>(initialTab);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(0.95);
  const [lutSize, setLutSize] = useState<17 | 33>(33);
  const [lutTitle, setLutTitle] = useState('ChromaGrade_Look');

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#141418] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
          <h2 className="text-sm font-semibold text-[#ECECEF]">Export Delivery</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#8E8E98] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="mt-4 flex gap-1 rounded bg-[#0E0E11] p-1 border border-white/[0.06]">
          <button
            type="button"
            onClick={() => setTab('frame')}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'frame'
                ? 'bg-[#25252B] text-white'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Graded Frame
          </button>
          <button
            type="button"
            onClick={() => setTab('lut')}
            className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'lut'
                ? 'bg-[#25252B] text-white'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            3D .cube LUT
          </button>
        </div>

        {tab === 'frame' ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-[#8E8E98]">
              <span>Source Resolution</span>
              <span className="font-mono-num text-[#ECECEF]">
                {sourceDimensions.width} × {sourceDimensions.height} px
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#A0A0AA]">File Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'image/png', label: 'PNG Lossless' },
                    { id: 'image/jpeg', label: 'JPEG' },
                    { id: 'image/webp', label: 'WebP' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={`rounded border py-2 text-xs font-medium transition-colors ${
                      format === f.id
                        ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                        : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {format !== 'image/png' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A0A0AA]">Compression Quality</span>
                  <span className="font-mono-num text-[#E5892E]">
                    {Math.round(quality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-[#E5892E]"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onExportImage(format, quality);
                onClose();
              }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded bg-[#E5892E] px-4 py-2.5 text-xs font-semibold text-[#0C0C0E] transition-colors hover:bg-[#EE9842]"
            >
              <Download className="h-4 w-4" />
              Export {mediaName}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-[#8E8E98]">
              Bakes your entire enabled serial node pipeline (Primary/Log wheels, HDR zones, Curves, Qualifier, Split Toning, and loaded LUTs) directly on the GPU into an industry-standard Adobe/DaVinci 3D .cube LUT.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#A0A0AA]">LUT Title</label>
              <input
                type="text"
                value={lutTitle}
                onChange={(e) => setLutTitle(e.target.value)}
                className="rounded border border-white/10 bg-[#0E0E11] px-3 py-2 text-xs text-white outline-none focus:border-[#E5892E]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#A0A0AA]">3D Cube Lattice Precision</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLutSize(33)}
                  className={`rounded border py-2 text-xs font-medium transition-colors ${
                    lutSize === 33
                      ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                      : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white'
                  }`}
                >
                  33 × 33 × 33 (Cinema)
                </button>
                <button
                  type="button"
                  onClick={() => setLutSize(17)}
                  className={`rounded border py-2 text-xs font-medium transition-colors ${
                    lutSize === 17
                      ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                      : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white'
                  }`}
                >
                  17 × 17 × 17 (Compact)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onExportCubeLut(lutSize, lutTitle);
                onClose();
              }}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded bg-[#E5892E] px-4 py-2.5 text-xs font-semibold text-[#0C0C0E] transition-colors hover:bg-[#EE9842]"
            >
              <Download className="h-4 w-4" />
              Download .cube 3D LUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
