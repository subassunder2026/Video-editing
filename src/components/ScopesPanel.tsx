import React, { useEffect, useRef, useState } from 'react';
import { Columns2, Square } from 'lucide-react';
import type { ScopeMode } from '../types/grading';

interface ScopesPanelProps {
  pixelData: { data: Uint8Array; width: number; height: number } | null;
  renderTick: number;
}

const SCOPE_TABS: Array<{ id: ScopeMode; label: string }> = [
  { id: 'parade', label: 'Parade' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'vectorscope', label: 'Vectorscope' },
  { id: 'histogram', label: 'Histogram' },
];

function drawParade(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixels: Uint8Array,
  pw: number,
  ph: number
) {
  ctx.fillStyle = '#0A0A0D';
  ctx.fillRect(0, 0, w, h);

  const img = ctx.createImageData(w, h);
  const buf = img.data;
  // Clear alpha
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

  const colW = Math.floor(w / 3);
  const padY = 12;
  const usableH = h - padY * 2;
  const boost = 14;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const idx = (py * pw + px) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      const sx = Math.floor((px / pw) * (colW - 4)) + 2;

      const yr = padY + Math.floor(((255 - r) / 255) * usableH);
      const yg = padY + Math.floor(((255 - g) / 255) * usableH);
      const yb = padY + Math.floor(((255 - b) / 255) * usableH);

      const ir = (yr * w + sx) * 4;
      buf[ir] = Math.min(255, buf[ir] + boost + 18);
      buf[ir + 1] = Math.min(255, buf[ir + 1] + 5);
      buf[ir + 2] = Math.min(255, buf[ir + 2] + 5);

      const ig = (yg * w + (colW + sx)) * 4;
      buf[ig] = Math.min(255, buf[ig] + 4);
      buf[ig + 1] = Math.min(255, buf[ig + 1] + boost + 18);
      buf[ig + 2] = Math.min(255, buf[ig + 2] + 6);

      const ib = (yb * w + (colW * 2 + sx)) * 4;
      buf[ib] = Math.min(255, buf[ib] + 6);
      buf[ib + 1] = Math.min(255, buf[ib + 1] + 10);
      buf[ib + 2] = Math.min(255, buf[ib + 2] + boost + 22);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Graticules
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  for (const ire of [0, 25, 50, 75, 100]) {
    const y = Math.round(padY + ((100 - ire) / 100) * usableH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(String(ire), 3, y - 2);
  }
  // Column dividers
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(colW + 0.5, 0);
  ctx.lineTo(colW + 0.5, h);
  ctx.moveTo(colW * 2 + 0.5, 0);
  ctx.lineTo(colW * 2 + 0.5, h);
  ctx.stroke();
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixels: Uint8Array,
  pw: number,
  ph: number
) {
  ctx.fillStyle = '#0A0A0D';
  ctx.fillRect(0, 0, w, h);

  const img = ctx.createImageData(w, h);
  const buf = img.data;
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

  const padY = 12;
  const usableH = h - padY * 2;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const idx = (py * pw + px) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const sx = Math.floor((px / pw) * (w - 1));
      const sy = padY + Math.floor(((255 - luma) / 255) * usableH);
      const bi = (sy * w + sx) * 4;
      buf[bi] = Math.min(255, buf[bi] + 22);
      buf[bi + 1] = Math.min(255, buf[bi + 1] + 28);
      buf[bi + 2] = Math.min(255, buf[bi + 2] + 24);
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  for (const ire of [0, 25, 50, 75, 100]) {
    const y = Math.round(padY + ((100 - ire) / 100) * usableH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillText(`${ire}`, 4, y - 2);
  }
}

function drawVectorscope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixels: Uint8Array,
  pw: number,
  ph: number
) {
  ctx.fillStyle = '#0A0A0D';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.44;

  const img = ctx.createImageData(w, h);
  const buf = img.data;
  for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

  // Plot Rec.709 Cb/Cr chromaticity coordinates
  for (let i = 0; i < pw * ph * 4; i += 4) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;

    const cb = -0.1146 * r - 0.3854 * g + 0.5 * b; // [-0.5, 0.5]
    const cr = 0.5 * r - 0.4542 * g - 0.0458 * b;  // [-0.5, 0.5]

    const sx = Math.round(cx + cb * 2.0 * radius);
    const sy = Math.round(cy - cr * 2.0 * radius);

    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
      const bi = (sy * w + sx) * 4;
      buf[bi] = Math.min(255, buf[bi] + Math.round(r * 42 + 12));
      buf[bi + 1] = Math.min(255, buf[bi + 1] + Math.round(g * 42 + 12));
      buf[bi + 2] = Math.min(255, buf[bi + 2] + Math.round(b * 42 + 12));
    }
  }
  ctx.putImageData(img, 0, 0);

  // Graticule rings
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.stroke();

  // Broadcast Skin Tone I-Line (~123° in Cb/Cr space)
  const skinAngle = (123 * Math.PI) / 180;
  ctx.strokeStyle = 'rgba(229, 137, 46, 0.55)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(skinAngle) * radius, cy - Math.sin(skinAngle) * radius);
  ctx.stroke();
  ctx.setLineDash([]);

  // 75% SMPTE Target Markers (R, Mg, B, Cy, G, Yl)
  const targets: Array<{ label: string; r: number; g: number; b: number; col: string }> = [
    { label: 'R', r: 0.75, g: 0, b: 0, col: '#EF4444' },
    { label: 'Mg', r: 0.75, g: 0, b: 0.75, col: '#EC4899' },
    { label: 'B', r: 0, g: 0, b: 0.75, col: '#3B82F6' },
    { label: 'Cy', r: 0, g: 0.75, b: 0.75, col: '#06B6D4' },
    { label: 'G', r: 0, g: 0.75, b: 0, col: '#22C55E' },
    { label: 'Yl', r: 0.75, g: 0.75, b: 0, col: '#EAB308' },
  ];

  ctx.font = '9px "JetBrains Mono", monospace';
  for (const t of targets) {
    const cb = -0.1146 * t.r - 0.3854 * t.g + 0.5 * t.b;
    const cr = 0.5 * t.r - 0.4542 * t.g - 0.0458 * t.b;
    const tx = cx + cb * 2.0 * radius;
    const ty = cy - cr * 2.0 * radius;
    ctx.strokeStyle = t.col;
    ctx.strokeRect(tx - 4, ty - 4, 8, 8);
    ctx.fillStyle = t.col;
    ctx.fillText(t.label, tx + 6, ty + 3);
  }
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixels: Uint8Array,
  pw: number,
  ph: number
) {
  ctx.fillStyle = '#0A0A0D';
  ctx.fillRect(0, 0, w, h);

  const binsR = new Uint32Array(128);
  const binsG = new Uint32Array(128);
  const binsB = new Uint32Array(128);
  const binsL = new Uint32Array(128);

  const count = pw * ph;
  for (let i = 0; i < count * 4; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    binsR[r >> 1]++;
    binsG[g >> 1]++;
    binsB[b >> 1]++;
    binsL[l >> 1]++;
  }

  // Smooth max (ignore extreme 0/127 clip spikes slightly so mid histogram stays visible)
  let maxPeak = 10;
  for (let i = 2; i < 126; i++) {
    maxPeak = Math.max(maxPeak, binsR[i], binsG[i], binsB[i]);
  }
  maxPeak *= 1.15;

  const padY = 10;
  const usableH = h - padY * 2;

  const plotChannel = (bins: Uint32Array, fill: string, stroke: string) => {
    ctx.beginPath();
    ctx.moveTo(0, h - padY);
    for (let i = 0; i < 128; i++) {
      const x = (i / 127) * w;
      const norm = Math.min(1, bins[i] / maxPeak);
      const y = h - padY - norm * usableH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h - padY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  };

  ctx.globalCompositeOperation = 'screen';
  plotChannel(binsR, 'rgba(232, 76, 76, 0.25)', 'rgba(232, 76, 76, 0.85)');
  plotChannel(binsG, 'rgba(66, 196, 114, 0.25)', 'rgba(66, 196, 114, 0.85)');
  plotChannel(binsB, 'rgba(72, 138, 245, 0.25)', 'rgba(72, 138, 245, 0.85)');
  ctx.globalCompositeOperation = 'source-over';
  plotChannel(binsL, 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.55)');

  // Quarter lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (const frac of [0.25, 0.5, 0.75]) {
    const x = Math.round(w * frac) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
}

const SingleScopeCanvas: React.FC<{
  mode: ScopeMode;
  pixelData: { data: Uint8Array; width: number; height: number } | null;
  renderTick: number;
}> = ({ mode, pixelData, renderTick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixelData) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (mode === 'parade') {
      drawParade(ctx, w, h, pixelData.data, pixelData.width, pixelData.height);
    } else if (mode === 'waveform') {
      drawWaveform(ctx, w, h, pixelData.data, pixelData.width, pixelData.height);
    } else if (mode === 'vectorscope') {
      drawVectorscope(ctx, w, h, pixelData.data, pixelData.width, pixelData.height);
    } else {
      drawHistogram(ctx, w, h, pixelData.data, pixelData.width, pixelData.height);
    }
  }, [mode, pixelData, renderTick]);

  return (
    <canvas
      ref={canvasRef}
      width={340}
      height={200}
      className="h-full w-full rounded border border-white/[0.06] bg-[#0A0A0D]"
    />
  );
};

