import React, { useState } from 'react';
import { Camera, Film, Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { LOOK_PRESETS } from '../data/presets';
import type { GradeNode, MediaItem, SnapshotStill } from '../types/grading';

interface MediaDrawerProps {
  open: boolean;
  initialSection: 'media' | 'looks' | 'snapshots';
  mediaItems: MediaItem[];
  activeMediaId: string;
  snapshots: SnapshotStill[];
  onClose: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onUploadMedia: () => void;
  onApplyPreset: (nodes: GradeNode[]) => void;
  onGrabSnapshot: () => void;
  onApplySnapshot: (snap: SnapshotStill) => void;
  onDeleteSnapshot: (id: string) => void;
}

export const MediaDrawer: React.FC<MediaDrawerProps> = ({
  open,
  initialSection,
  mediaItems,
  activeMediaId,
  snapshots,
  onClose,
  onSelectMedia,
  onUploadMedia,
  onApplyPreset,
  onGrabSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
}) => {
  const [section, setSection] = useState<'media' | 'looks' | 'snapshots'>(initialSection);

  React.useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  if (!open) return null;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#121216]">
      {/* Drawer Tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'media', label: 'Media' },
              { id: 'looks', label: 'Looks' },
              { id: 'snapshots', label: 'Stills' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                section === tab.id
                  ? 'bg-[#25252B] text-white'
                  : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close Panel"
          className="rounded p-1 text-[#787882] transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        {section === 'media' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onUploadMedia}
              className="flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-[#1B1B20] px-3 py-2 text-xs font-medium text-[#ECECEF] transition-colors hover:border-[#E5892E]/60 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 text-[#E5892E]" />
              Import Image or Video
            </button>

            <div className="flex flex-col gap-2">
              {mediaItems.map((item) => {
                const isActive = item.id === activeMediaId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectMedia(item)}
                    className={`group flex flex-col overflow-hidden rounded border text-left transition-colors ${
                      isActive
                        ? 'border-[#E5892E] bg-[#1D1B18]'
                        : 'border-white/[0.07] bg-[#16161B] hover:border-white/20'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-[#0A0A0D]">
                      {item.type === 'image' ? (
                        <img
                          src={item.src}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#101014] text-[#8E8E98]">
                          <Film className="h-6 w-6 text-[#E5892E]" />
                        </div>
                      )}
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="truncate text-xs font-medium text-[#ECECEF]">
                        {item.name}
                      </div>
                      {item.subtitle && (
                        <div className="truncate text-[10px] text-[#787882]">{item.subtitle}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {section === 'looks' && (
          <div className="flex flex-col gap-2">
            {LOOK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.buildNodes())}
                className="flex flex-col gap-0.5 rounded border border-white/[0.07] bg-[#16161B] px-3 py-2.5 text-left transition-colors hover:border-[#E5892E]/60 hover:bg-[#1C1C22]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#ECECEF]">{preset.name}</span>
                  <span className="text-[10px] text-[#787882]">{preset.category}</span>
                </div>
                <p className="text-[11px] leading-snug text-[#8E8E98]">{preset.description}</p>
              </button>
            ))}
          </div>
        )}

        {section === 'snapshots' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onGrabSnapshot}
              className="flex w-full items-center justify-center gap-2 rounded border border-white/15 bg-[#1B1B20] px-3 py-2 text-xs font-medium text-[#ECECEF] transition-colors hover:border-[#E5892E]/60 whitespace-nowrap"
            >
              <Camera className="h-3.5 w-3.5 text-[#E5892E]" />
              Grab Still Snapshot
            </button>

            {snapshots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded border border-dashed border-white/10 px-4 py-8 text-center">
                <ImageIcon className="h-5 w-5 text-[#5A5A64]" />
                <p className="text-xs text-[#8E8E98]">No grade snapshots saved yet.</p>
                <p className="text-[11px] text-[#686872]">
                  Grab a still to store the current node graph and compare looks instantaneously.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="group overflow-hidden rounded border border-white/[0.08] bg-[#16161B]"
                  >
                    <button
                      type="button"
                      onClick={() => onApplySnapshot(snap)}
                      className="block w-full text-left"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-black">
                        <img
                          src={snap.thumbnailDataUrl}
                          alt={snap.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>
                    <div className="flex items-center justify-between px-2.5 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-[#ECECEF]">
                          {snap.name}
                        </div>
                        <div className="font-mono-num text-[10px] text-[#787882]">
                          {snap.createdAt} · {snap.nodes.length} node{snap.nodes.length > 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteSnapshot(snap.id)}
                        title="Delete Snapshot"
                        className="rounded p-1 text-[#686872] transition-colors hover:bg-white/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
