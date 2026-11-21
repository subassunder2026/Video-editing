import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Columns2,
  EyeOff,
  Flame,
  Redo2,
  RotateCcw,
  SplitSquareHorizontal,
  Undo2,
} from 'lucide-react';
import { CurveEditor } from './components/CurveEditor';
import {
  ExportModal,
  type VideoExportOptions,
  type VideoExportProgress,
} from './components/ExportModal';
import { FinishPanel } from './components/FinishPanel';
import { HdrPanel } from './components/HdrPanel';
import { MaskPanel } from './components/MaskPanel';
import { MediaDrawer } from './components/MediaDrawer';
import { NodePipeline } from './components/NodePipeline';
import { PrimaryPanel } from './components/PrimaryPanel';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { QualifierPanel } from './components/QualifierPanel';
import { ScopesPanel } from './components/ScopesPanel';
import { ShotTimelineBar } from './components/ShotTimelineBar';
import { SAMPLE_MEDIA } from './data/presets';
import { serializeCubeLut } from './engine/cubeLut';
import { WebGLColorGrader } from './engine/webglGrader';
import {
  cloneGradeNode,
  cloneNodes,
  createDefaultCurves,
  createGradeNode,
  type CompareMode,
  type CubeLutData,
  type CurvePoint,
  type CurvesState,
  type GradeNode,
  type MediaItem,
  type SnapshotStill,
  type ToolTab,
  type VideoShot,
  type ViewerOverlay,
} from './types/grading';

const MAX_HISTORY = 40;

const TOOL_TABS: Array<{ id: ToolTab; label: string }> = [
  { id: 'primaries', label: 'Primary Wheels' },
  { id: 'hdr', label: 'HDR Zones' },
  { id: 'curves', label: 'Curves' },
  { id: 'qualifier', label: 'HSL Qualifier' },
  { id: 'mask', label: 'Power Window' },
  { id: 'finish', label: 'Film & 3D LUT' },
];

function findShotAtTime(shots: VideoShot[], timeSec: number): VideoShot | null {
  if (shots.length === 0) return null;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (timeSec >= s.startSec && (timeSec < s.endSec || i === shots.length - 1)) {
      return s;
    }
  }
  return shots[shots.length - 1];
}

