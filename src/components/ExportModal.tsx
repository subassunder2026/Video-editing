import React, { useEffect, useState } from 'react';
import { Download, FileCode2, Film, Image as ImageIcon, Loader2, X } from 'lucide-react';

export interface VideoExportOptions {
  container: 'mp4' | 'webm';
  bitrateMbps: 8 | 16 | 30;
  fps: 30 | 60;
  includeAudio: boolean;
}

export interface VideoExportProgress {
  active: boolean;
  percent: number;
  currentSec: number;
  durationSec: number;
  error: string | null;
}

interface ExportModalProps {
  open: boolean;
  initialTab: 'video' | 'frame' | 'lut';
  mediaType: 'image' | 'video';
  videoDuration: number;
  sourceDimensions: { width: number; height: number };
  mediaName: string;
  videoProgress: VideoExportProgress;
  onClose: () => void;
  onExportVideo: (options: VideoExportOptions) => void;
  onCancelVideoExport: () => void;
  onExportImage: (format: 'image/png' | 'image/jpeg' | 'image/webp', quality: number) => void;
  onExportCubeLut: (size: 17 | 33, title: string) => void;
}

function detectMp4Support(): boolean {
  if (typeof MediaRecorder === 'undefined') return false;
  return (
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E,mp4a.40.2') ||
    MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ||
    MediaRecorder.isTypeSupported('video/mp4')
  );
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  initialTab,
  mediaType,
  videoDuration,
  sourceDimensions,
  mediaName,
  videoProgress,
  onClose,
  onExportVideo,
  onCancelVideoExport,
  onExportImage,
  onExportCubeLut,
}) => {
  const [tab, setTab] = useState<'video' | 'frame' | 'lut'>(initialTab);
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(0.95);
  const [lutSize, setLutSize] = useState<17 | 33>(33);
  const [lutTitle, setLutTitle] = useState('ChromaGrade_Look');

  const mp4Supported = detectMp4Support();
  const [container, setContainer] = useState<'mp4' | 'webm'>(mp4Supported ? 'mp4' : 'webm');
  const [bitrateMbps, setBitrateMbps] = useState<8 | 16 | 30>(16);
  const [fps, setFps] = useState<30 | 60>(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={() => {
        if (!videoProgress.active) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#141418] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
          <h2 className="text-sm font-semibold text-[#ECECEF]">Export Delivery</h2>
          <button
            type="button"
            disabled={videoProgress.active}
            onClick={onClose}
            className="rounded p-1 text-[#8E8E98] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="mt-4 flex gap-1 rounded border border-white/[0.06] bg-[#0E0E11] p-1">
          <button
            type="button"
            disabled={videoProgress.active}
            onClick={() => setTab('video')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'video'
                ? 'bg-[#25252B] text-white'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            Graded Video
          </button>
          <button
            type="button"
            disabled={videoProgress.active}
            onClick={() => setTab('frame')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
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
            disabled={videoProgress.active}
            onClick={() => setTab('lut')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'lut'
                ? 'bg-[#25252B] text-white'
                : 'text-[#8E8E98] hover:text-white'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            3D .cube LUT
          </button>
        </div>

        {tab === 'video' && (
          <div className="mt-4 flex flex-col gap-4">
            {mediaType !== 'video' ? (
              <div className="rounded border border-white/[0.08] bg-[#101014] p-4 text-xs leading-relaxed text-[#A0A0AA]">
                Currently grading a still image (<strong className="text-[#ECECEF]">{mediaName}</strong>). Import a video file (MP4, WebM, MOV) via <strong className="text-[#ECECEF]">Import Media</strong> or drag-and-drop it onto the viewer to render and download a graded video.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-[#8E8E98]">
                  <span>Video Source</span>
                  <span className="font-mono-num text-[#ECECEF]">
                    {sourceDimensions.width} × {sourceDimensions.height} · {videoDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Container Format */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#A0A0AA]">Video Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={videoProgress.active || !mp4Supported}
                      onClick={() => setContainer('mp4')}
                      className={`rounded border py-2 text-xs font-medium transition-colors ${
                        container === 'mp4'
                          ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                          : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white disabled:opacity-40'
                      }`}
                    >
                      MP4 (H.264) {!mp4Supported ? '· Unsupported' : ''}
                    </button>
                    <button
                      type="button"
                      disabled={videoProgress.active}
                      onClick={() => setContainer('webm')}
                      className={`rounded border py-2 text-xs font-medium transition-colors ${
                        container === 'webm'
                          ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                          : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white'
                      }`}
                    >
                      WebM (VP9)
                    </button>
                  </div>
                </div>

                {/* Bitrate Quality */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#A0A0AA]">Export Bitrate</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { val: 8, label: '8 Mbps' },
                        { val: 16, label: '16 Mbps' },
                        { val: 30, label: '30 Mbps' },
                      ] as const
                    ).map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        disabled={videoProgress.active}
                        onClick={() => setBitrateMbps(b.val)}
                        className={`font-mono-num rounded border py-2 text-xs font-medium transition-colors ${
                          bitrateMbps === b.val
                            ? 'border-[#E5892E] bg-[#E5892E]/15 text-[#ECECEF]'
                            : 'border-white/[0.08] bg-[#1B1B20] text-[#8E8E98] hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS & Audio */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#A0A0AA]">Frame Rate</span>
                    <div className="flex rounded border border-white/[0.08] bg-[#0E0E11] p-0.5">
                      {([30, 60] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={videoProgress.active}
                          onClick={() => setFps(r)}
                          className={`font-mono-num rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            fps === r
                              ? 'bg-[#25252B] text-white'
                              : 'text-[#8E8E98] hover:text-white'
                          }`}
                        >
                          {r} fps
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[#D4D4DC]">
                    <input
                      type="checkbox"
                      disabled={videoProgress.active}
                      checked={includeAudio}
                      onChange={(e) => setIncludeAudio(e.target.checked)}
                      className="accent-[#E5892E]"
                    />
                    Keep Audio
                  </label>
                </div>

                {/* Live Rendering Progress */}
                {videoProgress.active && (
                  <div className="flex flex-col gap-1.5 rounded border border-[#E5892E]/30 bg-[#1B1814] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#ECECEF]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E5892E]" />
                        Rendering Graded Video…
                      </span>
                      <span className="font-mono-num text-[#E5892E]">
                        {Math.round(videoProgress.percent)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                      <div
                        className="h-full bg-[#E5892E] transition-[width] duration-150"
                        style={{ width: `${Math.min(100, videoProgress.percent)}%` }}
                      />
                    </div>
                    <div className="font-mono-num flex items-center justify-between text-[10px] text-[#8E8E98]">
                      <span>Keep this tab visible while encoding</span>
                      <span>
                        {videoProgress.currentSec.toFixed(1)}s / {videoProgress.durationSec.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                )}

                {videoProgress.error && (
                  <p className="text-xs text-red-400">{videoProgress.error}</p>
                )}

                {videoProgress.active ? (
                  <button
                    type="button"
                    onClick={onCancelVideoExport}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-[#1B1B20] px-4 py-2.5 text-xs font-semibold text-[#ECECEF] transition-colors hover:border-red-500/50 hover:text-red-300"
                  >
                    Cancel Render
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onExportVideo({ container, bitrateMbps, fps, includeAudio })
                    }
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded bg-[#E5892E] px-4 py-2.5 text-xs font-semibold text-[#0C0C0E] transition-colors hover:bg-[#EE9842]"
                  >
                    <Download className="h-4 w-4" />
                    Render & Download Graded Video
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'frame' && (
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
              Export {mediaName} Frame
            </button>
          </div>
        )}

        {tab === 'lut' && (
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
