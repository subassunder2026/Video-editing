import type { CubeLutData } from '../types/grading';

/**
 * Parses an industry-standard Adobe/DaVinci .cube 3D LUT file.
 */
export function parseCubeLut(text: string, fallbackTitle = 'Imported LUT'): CubeLutData {
  const lines = text.split(/\r?\n/);
  let title = fallbackTitle;
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('TITLE')) {
      const match = line.match(/TITLE\s+"?([^"]+)"?/i);
      if (match) title = match[1].trim();
      continue;
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    if (line.startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) domainMin = [parts[0], parts[1], parts[2]];
      continue;
    }

    if (line.startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3) domainMax = [parts[0], parts[1], parts[2]];
      continue;
    }

    if (/^[A-Za-z_]/.test(line)) {
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        values.push(r, g, b);
      }
    }
  }

  if (size <= 1) {
    // Infer cube root if header omitted
    const count = Math.round(Math.cbrt(values.length / 3));
    if (count * count * count * 3 === values.length) {
      size = count;
    } else {
      throw new Error('Invalid .cube file: missing LUT_3D_SIZE.');
    }
  }

  const expected = size * size * size;
  if (values.length < expected * 3) {
    throw new Error(
      `Incomplete .cube file: expected ${expected} RGB triplets for ${size}³ LUT, found ${Math.floor(values.length / 3)}.`
    );
  }

  // Pack RGBA Float32Array in R-fastest, G-middle, B-slowest order (standard .cube layout & WebGL2 texImage3D x=R, y=G, z=B)
  const data = new Float32Array(expected * 4);
  for (let i = 0; i < expected; i++) {
    data[i * 4] = values[i * 3];
    data[i * 4 + 1] = values[i * 3 + 1];
    data[i * 4 + 2] = values[i * 3 + 2];
    data[i * 4 + 3] = 1.0;
  }

  return {
    title,
    size,
    domainMin,
    domainMax,
    data,
  };
}

/**
 * Generates an industry-standard .cube 3D LUT file string from an array of RGB Float32 triplets
 * ordered R-fastest, G-middle, B-slowest (compatible with DaVinci Resolve, Premiere Pro, Final Cut, Assimilate Scratch).
 */
export function serializeCubeLut(
  rgbData: Float32Array,
  size: number,
  title = 'ChromaGrade_Export'
): string {
  const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'ChromaGrade_Export';
  const lines: string[] = [
    '# Created by ChromaGrade Professional Color Grading Workstation',
    `TITLE "${safeTitle}"`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
    `LUT_3D_SIZE ${size}`,
    '',
  ];

  const total = size * size * size;
  for (let i = 0; i < total; i++) {
    const r = Math.max(0, Math.min(1, rgbData[i * 3])).toFixed(6);
    const g = Math.max(0, Math.min(1, rgbData[i * 3 + 1])).toFixed(6);
    const b = Math.max(0, Math.min(1, rgbData[i * 3 + 2])).toFixed(6);
    lines.push(`${r} ${g} ${b}`);
  }

  return lines.join('\n') + '\n';
}