export default function App() {
  // Media library & active source
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(SAMPLE_MEDIA);
  const [activeMedia, setActiveMedia] = useState<MediaItem>(SAMPLE_MEDIA[0]);
  const [sourceDimensions, setSourceDimensions] = useState({ width: 1920, height: 1080 });
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Video & Multi-Shot Timeline state (when a video file is loaded)
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [shots, setShots] = useState<VideoShot[]>([]);
  const [activeShotId, setActiveShotId] = useState<string>('');
  const [copiedShotNodes, setCopiedShotNodes] = useState<GradeNode[] | null>(null);
  const shotsRef = useRef<VideoShot[]>([]);
  const activeShotIdRef = useRef<string>('');

  // Grading Serial Node Graph & Undo/Redo history
  const [nodes, setNodes] = useState<GradeNode[]>(() => [createGradeNode('Primary Balance', 'node_1')]);
  const [activeNodeId, setActiveNodeId] = useState<string>('node_1');
  const [history, setHistory] = useState<GradeNode[][]>(() => [
    cloneNodes([createGradeNode('Primary Balance', 'node_1')]),
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Workspace UI state
  const [activeTool, setActiveTool] = useState<ToolTab>('primaries');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerSection, setDrawerSection] = useState<'media' | 'looks' | 'snapshots'>('media');
  const [snapshots, setSnapshots] = useState<SnapshotStill[]>([]);

  // Viewer controls
  const [bypass, setBypass] = useState<boolean>(false);
  const [compareMode, setCompareMode] = useState<CompareMode>('normal');
  const [wipePos, setWipePos] = useState<number>(0.5);
  const [overlayMode, setOverlayMode] = useState<ViewerOverlay>('none');
  const [zoom, setZoom] = useState<'fit' | 1 | 1.5 | 2>('fit');
  const [hoverPixel, setHoverPixel] = useState<{ r: number; g: number; b: number; ire: number } | null>(null);

  // Export modal
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'video' | 'frame' | 'lut'>('frame');
  const [videoProgress, setVideoProgress] = useState<VideoExportProgress>({
    active: false,
    percent: 0,
    currentSec: 0,
    durationSec: 0,
    error: null,
  });
  const cancelVideoExportRef = useRef<(() => void) | null>(null);

  // WebGL & Scope refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graderRef = useRef<WebGLColorGrader | null>(null);
  const sourceElemRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scopePixelsRef = useRef<{ data: Uint8Array; width: number; height: number } | null>(null);
  const [scopeTick, setScopeTick] = useState<number>(0);
  const [lumaHistogram, setLumaHistogram] = useState<Float32Array>(() => new Float32Array(64));
  const lastScopeUpdateRef = useRef<number>(0);

  const activeNode = useMemo(
    () => nodes.find((n) => n.id === activeNodeId) ?? nodes[0],
    [nodes, activeNodeId]
  );

  // Push history snapshot on commit
  const commitHistory = useCallback(
    (nextNodes?: GradeNode[]) => {
      const snap = cloneNodes(nextNodes ?? nodes);
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        const appended = [...sliced, snap].slice(-MAX_HISTORY);
        setHistoryIndex(appended.length - 1);
        return appended;
      });
    },
    [nodes, historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    const targetIdx = historyIndex - 1;
    const restored = cloneNodes(history[targetIdx]);
    setHistoryIndex(targetIdx);
    setNodes(restored);
    if (!restored.some((n) => n.id === activeNodeId)) {
      setActiveNodeId(restored[0].id);
    }
  }, [history, historyIndex, activeNodeId]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const targetIdx = historyIndex + 1;
    const restored = cloneNodes(history[targetIdx]);
    setHistoryIndex(targetIdx);
    setNodes(restored);
    if (!restored.some((n) => n.id === activeNodeId)) {
      setActiveNodeId(restored[0].id);
    }
  }, [history, historyIndex, activeNodeId]);

  // Update active node helper
  const updateActiveNode = useCallback(
    (updater: (node: GradeNode) => GradeNode) => {
      setNodes((prev) => prev.map((n) => (n.id === activeNodeId ? updater(n) : n)));
    },
    [activeNodeId]
  );

  // Initialize WebGL2 Grader once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const grader = new WebGLColorGrader(canvas);
      graderRef.current = grader;
      return () => {
        grader.dispose();
        graderRef.current = null;
      };
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'WebGL2 initialization failed.');
    }
  }, []);

  // Helper to update scopes & histogram (throttled cleanly to ~30fps during drags)
  const refreshScopes = useCallback((force = false) => {
    const grader = graderRef.current;
    if (!grader) return;
    const now = performance.now();
    if (!force && now - lastScopeUpdateRef.current < 32) return;
    lastScopeUpdateRef.current = now;

    const read = grader.readScopePixels();
    scopePixelsRef.current = read;
    setScopeTick((t) => t + 1);

    // Compute compact 64-bin luma histogram for CurveEditor backdrop
    const bins = new Float32Array(64);
    const d = read.data;
    for (let i = 0; i < d.length; i += 8) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const b = Math.min(63, Math.floor((l / 255) * 64));
      bins[b]++;
    }
    setLumaHistogram(bins);
  }, []);

  // Render pipeline trigger
  const triggerRender = useCallback(
    (forceScopes = false, timeSeed = 1.0) => {
      const grader = graderRef.current;
      if (!grader || !sourceElemRef.current) return;
      grader.render({
        nodes,
        activeNodeId,
        bypass,
        compareMode,
        wipePos,
        overlayMode,
        timeSeed,
      });
      refreshScopes(forceScopes);
    },
    [nodes, activeNodeId, bypass, compareMode, wipePos, overlayMode, refreshScopes]
  );

  // Keep refs synced with shots & activeShotId for 60fps video loops & export
  useEffect(() => {
    shotsRef.current = shots;
  }, [shots]);

  useEffect(() => {
    activeShotIdRef.current = activeShotId;
  }, [activeShotId]);

  // Whenever nodes/activeNodeId change while grading a video, persist them into the active VideoShot
  useEffect(() => {
    if (activeMedia.type !== 'video' || !activeShotId) return;
    setShots((prev) =>
      prev.map((s) =>
        s.id === activeShotId ? { ...s, nodes, activeNodeId } : s
      )
    );
  }, [activeMedia.type, activeShotId, nodes, activeNodeId]);

  // Load active media item (Image or Video)
  useEffect(() => {
    setMediaError(null);
    setVideoPlaying(false);
    setVideoTime(0);
    setVideoDuration(0);
    setShots([]);
    setActiveShotId('');

    // Clean up old video element if any
    if (sourceElemRef.current instanceof HTMLVideoElement) {
      sourceElemRef.current.pause();
    }

    if (activeMedia.type === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        sourceElemRef.current = img;
        if (graderRef.current) {
          graderRef.current.setSource(img);
          setSourceDimensions(graderRef.current.getSourceDimensions());
          triggerRender(true);
        }
      };
      img.onerror = () => {
        setMediaError(`Failed to load "${activeMedia.name}".`);
      };
      img.src = activeMedia.src;
    } else {
      const video = document.createElement('video');
      video.src = activeMedia.src;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      video.onloadeddata = () => {
        sourceElemRef.current = video;
        const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
        setVideoDuration(dur);
        const initialNode = createGradeNode('Primary Balance', `node_${Date.now()}`);
        const initialShot: VideoShot = {
          id: `shot_${Date.now()}`,
          name: 'Shot 01',
          startSec: 0,
          endSec: dur,
          nodes: [initialNode],
          activeNodeId: initialNode.id,
        };
        setShots([initialShot]);
        setActiveShotId(initialShot.id);
        setNodes([initialNode]);
        setActiveNodeId(initialNode.id);
        if (graderRef.current) {
          graderRef.current.setSource(video);
          setSourceDimensions(graderRef.current.getSourceDimensions());
          graderRef.current.render({
            nodes: [initialNode],
            activeNodeId: initialNode.id,
            bypass,
            compareMode,
            wipePos,
            overlayMode,
            timeSeed: 1.0,
          });
          refreshScopes(true);
        }
      };
      video.onerror = () => {
        setMediaError(`Unable to decode video "${activeMedia.name}".`);
      };
      video.load();

      return () => {
        video.pause();
        video.src = '';
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia]);

  // Re-render whenever grading state changes
  useEffect(() => {
    triggerRender(false);
  }, [triggerRender]);

  // Switch active shot automatically when playhead enters a different shot time range
  const switchShotIfNeeded = useCallback((t: number) => {
    const list = shotsRef.current;
    if (list.length <= 1) return;
    const hit = findShotAtTime(list, t);
    if (hit && hit.id !== activeShotIdRef.current) {
      activeShotIdRef.current = hit.id;
      setActiveShotId(hit.id);
      setNodes(hit.nodes);
      setActiveNodeId(hit.activeNodeId);
    }
  }, []);

  // Video animation loop when playing (automatically evaluates per-shot node graph across cuts!)
  useEffect(() => {
    if (activeMedia.type !== 'video' || !videoPlaying) return;
    let rafId = 0;
    const tick = (now: number) => {
      const vid = sourceElemRef.current;
      if (vid instanceof HTMLVideoElement && vid.readyState >= 2 && graderRef.current) {
        const t = vid.currentTime;
        const shot = findShotAtTime(shotsRef.current, t);
        const frameNodes = shot ? shot.nodes : nodes;
        const frameActiveId = shot ? shot.activeNodeId : activeNodeId;
        if (shot && shot.id !== activeShotIdRef.current) {
          activeShotIdRef.current = shot.id;
          setActiveShotId(shot.id);
          setNodes(shot.nodes);
          setActiveNodeId(shot.activeNodeId);
        }
        graderRef.current.setSource(vid);
        graderRef.current.render({
          nodes: frameNodes,
          activeNodeId: frameActiveId,
          bypass,
          compareMode,
          wipePos,
          overlayMode,
          timeSeed: (now * 0.001) % 100,
        });
        setVideoTime(t);
        refreshScopes(false);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeMedia.type,
    videoPlaying,
    nodes,
    activeNodeId,
    bypass,
    compareMode,
    wipePos,
    overlayMode,
    refreshScopes,
  ]);

  // Toggle video playback
  const toggleVideoPlay = useCallback(() => {
    const vid = sourceElemRef.current;
    if (!(vid instanceof HTMLVideoElement)) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setVideoPlaying(true);
    } else {
      vid.pause();
      setVideoPlaying(false);
    }
  }, []);

  const handleVideoSeek = useCallback(
    (sec: number) => {
      const vid = sourceElemRef.current;
      if (!(vid instanceof HTMLVideoElement)) return;
      vid.currentTime = sec;
      setVideoTime(sec);
      switchShotIfNeeded(sec);
      const onSeeked = () => {
        if (graderRef.current) {
          const shot = findShotAtTime(shotsRef.current, sec);
          graderRef.current.setSource(vid);
          graderRef.current.render({
            nodes: shot ? shot.nodes : nodes,
            activeNodeId: shot ? shot.activeNodeId : activeNodeId,
            bypass,
            compareMode,
            wipePos,
            overlayMode,
            timeSeed: sec,
          });
          refreshScopes(true);
        }
        vid.removeEventListener('seeked', onSeeked);
      };
      vid.addEventListener('seeked', onSeeked);
    },
    [
      switchShotIfNeeded,
      nodes,
      activeNodeId,
      bypass,
      compareMode,
      wipePos,
      overlayMode,
      refreshScopes,
    ]
  );

  // Multi-Shot Timeline Operations
  const handleSelectShot = useCallback(
    (shot: VideoShot) => {
      activeShotIdRef.current = shot.id;
      setActiveShotId(shot.id);
      setNodes(shot.nodes);
      setActiveNodeId(shot.activeNodeId);
      const jumpTime = Math.min(shot.endSec - 0.02, shot.startSec + 0.02);
      handleVideoSeek(Math.max(0, jumpTime));
    },
    [handleVideoSeek]
  );

  const handleSplitShot = useCallback(() => {
    if (activeMedia.type !== 'video' || shots.length === 0) return;
    const t = videoTime;
    const idx = shots.findIndex((s) => t > s.startSec + 0.25 && t < s.endSec - 0.25);
    if (idx === -1) return;

    const target = shots[idx];
    const freshNode = createGradeNode('Primary Balance', `node_${Date.now()}`);
    const leftShot: VideoShot = { ...target, endSec: t };
    const rightShot: VideoShot = {
      id: `shot_${Date.now()}`,
      name: `Shot ${String(shots.length + 1).padStart(2, '0')}`,
      startSec: t,
      endSec: target.endSec,
      nodes: [freshNode],
      activeNodeId: freshNode.id,
    };

    const nextShots = [...shots.slice(0, idx), leftShot, rightShot, ...shots.slice(idx + 1)].map(
      (s, i) => ({ ...s, name: `Shot ${String(i + 1).padStart(2, '0')}` })
    );
    shotsRef.current = nextShots;
    activeShotIdRef.current = rightShot.id;
    setShots(nextShots);
    setActiveShotId(rightShot.id);
    setNodes(rightShot.nodes);
    setActiveNodeId(rightShot.activeNodeId);
  }, [activeMedia.type, shots, videoTime]);

  const handleCopyShotGrade = useCallback(() => {
    setCopiedShotNodes(cloneNodes(nodes));
  }, [nodes]);

  const handlePasteShotGrade = useCallback(() => {
    if (!copiedShotNodes) return;
    const pasted = cloneNodes(copiedShotNodes);
    setNodes(pasted);
    setActiveNodeId(pasted[0].id);
    commitHistory(pasted);
  }, [copiedShotNodes, commitHistory]);

  const handleMergeShot = useCallback(
    (shotId: string) => {
      if (shots.length <= 1) return;
      const idx = shots.findIndex((s) => s.id === shotId);
      if (idx === -1) return;
      const next = [...shots];
      if (idx > 0) {
        next[idx - 1] = { ...next[idx - 1], endSec: next[idx].endSec };
        next.splice(idx, 1);
      } else {
        next[1] = { ...next[1], startSec: next[0].startSec };
        next.splice(0, 1);
      }
      const renamed = next.map((s, i) => ({
        ...s,
        name: `Shot ${String(i + 1).padStart(2, '0')}`,
      }));
      const target = renamed[Math.max(0, idx - 1)];
      shotsRef.current = renamed;
      activeShotIdRef.current = target.id;
      setShots(renamed);
      setActiveShotId(target.id);
      setNodes(target.nodes);
      setActiveNodeId(target.activeNodeId);
    },
    [shots]
  );

  // Handle local media upload (images & video)
  const importFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setMediaError('Unsupported file format. Please import an image (PNG, JPG, WebP) or video (MP4, WebM, MOV).');
      return;
    }
    const url = URL.createObjectURL(file);
    const newItem: MediaItem = {
      id: `upload_${Date.now()}`,
      name: file.name.replace(/\.[^.]+$/, ''),
      type: isVideo ? 'video' : 'image',
      src: url,
      subtitle: isVideo ? 'Imported Video' : 'Imported Still',
    };
    setMediaItems((prev) => [newItem, ...prev]);
    setActiveMedia(newItem);
  }, []);

  // Serial Node Graph actions
  const handleAddNode = useCallback(() => {
    const num = nodes.length + 1;
    const nextNode = createGradeNode(`Serial ${String(num).padStart(2, '0')}`);
    const nextList = [...nodes, nextNode];
    setNodes(nextList);
    setActiveNodeId(nextNode.id);
    commitHistory(nextList);
  }, [nodes, commitHistory]);

  const handleDuplicateNode = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx === -1) return;
      const copy = cloneGradeNode(nodes[idx], `node_${Date.now()}`);
      copy.name = `${copy.name} Copy`;
      const nextList = [...nodes.slice(0, idx + 1), copy, ...nodes.slice(idx + 1)];
      setNodes(nextList);
      setActiveNodeId(copy.id);
      commitHistory(nextList);
    },
    [nodes, commitHistory]
  );

  const handleToggleNode = useCallback(
    (id: string) => {
      const nextList = nodes.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n));
      setNodes(nextList);
      commitHistory(nextList);
    },
    [nodes, commitHistory]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      if (nodes.length <= 1) return;
      const nextList = nodes.filter((n) => n.id !== id);
      setNodes(nextList);
      if (activeNodeId === id) {
        setActiveNodeId(nextList[nextList.length - 1].id);
      }
      commitHistory(nextList);
    },
    [nodes, activeNodeId, commitHistory]
  );

  const handleResetNode = useCallback(
    (id: string) => {
      const nextList = nodes.map((n) =>
        n.id === id ? createGradeNode(n.name, n.id) : n
      );
      setNodes(nextList);
      commitHistory(nextList);
    },
    [nodes, commitHistory]
  );

  const handleResetAllGrade = useCallback(() => {
    const fresh = [createGradeNode('Primary Balance', 'node_1')];
    setNodes(fresh);
    setActiveNodeId('node_1');
    setBypass(false);
    commitHistory(fresh);
  }, [commitHistory]);

  const handleGrabSnapshot = useCallback(() => {
    const grader = graderRef.current;
    if (!grader) return;
    const thumb = grader.captureThumbnail(320);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const snap: SnapshotStill = {
      id: `snap_${Date.now()}`,
      name: `Still ${snapshots.length + 1} · ${activeMedia.name}`,
      createdAt: timeStr,
      thumbnailDataUrl: thumb,
      nodes: cloneNodes(nodes),
    };
    setSnapshots((prev) => [snap, ...prev]);
    setDrawerSection('snapshots');
    setDrawerOpen(true);
  }, [snapshots.length, activeMedia.name, nodes]);

  // Export Frame & Export .cube LUT
  const handleExportImage = (
    format: 'image/png' | 'image/jpeg' | 'image/webp',
    quality: number
  ) => {
    const grader = graderRef.current;
    if (!grader) return;
    const dataUrl = grader.exportFullResolution(nodes, activeNodeId, format, quality);
    // Restore interactive canvas immediately
    triggerRender(true);

    const ext = format === 'image/png' ? 'png' : format === 'image/webp' ? 'webp' : 'jpg';
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${activeMedia.name.replace(/\s+/g, '_')}_graded.${ext}`;
    a.click();
  };

  const handleExportCubeLut = (size: 17 | 33, title: string) => {
    const grader = graderRef.current;
    if (!grader) return;
    const rgbData = grader.bake3DLut(nodes, size);
    const cubeContent = serializeCubeLut(rgbData, size, title);
    const blob = new Blob([cubeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${size}.cube`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // GPU-accelerated Graded Video Export (MP4 H.264 or WebM VP9 with original audio preserved)
  const handleCancelVideoExport = useCallback(() => {
    cancelVideoExportRef.current?.();
  }, []);

  const handleExportVideo = useCallback(
    async (options: VideoExportOptions) => {
      const grader = graderRef.current;
      const canvas = canvasRef.current;
      if (!grader || !canvas || activeMedia.type !== 'video') return;

      if (typeof MediaRecorder === 'undefined') {
        setVideoProgress({
          active: false,
          percent: 0,
          currentSec: 0,
          durationSec: videoDuration,
          error: 'Video recording is not supported in this browser. Try Chrome, Edge, or Brave.',
        });
        return;
      }

      // Pause interactive preview playback during render
      if (sourceElemRef.current instanceof HTMLVideoElement) {
        sourceElemRef.current.pause();
        setVideoPlaying(false);
      }

      // Choose best supported MIME type for selected container
      const candidates =
        options.container === 'mp4'
          ? [
              'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
              'video/mp4;codecs=avc1.42E01E',
              'video/mp4;codecs=h264',
              'video/mp4',
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp9',
              'video/webm',
            ]
          : [
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp9',
              'video/webm;codecs=vp8,opus',
              'video/webm',
            ];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const outExt = mimeType.includes('mp4') ? 'mp4' : 'webm';

      setVideoProgress({
        active: true,
        percent: 0,
        currentSec: 0,
        durationSec: videoDuration || 0,
        error: null,
      });

      const exportVid = document.createElement('video');
      exportVid.src = activeMedia.src;
      exportVid.crossOrigin = 'anonymous';
      exportVid.loop = false;
      exportVid.playsInline = true;
      exportVid.preload = 'auto';

      let audioCtx: AudioContext | null = null;
      let recorder: MediaRecorder | null = null;
      let rafId = 0;
      let cancelled = false;
      let finished = false;
      let streamTracks: MediaStreamTrack[] = [];

      const cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        exportVid.pause();
        exportVid.removeAttribute('src');
        exportVid.load();
        streamTracks.forEach((t) => t.stop());
        streamTracks = [];
        if (audioCtx) {
          audioCtx.close().catch(() => {});
          audioCtx = null;
        }
        cancelVideoExportRef.current = null;
        // Restore interactive preview frame immediately
        if (sourceElemRef.current instanceof HTMLVideoElement && graderRef.current) {
          graderRef.current.setSource(sourceElemRef.current);
          triggerRender(true);
        }
      };

      cancelVideoExportRef.current = () => {
        cancelled = true;
        if (recorder && recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
        cleanup();
        setVideoProgress({
          active: false,
          percent: 0,
          currentSec: 0,
          durationSec: videoDuration,
          error: null,
        });
      };

      try {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            exportVid.removeEventListener('canplay', onReady);
            exportVid.removeEventListener('error', onErr);
            resolve();
          };
          const onErr = () => {
            exportVid.removeEventListener('canplay', onReady);
            exportVid.removeEventListener('error', onErr);
            reject(new Error('Could not load video stream for export.'));
          };
          exportVid.addEventListener('canplay', onReady);
          exportVid.addEventListener('error', onErr);
          exportVid.load();
        });

        if (cancelled) return;

        const dur = Number.isFinite(exportVid.duration) && exportVid.duration > 0
          ? exportVid.duration
          : Math.max(0.1, videoDuration);

        // Draw first frame cleanly before starting recorder
        exportVid.currentTime = 0;
        grader.setSource(exportVid);
        grader.renderCleanFrame(nodes, activeNodeId, 0);

        const canvasStream = canvas.captureStream(options.fps);
        const combinedStream = new MediaStream();
        canvasStream.getVideoTracks().forEach((t) => {
          combinedStream.addTrack(t);
          streamTracks.push(t);
        });

        // Silently route original audio into MediaRecorder stream (without playing through speakers)
        if (options.includeAudio) {
          try {
            audioCtx = new AudioContext();
            const sourceNode = audioCtx.createMediaElementSource(exportVid);
            const destNode = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destNode);
            destNode.stream.getAudioTracks().forEach((t) => {
              combinedStream.addTrack(t);
              streamTracks.push(t);
            });
            exportVid.muted = false;
          } catch {
            exportVid.muted = true;
          }
        } else {
          exportVid.muted = true;
        }

        const chunks: BlobPart[] = [];
        const recOptions: MediaRecorderOptions = {
          videoBitsPerSecond: options.bitrateMbps * 1_000_000,
        };
        if (mimeType) recOptions.mimeType = mimeType;

        recorder = new MediaRecorder(combinedStream, recOptions);
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        const stoppedPromise = new Promise<Blob>((resolve) => {
          recorder!.onstop = () => {
            resolve(new Blob(chunks, { type: mimeType || `video/${outExt}` }));
          };
        });

        recorder.start(250);

        const pumpFrame = () => {
          if (cancelled || finished) return;
          if (exportVid.readyState >= 2) {
            const cur = exportVid.currentTime;
            const shot = findShotAtTime(shotsRef.current, cur);
            grader.setSource(exportVid);
            grader.renderCleanFrame(
              shot ? shot.nodes : nodes,
              shot ? shot.activeNodeId : activeNodeId,
              cur
            );
            setVideoProgress({
              active: true,
              percent: Math.min(99, (cur / dur) * 100),
              currentSec: cur,
              durationSec: dur,
              error: null,
            });
          }
          if (!exportVid.ended) {
            rafId = requestAnimationFrame(pumpFrame);
          }
        };

        exportVid.onended = async () => {
          if (cancelled || finished) return;
          finished = true;
          if (rafId) cancelAnimationFrame(rafId);
          const lastShot = findShotAtTime(shotsRef.current, dur);
          grader.setSource(exportVid);
          grader.renderCleanFrame(
            lastShot ? lastShot.nodes : nodes,
            lastShot ? lastShot.activeNodeId : activeNodeId,
            dur
          );

          if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
          }
          const blob = await stoppedPromise;
          cleanup();

          if (!cancelled && blob.size > 0) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeMedia.name.replace(/\s+/g, '_')}_graded.${outExt}`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }

          setVideoProgress({
            active: false,
            percent: 100,
            currentSec: dur,
            durationSec: dur,
            error: null,
          });
          setExportOpen(false);
        };

        await exportVid.play();
        rafId = requestAnimationFrame(pumpFrame);
      } catch (err) {
        cleanup();
        setVideoProgress({
          active: false,
          percent: 0,
          currentSec: 0,
          durationSec: videoDuration,
          error: err instanceof Error ? err.message : 'Video export failed.',
        });
      }
    },
    [activeMedia, activeNodeId, nodes, triggerRender, videoDuration]
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '\\' || (e.shiftKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setBypass((b) => !b);
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleToggleNode(activeNodeId);
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleAddNode();
      } else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c' && activeMedia.type === 'video') {
        e.preventDefault();
        handleSplitShot();
      } else if (e.key === ' ' && activeMedia.type === 'video') {
        e.preventDefault();
        toggleVideoPlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleToggleNode,
    activeNodeId,
    handleAddNode,
    handleSplitShot,
    activeMedia.type,
    toggleVideoPlay,
  ]);

  // Wipe divider dragging on viewport
  const handleWipePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const update = (cx: number) => {
      const next = Math.max(0.02, Math.min(0.98, (cx - rect.left) / rect.width));
      setWipePos(next);
    };
    update(e.clientX);
    const onMove = (ev: PointerEvent) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const grader = graderRef.current;
    if (!canvas || !grader) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const [r, g, b] = grader.samplePixel(nx, ny);
    const ire = Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100);
    setHoverPixel({ r, g, b, ire });
  };

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#0C0C0E] text-[#ECECEF]"
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        importFiles(e.dataTransfer.files);
      }}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Top Bar — Strict 3-Zone Contract */}
      <header className="flex h-11 shrink-0 items-center justify-between gap-8 border-b border-white/[0.07] bg-[#121216] px-5">
        {/* Zone 1: Single-line Display Brand Wordmark */}
        <span className="text-[15px] font-bold tracking-tight text-[#ECECEF] whitespace-nowrap shrink-0">
          ChromaGrade
        </span>

        {/* Zone 2: 4 Concise Single-Line Text Navigation Actions */}
        <nav className="flex items-center gap-6 text-xs font-medium text-[#A0A0AA]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="transition-colors hover:text-white whitespace-nowrap shrink-0"
          >
            Import Media
          </button>
          <button
            type="button"
            onClick={() => {
              if (drawerOpen && drawerSection === 'media') {
                setDrawerOpen(false);
              } else {
                setDrawerSection('media');
                setDrawerOpen(true);
              }
            }}
            className={`transition-colors hover:text-white whitespace-nowrap shrink-0 ${
              drawerOpen && (drawerSection === 'media' || drawerSection === 'looks')
                ? 'text-[#E5892E]'
                : ''
            }`}
          >
            Gallery & Looks
          </button>
          <button
            type="button"
            onClick={() => {
              if (drawerOpen && drawerSection === 'snapshots') {
                setDrawerOpen(false);
              } else {
                setDrawerSection('snapshots');
                setDrawerOpen(true);
              }
            }}
            className={`transition-colors hover:text-white whitespace-nowrap shrink-0 ${
              drawerOpen && drawerSection === 'snapshots' ? 'text-[#E5892E]' : ''
            }`}
          >
            Snapshots
          </button>
          <button
            type="button"
            onClick={() => {
              setExportTab('lut');
              setExportOpen(true);
            }}
            className="transition-colors hover:text-white whitespace-nowrap shrink-0"
          >
            Export LUT
          </button>
          <PWAInstallButton />
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setExportTab(activeMedia.type === 'video' ? 'video' : 'frame');
              setExportOpen(true);
            }}
            className="rounded bg-[#E5892E] px-3.5 py-1.5 text-xs font-semibold text-[#0C0C0E] transition-colors hover:bg-[#EE9842] whitespace-nowrap shrink-0"
          >
            {activeMedia.type === 'video' ? 'Export Video' : 'Export Frame'}
          </button>
        </div>
      </header>

      {/* Main Upper Deck: Drawer + Center Reference Viewer + Right Nodes & Scopes */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <MediaDrawer
          open={drawerOpen}
          initialSection={drawerSection}
          mediaItems={mediaItems}
          activeMediaId={activeMedia.id}
          snapshots={snapshots}
          onClose={() => setDrawerOpen(false)}
          onSelectMedia={(item) => setActiveMedia(item)}
          onUploadMedia={() => fileInputRef.current?.click()}
          onApplyPreset={(presetNodes) => {
            setNodes(presetNodes);
            setActiveNodeId(presetNodes[0].id);
            setBypass(false);
            commitHistory(presetNodes);
          }}
          onGrabSnapshot={handleGrabSnapshot}
          onApplySnapshot={(snap) => {
            const restored = cloneNodes(snap.nodes);
            setNodes(restored);
            setActiveNodeId(restored[0].id);
            setBypass(false);
            commitHistory(restored);
          }}
          onDeleteSnapshot={(id) => setSnapshots((prev) => prev.filter((s) => s.id !== id))}
        />

        {/* Center Reference Monitor */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-[#09090B]">
          {/* Viewport Canvas Stage */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
            {mediaError ? (
              <div className="flex max-w-sm flex-col items-center gap-2 rounded border border-red-500/30 bg-[#141418] p-5 text-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <p className="text-xs text-[#ECECEF]">{mediaError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMediaError(null);
                    setActiveMedia(SAMPLE_MEDIA[0]);
                  }}
                  className="mt-1 rounded border border-white/15 px-3 py-1 text-xs text-[#ECECEF] hover:border-white/30"
                >
                  Load Reference Frame
                </button>
              </div>
            ) : (
              <div
                className="relative flex items-center justify-center"
                style={
                  zoom === 'fit'
                    ? { maxWidth: '100%', maxHeight: '100%', height: '100%' }
                    : { transform: `scale(${zoom})`, transformOrigin: 'center center' }
                }
              >
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setHoverPixel(null)}
                  className="block max-h-full max-w-full rounded-[2px] border border-white/[0.06] bg-black object-contain shadow-2xl"
                />

                {/* Power Window Interactive Mask Outline Overlay */}
                {activeNode.mask.shape !== 'none' && activeNode.mask.showOverlay && (
                  <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      className="h-full w-full"
                    >
                      <g
                        transform={`translate(${activeNode.mask.centerX * 100} ${activeNode.mask.centerY * 100}) rotate(${-activeNode.mask.rotation})`}
                      >
                        {activeNode.mask.shape === 'ellipse' && (
                          <ellipse
                            cx={0}
                            cy={0}
                            rx={activeNode.mask.width * 100}
                            ry={activeNode.mask.height * 100}
                            fill="none"
                            stroke="#E5892E"
                            strokeWidth="0.45"
                            strokeDasharray="1.8 1.2"
                          />
                        )}
                        {activeNode.mask.shape === 'rectangle' && (
                          <rect
                            x={-activeNode.mask.width * 100}
                            y={-activeNode.mask.height * 100}
                            width={activeNode.mask.width * 200}
                            height={activeNode.mask.height * 200}
                            fill="none"
                            stroke="#E5892E"
                            strokeWidth="0.45"
                            strokeDasharray="1.8 1.2"
                          />
                        )}
                        {activeNode.mask.shape === 'linear' && (
                          <>
                            <line
                              x1={-140}
                              y1={0}
                              x2={140}
                              y2={0}
                              stroke="#E5892E"
                              strokeWidth="0.5"
                              strokeDasharray="2 1.2"
                            />
                            <line
                              x1={0}
                              y1={0}
                              x2={0}
                              y2={-Math.max(4, activeNode.mask.feather * 40)}
                              stroke="#E5892E"
                              strokeWidth="0.4"
                            />
                          </>
                        )}
                      </g>
                    </svg>
                    {/* Draggable Center Point Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        const moveTo = (cx: number, cy: number) => {
                          const nx = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
                          const ny = Math.max(0, Math.min(1, (cy - rect.top) / rect.height));
                          updateActiveNode((n) => ({
                            ...n,
                            mask: {
                              ...n.mask,
                              centerX: Number(nx.toFixed(3)),
                              centerY: Number(ny.toFixed(3)),
                            },
                          }));
                        };
                        const onMove = (ev: PointerEvent) => moveTo(ev.clientX, ev.clientY);
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                          commitHistory();
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                      style={{
                        left: `${activeNode.mask.centerX * 100}%`,
                        top: `${activeNode.mask.centerY * 100}%`,
                      }}
                      title="Drag to reposition Power Window mask"
                      className="pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-2 border-[#E5892E] bg-[#0C0C0E]/80 shadow-md"
                    />
                  </div>
                )}

                {/* Wipe Split Overlay Handle */}
                {compareMode === 'wipe' && (
                  <div
                    onPointerDown={handleWipePointerDown}
                    style={{ left: `${wipePos * 100}%` }}
                    className="group absolute top-0 bottom-0 z-20 -ml-2 w-4 cursor-ew-resize"
                  >
                    <div className="mx-auto h-full w-[1.5px] bg-white/85 shadow-[0_0_8px_rgba(0,0,0,0.9)]" />
                    <div className="absolute top-1/2 left-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-[#121216]/90 text-white shadow-lg">
                      <SplitSquareHorizontal className="h-3.5 w-3.5" />
                    </div>
                  </div>
                )}

                {/* Subtle Compare Labels */}
                {compareMode !== 'normal' && (
                  <>
                    <div className="pointer-events-none absolute top-2.5 left-2.5 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white/85">
                      Original
                    </div>
                    <div className="pointer-events-none absolute top-2.5 right-2.5 rounded bg-black/65 px-2 py-0.5 text-[10px] font-medium text-[#E5892E]">
                      Graded
                    </div>
                  </>
                )}

                {bypass && (
                  <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 rounded bg-black/75 px-2.5 py-0.5 text-[11px] font-medium text-[#E5892E]">
                    Grade Bypassed
                  </div>
                )}
              </div>
            )}

            {/* Drag-and-drop visual overlay */}
            {dragActive && (
              <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-md border-2 border-dashed border-[#E5892E] bg-[#0C0C0E]/85">
                <span className="text-sm font-medium text-[#ECECEF]">
                  Drop image or video file to load into ChromaGrade
                </span>
              </div>
            )}
          </div>

          {/* Multi-Shot Video Timeline Bar (only shown when grading video) */}
          {activeMedia.type === 'video' && (
            <ShotTimelineBar
              shots={shots}
              activeShotId={activeShotId}
              currentTime={videoTime}
              duration={videoDuration}
              playing={videoPlaying}
              hasCopiedGrade={Boolean(copiedShotNodes)}
              onTogglePlay={toggleVideoPlay}
              onSeek={handleVideoSeek}
              onSelectShot={handleSelectShot}
              onSplitAtPlayhead={handleSplitShot}
              onCopyShotGrade={handleCopyShotGrade}
              onPasteShotGrade={handlePasteShotGrade}
              onMergeShot={handleMergeShot}
            />
          )}

          {/* Slim Viewer Transport & Diagnostic Bar */}
          <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-white/[0.07] bg-[#121216] px-3.5">
            {/* Left: History + Bypass + Grab Still + Tutorial Download */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                title="Undo (Ctrl+Z)"
                className="flex h-6 w-6 items-center justify-center rounded text-[#A0A0AA] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                title="Redo (Ctrl+Shift+Z)"
                className="flex h-6 w-6 items-center justify-center rounded text-[#A0A0AA] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>

              <div className="mx-1 h-4 w-[1px] bg-white/[0.08]" />

              <button
                type="button"
                onClick={() => setBypass((b) => !b)}
                title="Bypass All Grading (\)"
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  bypass
                    ? 'bg-[#E5892E]/20 text-[#E5892E]'
                    : 'text-[#A0A0AA] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <EyeOff className="h-3 w-3" />
                Bypass
              </button>

              <button
                type="button"
                onClick={handleGrabSnapshot}
                title="Grab Grade Snapshot Still"
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#A0A0AA] transition-colors hover:bg-white/[0.06] hover:text-white whitespace-nowrap"
              >
                <Camera className="h-3 w-3" />
                Grab Still
              </button>

              <a
                href="/ChromaGrade_Color_Grading_Tutorial.docx"
                download="ChromaGrade_Color_Grading_Tutorial.docx"
                title="Download Full Color Grading Tutorial Manual (Microsoft Word .docx)"
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#E5892E] transition-colors hover:bg-[#E5892E]/10 whitespace-nowrap"
              >
                <BookOpen className="h-3 w-3" />
                Guide (.docx)
              </a>
            </div>

            {/* Center: Compare & Diagnostic Overlays */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 rounded bg-[#0C0C0E] p-0.5 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setCompareMode('normal')}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap ${
                    compareMode === 'normal'
                      ? 'bg-[#25252B] text-white'
                      : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode('wipe')}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap ${
                    compareMode === 'wipe'
                      ? 'bg-[#25252B] text-white'
                      : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  <SplitSquareHorizontal className="h-3 w-3" />
                  Wipe
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode('split')}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap ${
                    compareMode === 'split'
                      ? 'bg-[#25252B] text-white'
                      : 'text-[#8E8E98] hover:text-white'
                  }`}
                >
                  <Columns2 className="h-3 w-3" />
                  Split
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOverlayMode((m) => (m === 'falseColor' ? 'none' : 'falseColor'))
                }
                title="ARRI IRE False Color Exposure Overlay"
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  overlayMode === 'falseColor'
                    ? 'bg-[#E5892E]/20 text-[#E5892E]'
                    : 'text-[#A0A0AA] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Flame className="h-3 w-3" />
                False Color
              </button>

              <button
                type="button"
                onClick={() =>
                  setOverlayMode((m) => (m === 'clipping' ? 'none' : 'clipping'))
                }
                title="Highlight / Shadow Clipping Zebra Warning"
                className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  overlayMode === 'clipping'
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-[#A0A0AA] hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                Clipping
              </button>
            </div>

            {/* Right: Live Eyedropper Readout + Zoom + Reset All */}
            <div className="flex items-center gap-3">
              {hoverPixel ? (
                <div className="font-mono-num hidden items-center gap-2 text-[10px] xl:flex">
                  <span className="text-[#E06C6C]">R:{hoverPixel.r}</span>
                  <span className="text-[#62C47F]">G:{hoverPixel.g}</span>
                  <span className="text-[#669DF2]">B:{hoverPixel.b}</span>
                  <span className="text-[#ECECEF]">{hoverPixel.ire} IRE</span>
                </div>
              ) : (
                <span className="font-mono-num hidden text-[10px] text-[#6E6E78] xl:inline">
                  {activeMedia.name} · {sourceDimensions.width}×{sourceDimensions.height}
                </span>
              )}

              <select
                aria-label="Viewer Zoom"
                value={String(zoom)}
                onChange={(e) => {
                  const v = e.target.value;
                  setZoom(v === 'fit' ? 'fit' : (Number(v) as 1 | 1.5 | 2));
                }}
                className="font-mono-num rounded border border-white/10 bg-[#18181D] px-1.5 py-0.5 text-[10px] text-[#D4D4DC] outline-none"
              >
                <option value="fit">Fit</option>
                <option value="1">100%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
              </select>

              <button
                type="button"
                onClick={handleResetAllGrade}
                title="Reset Entire Grade"
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-[#8E8E98] transition-colors hover:bg-white/[0.06] hover:text-white whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
        </main>

        {/* Right Dock: Serial Nodes + Live Broadcast Scopes */}
        <aside className="flex w-[348px] shrink-0 flex-col gap-2.5 border-l border-white/[0.07] bg-[#121216] p-3">
          <NodePipeline
            nodes={nodes}
            activeNodeId={activeNodeId}
            onSelectNode={setActiveNodeId}
            onAddNode={handleAddNode}
            onDuplicateNode={handleDuplicateNode}
            onToggleNode={handleToggleNode}
            onDeleteNode={handleDeleteNode}
            onResetNode={handleResetNode}
            onRenameNode={(id, name) => {
              const next = nodes.map((n) => (n.id === id ? { ...n, name } : n));
              setNodes(next);
              commitHistory(next);
            }}
            onChangeOpacity={(id, opacity) =>
              setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, opacity } : n)))
            }
            onCommit={() => commitHistory()}
          />

          <ScopesPanel pixelData={scopePixelsRef.current} renderTick={scopeTick} />
        </aside>
      </div>

      {/* Main Lower Deck: Dedicated Color Grading Console */}
      <section className="flex h-[348px] shrink-0 flex-col border-t border-white/[0.08] bg-[#141418]">
        {/* Tool Tab Strip */}
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#111115] px-4">
          <div className="flex items-center gap-1">
            {TOOL_TABS.map((tab) => {
              const isActive = activeTool === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTool(tab.id)}
                  className={`relative px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive ? 'text-[#ECECEF]' : 'text-[#8E8E98] hover:text-[#D4D4DC]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute right-2 bottom-0 left-2 h-[2px] bg-[#E5892E]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#787882]">
            <span>Active Node:</span>
            <span className="font-medium text-[#D4D4DC]">{activeNode.name}</span>
            {!activeNode.enabled && <span className="text-[#E5892E]">(Bypassed)</span>}
          </div>
        </div>

        {/* Active Grading Tool Deck */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {activeTool === 'primaries' && (
            <PrimaryPanel
              primaries={activeNode.primaries}
              onChange={(primaries) => updateActiveNode((n) => ({ ...n, primaries }))}
              onCommit={() => commitHistory()}
            />
          )}

          {activeTool === 'hdr' && (
            <HdrPanel
              hdr={activeNode.hdr}
              onChange={(hdr) => updateActiveNode((n) => ({ ...n, hdr }))}
              onCommit={() => commitHistory()}
            />
          )}

          {activeTool === 'curves' && (
            <CurveEditor
              curves={activeNode.curves}
              lumaHistogram={lumaHistogram}
              onChangeCurve={(key: keyof CurvesState, points: CurvePoint[]) =>
                updateActiveNode((n) => ({
                  ...n,
                  curves: { ...n.curves, [key]: points },
                }))
              }
              onResetAllCurves={() =>
                updateActiveNode((n) => ({ ...n, curves: createDefaultCurves() }))
              }
              onCommit={() => commitHistory()}
            />
          )}

          {activeTool === 'qualifier' && (
            <QualifierPanel
              qualifier={activeNode.qualifier}
              onChange={(qualifier) => updateActiveNode((n) => ({ ...n, qualifier }))}
              onCommit={() => commitHistory()}
            />
          )}

          {activeTool === 'mask' && (
            <MaskPanel
              mask={activeNode.mask}
              onChange={(mask) => updateActiveNode((n) => ({ ...n, mask }))}
              onCommit={() => commitHistory()}
            />
          )}

          {activeTool === 'finish' && (
            <FinishPanel
              finish={activeNode.finish}
              lut={activeNode.lut}
              onChangeFinish={(finish) => updateActiveNode((n) => ({ ...n, finish }))}
              onChangeLut={(lut: CubeLutData | null, lutName: string | null) =>
                updateActiveNode((n) => ({
                  ...n,
                  lut,
                  finish: { ...n.finish, lutName },
                }))
              }
              onCommit={() => commitHistory()}
            />
          )}
        </div>
      </section>

      {/* Full-Resolution Video, Frame & .cube 3D LUT Export Modal */}
      <ExportModal
        open={exportOpen}
        initialTab={exportTab}
        mediaType={activeMedia.type}
        videoDuration={videoDuration}
        sourceDimensions={sourceDimensions}
        mediaName={activeMedia.name}
        videoProgress={videoProgress}
        onClose={() => {
          if (!videoProgress.active) setExportOpen(false);
        }}
        onExportVideo={handleExportVideo}
        onCancelVideoExport={handleCancelVideoExport}
        onExportImage={handleExportImage}
        onExportCubeLut={handleExportCubeLut}
      />

      <OfflineIndicator />
    </div>
  );
}
