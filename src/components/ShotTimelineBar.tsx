import React from 'react';
import { Clipboard, ClipboardPaste, Pause, Play, Scissors, Trash2 } from 'lucide-react';
import type { VideoShot } from '../types/grading';

interface ShotTimelineBarProps {
  shots: VideoShot[];
  activeShotId: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  hasCopiedGrade: boolean;
  onTogglePlay: () => void;
  onSeek: (sec: number) => void;
  onSelectShot: (shot: VideoShot) => void;
  onSplitAtPlayhead: () => void;
  onCopyShotGrade: () => void;
  onPasteShotGrade: () => void;
  onMergeShot: (shotId: string) => void;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export const ShotTimelineBar: React.FC<ShotTimelineBarProps> = ({
  shots,
  activeShotId,
  currentTime,
  duration,
  playing,
  hasCopiedGrade,
  onTogglePlay,
  onSeek,
  onSelectShot,
  onSplitAtPlayhead,
  onCopyShotGrade,
  onPasteShotGrade,
  onMergeShot,
}) => {
  const safeDur = Math.max(0.1, duration);
  const playheadPct = Math.max(0, Math.min(100, (currentTime / safeDur) * 100));

  return (
    <div className="flex flex-col gap-1.5 border-t border-white/[0.07] bg-[#101014] px-3.5 py-2">
      {/* Row 1: Transport + Shot Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex h-6 w-6 items-center justify-center rounded bg-[#222228] text-white transition-colors hover:bg-[#E5892E] hover:text-black"
            title="Play / Pause (Space)"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <span className="font-mono-num text-[11px] text-[#D4D4DC]">
            {fmtTime(currentTime)} <span className="text-[#6E6E78]">/</span> {fmtTime(duration)}
          </span>

          <div className="mx-1 h-3.5 w-[1px] bg-white/[0.08]" />

          <button
            type="button"
            onClick={onSplitAtPlayhead}
            title="Split shot at playhead to grade the next shot independently (C)"
            className="flex items-center gap-1 rounded border border-[#E5892E]/45 bg-[#E5892E]/10 px-2 py-0.5 text-[11px] font-medium text-[#E5892E] transition-colors hover:bg-[#E5892E]/20 whitespace-nowrap"
          >
            <Scissors className="h-3 w-3" />
            Split Shot (C)
          </button>

          <button
            type="button"
            onClick={onCopyShotGrade}
            title="Copy current shot's node graph"
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#18181D] px-2 py-0.5 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white whitespace-nowrap"
          >
            <Clipboard className="h-3 w-3" />
            Copy Grade
          </button>

          <button
            type="button"
            disabled={!hasCopiedGrade}
            onClick={onPasteShotGrade}
            title="Paste copied node graph into active shot"
            className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#18181D] px-2 py-0.5 text-[11px] text-[#A0A0AA] transition-colors hover:border-white/20 hover:text-white disabled:opacity-35 whitespace-nowrap"
          >
            <ClipboardPaste className="h-3 w-3" />
            Paste Grade
          </button>

          {shots.length > 1 && (
            <button
              type="button"
              onClick={() => onMergeShot(activeShotId)}
              title="Remove cut and merge active shot with neighbor"
              className="flex items-center gap-1 rounded border border-white/[0.08] bg-[#18181D] px-2 py-0.5 text-[11px] text-[#8E8E98] transition-colors hover:border-red-500/40 hover:text-red-400 whitespace-nowrap"
            >
              <Trash2 className="h-3 w-3" />
              Remove Cut
            </button>
          )}
        </div>

        <span className="font-mono-num text-[10px] text-[#8E8E98]">
          {shots.length} {shots.length === 1 ? 'Shot' : 'Shots'} · Active:{' '}
          <span className="text-[#ECECEF]">
            {shots.find((s) => s.id === activeShotId)?.name ?? 'Shot 01'}
          </span>
        </span>
      </div>

      {/* Row 2: Proportional Multi-Shot Cut Strip + Interactive Playhead */}
      <div className="relative flex h-7 w-full items-stretch overflow-hidden rounded border border-white/[0.08] bg-[#0B0B0E]">
        {shots.map((shot) => {
          const widthPct = Math.max(2, ((shot.endSec - shot.startSec) / safeDur) * 100);
          const isActive = shot.id === activeShotId;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => onSelectShot(shot)}
              style={{ width: `${widthPct}%` }}
              title={`${shot.name} (${fmtTime(shot.startSec)} – ${fmtTime(shot.endSec)})`}
              className={`relative flex h-full min-w-0 items-center justify-between border-r border-black/80 px-2 text-left transition-colors last:border-r-0 ${
                isActive
                  ? 'bg-[#E5892E]/22 text-[#ECECEF]'
                  : 'bg-[#18181E] text-[#8E8E98] hover:bg-[#22222A] hover:text-white'
              }`}
            >
              <span className="truncate text-[10px] font-semibold">{shot.name}</span>
              <span className="font-mono-num ml-1 hidden shrink-0 text-[9px] opacity-70 sm:inline">
                {fmtTime(shot.startSec)}–{fmtTime(shot.endSec)}
              </span>
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#E5892E]" />
              )}
            </button>
          );
        })}

        {/* Scrubbable Playhead Overlay */}
        <input
          type="range"
          aria-label="Video timeline scrub"
          min={0}
          max={safeDur}
          step={0.01}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-20 w-[2px] bg-[#E5892E] shadow-[0_0_6px_rgba(229,137,46,0.9)]"
          style={{ left: `${playheadPct}%` }}
        />
      </div>
    </div>
  );
};