export const ScopesPanel: React.FC<ScopesPanelProps> = ({ pixelData, renderTick }) => {
  const [primaryScope, setPrimaryScope] = useState<ScopeMode>('parade');
  const [dualMode, setDualMode] = useState(true);

  const secondaryScope: ScopeMode =
    primaryScope === 'vectorscope' ? 'parade' : 'vectorscope';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded bg-[#101013] p-0.5 border border-white/[0.06]">
          {SCOPE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPrimaryScope(t.id)}
              className={`rounded px-2 py-1 text-[10px] font-medium transition-colors whitespace-nowrap ${
                primaryScope === t.id
                  ? 'bg-[#25252B] text-white'
                  : 'text-[#8E8E98] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDualMode((d) => !d)}
          title={dualMode ? 'Switch to Single Scope' : 'Switch to Dual Scopes'}
          className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
            dualMode
              ? 'border-[#E5892E]/50 bg-[#E5892E]/10 text-[#E5892E]'
              : 'border-white/[0.08] text-[#8E8E98] hover:text-white'
          }`}
        >
          {dualMode ? <Columns2 className="h-3.5 w-3.5" /> : <Square className="h-3 w-3" />}
        </button>
      </div>

      <div className={`grid min-h-0 flex-1 gap-2 ${dualMode ? 'grid-rows-2' : 'grid-rows-1'}`}>
        <div className="relative min-h-0">
          <SingleScopeCanvas
            mode={primaryScope}
            pixelData={pixelData}
            renderTick={renderTick}
          />
          <span className="pointer-events-none absolute top-1.5 right-2 text-[9px] font-medium tracking-wide text-white/45">
            {SCOPE_TABS.find((t) => t.id === primaryScope)?.label}
          </span>
        </div>

        {dualMode && (
          <div className="relative min-h-0">
            <SingleScopeCanvas
              mode={secondaryScope}
              pixelData={pixelData}
              renderTick={renderTick}
            />
            <span className="pointer-events-none absolute top-1.5 right-2 text-[9px] font-medium tracking-wide text-white/45">
              {SCOPE_TABS.find((t) => t.id === secondaryScope)?.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
