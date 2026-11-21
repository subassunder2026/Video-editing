import type { CurvePoint, CurvesState } from '../types/grading';

/**
 * Evaluates a monotone cubic Hermite spline (Fritsch-Carlson method)
 * over sorted control points, producing a 256-sample Float32Array in [0, 1].
 * Prevents ringing/overshoot common with naive Catmull-Rom splines.
 */
export function evaluateCurveToLut(
  rawPoints: CurvePoint[],
  samples = 256,
  cyclic = false
): Float32Array {
  const out = new Float32Array(samples);
  const pts = [...rawPoints].sort((a, b) => a.x - b.x);

  if (pts.length === 0) {
    for (let i = 0; i < samples; i++) out[i] = i / (samples - 1);
    return out;
  }

  if (pts.length === 1) {
    out.fill(clamp01(pts[0].y));
    return out;
  }

  // Build working knot list (with wrap-around padding for cyclic Hue curves)
  let work: CurvePoint[];
  if (cyclic) {
    const inner = pts.filter((p) => p.x > 0.001 && p.x < 0.999);
    if (inner.length === 0) {
      // Only endpoints exist
      const avgY = clamp01((pts[0].y + pts[pts.length - 1].y) * 0.5);
      out.fill(avgY);
      return out;
    }
    const base = inner;
    const prev = { x: base[base.length - 1].x - 1, y: base[base.length - 1].y };
    const prev2 =
      base.length >= 2
        ? { x: base[base.length - 2].x - 1, y: base[base.length - 2].y }
        : { x: base[0].x - 1, y: base[0].y };
    const next = { x: base[0].x + 1, y: base[0].y };
    const next2 =
      base.length >= 2
        ? { x: base[1].x + 1, y: base[1].y }
        : { x: base[base.length - 1].x + 1, y: base[base.length - 1].y };
    work = [prev2, prev, ...base, next, next2];
  } else {
    // Deduplicate nearly identical X values
    work = [];
    for (const p of pts) {
      if (work.length > 0 && Math.abs(p.x - work[work.length - 1].x) < 1e-4) {
        work[work.length - 1] = p;
      } else {
        work.push(p);
      }
    }
  }

  const n = work.length;
  if (n === 1) {
    out.fill(clamp01(work[0].y));
    return out;
  }

  // Slopes between adjacent knots
  const dx = new Float64Array(n - 1);
  const dy = new Float64Array(n - 1);
  const m = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = Math.max(1e-5, work[i + 1].x - work[i].x);
    dy[i] = work[i + 1].y - work[i].y;
    m[i] = dy[i] / dx[i];
  }

  // Tangents
  const c1 = new Float64Array(n);
  c1[0] = m[0];
  c1[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      c1[i] = 0;
    } else {
      const common = dx[i - 1] + dx[i];
      c1[i] = (3 * common) / ((common + dx[i]) / m[i - 1] + (common + dx[i - 1]) / m[i]);
    }
  }

  // Sample spline
  let seg = 0;
  for (let i = 0; i < samples; i++) {
    const x = i / (samples - 1);
    if (!cyclic && x <= work[0].x) {
      out[i] = clamp01(work[0].y);
      continue;
    }
    if (!cyclic && x >= work[n - 1].x) {
      out[i] = clamp01(work[n - 1].y);
      continue;
    }
    while (seg < n - 2 && x > work[seg + 1].x) {
      seg++;
    }
    while (seg > 0 && x < work[seg].x) {
      seg--;
    }

    const h = dx[seg];
    const t = Math.max(0, Math.min(1, (x - work[seg].x) / h));
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const y = h00 * work[seg].y + h10 * h * c1[seg] + h01 * work[seg + 1].y + h11 * h * c1[seg + 1];
    out[i] = clamp01(y);
  }

  return out;
}

/**
 * Packs all 10 curves into a 256 x 10 RGBA8 texture buffer (10240 bytes)
 * Row 0: Master Y    Row 4: Hue vs Hue   Row 8: Sat vs Sat
 * Row 1: Red         Row 5: Hue vs Sat   Row 9: Sat vs Lum
 * Row 2: Green       Row 6: Hue vs Lum
 * Row 3: Blue        Row 7: Lum vs Sat
 * Encodes each 16-bit value across R (high byte) and G (low byte) for smooth 16-bit precision in standard RGBA8 texture!
 */
export function packCurvesToTextureData(curves: CurvesState): Uint8Array {
  const width = 256;
  const rows: Array<{ pts: CurvePoint[]; cyclic: boolean }> = [
    { pts: curves.master, cyclic: false },
    { pts: curves.red, cyclic: false },
    { pts: curves.green, cyclic: false },
    { pts: curves.blue, cyclic: false },
    { pts: curves.hueVsHue, cyclic: true },
    { pts: curves.hueVsSat, cyclic: true },
    { pts: curves.hueVsLum, cyclic: true },
    { pts: curves.lumVsSat, cyclic: false },
    { pts: curves.satVsSat, cyclic: false },
    { pts: curves.satVsLum, cyclic: false },
  ];

  const data = new Uint8Array(width * rows.length * 4);

  for (let row = 0; row < rows.length; row++) {
    const lut = evaluateCurveToLut(rows[row].pts, width, rows[row].cyclic);
    for (let x = 0; x < width; x++) {
      const val16 = Math.round(clamp01(lut[x]) * 65535);
      const hi = (val16 >> 8) & 0xff;
      const lo = val16 & 0xff;
      const idx = (row * width + x) * 4;
      data[idx] = hi;
      data[idx + 1] = lo;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  return data;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
