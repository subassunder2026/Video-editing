export interface WheelValue {
  /** Horizontal color wheel coordinate [-1, 1] (Cyan-Red / Blue-Yellow vector) */
  x: number;
  /** Vertical color wheel coordinate [-1, 1] */
  y: number;
  /** Master luminance offset [-1, 1] */
  luma: number;
}

export interface PrimariesState {
  // Primary Lift / Gamma / Gain / Offset wheels
  lift: WheelValue;
  gamma: WheelValue;
  gain: WheelValue;
  offset: WheelValue;

  // Log Grading Wheels
  logShadows: WheelValue;
  logMidtones: WheelValue;
  logHighlights: WheelValue;
  logLowRange: number;  // [0.05, 0.55], default 0.30
  logHighRange: number; // [0.45, 0.95], default 0.68

  // Primary Bars / Sliders
  exposure: number;       // [-4, 4] EV stops
  contrast: number;       // [0, 2] default 1.0
  pivot: number;          // [0.1, 0.9] default 0.435
  temperature: number;    // [-1, 1] cool to warm
  tint: number;           // [-1, 1] green to magenta
  saturation: number;     // [0, 2] default 1.0
  vibrance: number;       // [-1, 1] default 0.0
  highlights: number;     // [-1, 1] recovery/boost
  shadows: number;        // [-1, 1] recovery/crush
  midtoneDetail: number;  // [-1, 1] micro-contrast / clarity
  hueRotate: number;      // [-180, 180] degrees
}

export type HdrZoneId = 'black' | 'dark' | 'shadow' | 'light' | 'highlight' | 'specular';

export interface HdrZone {
  x: number;          // [-1, 1] chromaticity wheel X
  y: number;          // [-1, 1] chromaticity wheel Y
  exposure: number;   // [-2, 2] EV stops within zone
  saturation: number; // [0, 2] default 1.0
  falloffMin: number; // [0, 1] zone lower boundary
  falloffMax: number; // [0, 1] zone upper boundary
}

export interface HdrState {
  globalExposure: number;   // [-3, 3]
  globalSaturation: number; // [0, 2]
  globalTemp: number;       // [-1, 1]
  globalTint: number;       // [-1, 1]
  zones: Record<HdrZoneId, HdrZone>;
  previewZone: HdrZoneId | null;
}

export interface CurvePoint {
  x: number; // [0, 1]
  y: number; // [0, 1]
}

export type CustomCurveChannel = 'master' | 'red' | 'green' | 'blue';
export type SecondaryCurveType =
  | 'hueVsHue'
  | 'hueVsSat'
  | 'hueVsLum'
  | 'lumVsSat'
  | 'satVsSat'
  | 'satVsLum';

export interface CurvesState {
  master: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
  hueVsHue: CurvePoint[];
  hueVsSat: CurvePoint[];
  hueVsLum: CurvePoint[];
  lumVsSat: CurvePoint[];
  satVsSat: CurvePoint[];
  satVsLum: CurvePoint[];
}

export interface QualifierState {
  enabled: boolean;
  showMatte: boolean;
  invert: boolean;
  hueCenter: number;    // [0, 360] degrees
  hueWidth: number;     // [5, 180] degrees
  hueSoftness: number;  // [0, 90] degrees
  satMin: number;       // [0, 1]
  satMax: number;       // [0, 1]
  satSoftness: number;  // [0, 0.5]
  lumMin: number;       // [0, 1]
  lumMax: number;       // [0, 1]
  lumSoftness: number;  // [0, 0.5]
  // Secondary correction applied inside matte
  secHueShift: number;  // [-180, 180]
  secSaturation: number;// [0, 2]
  secGain: number;      // [0.2, 2.0]
  secGamma: number;     // [-0.5, 0.5]
  secTintX: number;     // [-1, 1]
  secTintY: number;     // [-1, 1]
}

export interface FinishState {
  splitShadowHue: number;    // [0, 360]
  splitShadowSat: number;    // [0, 1]
  splitHighlightHue: number; // [0, 360]
  splitHighlightSat: number; // [0, 1]
  splitBalance: number;      // [-1, 1]
  vignetteAmount: number;    // [-1, 1] negative darkens edges, positive brightens
  vignetteMidpoint: number;  // [0.1, 0.9]
  vignetteRoundness: number; // [0.2, 1.5]
  vignetteFeather: number;   // [0.1, 1.0]
  halationAmount: number;    // [0, 1]
  halationThreshold: number; // [0.4, 0.98]
  grainAmount: number;       // [0, 1]
  grainSize: number;         // [0.5, 3.0]
  lutMix: number;            // [0, 1]
  lutName: string | null;
}

export interface CubeLutData {
  title: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  /** Float32Array of length size * size * size * 4 (RGBA padded for WebGL2 3D texture) */
  data: Float32Array;
}

export type MaskShape = 'none' | 'ellipse' | 'rectangle' | 'linear';

export interface MaskState {
  shape: MaskShape;
  centerX: number;     // [0, 1]
  centerY: number;     // [0, 1]
  width: number;       // [0.02, 1.0]
  height: number;      // [0.02, 1.0]
  rotation: number;    // [-180, 180] degrees
  feather: number;     // [0.0, 0.8]
  invert: boolean;
  showOverlay: boolean;
  showMatte: boolean;
}

export interface GradeNode {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number; // [0, 1] key output gain / blend
  primaries: PrimariesState;
  hdr: HdrState;
  curves: CurvesState;
  qualifier: QualifierState;
  mask: MaskState;
  finish: FinishState;
  lut: CubeLutData | null;
}

export interface VideoShot {
  id: string;
  name: string;
  startSec: number;
  endSec: number;
  nodes: GradeNode[];
  activeNodeId: string;
}

export type ToolTab = 'primaries' | 'hdr' | 'curves' | 'qualifier' | 'mask' | 'finish';
export type PrimarySubMode = 'wheels' | 'log' | 'bars';
export type CompareMode = 'normal' | 'wipe' | 'split';
export type ScopeMode = 'parade' | 'waveform' | 'vectorscope' | 'histogram';
export type ViewerOverlay = 'none' | 'falseColor' | 'clipping';

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  src: string;
  subtitle?: string;
}

export interface SnapshotStill {
  id: string;
  name: string;
  createdAt: string;
  thumbnailDataUrl: string;
  nodes: GradeNode[];
}

export function createDefaultWheel(): WheelValue {
  return { x: 0, y: 0, luma: 0 };
}

export function createDefaultPrimaries(): PrimariesState {
  return {
    lift: createDefaultWheel(),
    gamma: createDefaultWheel(),
    gain: createDefaultWheel(),
    offset: createDefaultWheel(),
    logShadows: createDefaultWheel(),
    logMidtones: createDefaultWheel(),
    logHighlights: createDefaultWheel(),
    logLowRange: 0.30,
    logHighRange: 0.68,
    exposure: 0,
    contrast: 1,
    pivot: 0.435,
    temperature: 0,
    tint: 0,
    saturation: 1,
    vibrance: 0,
    highlights: 0,
    shadows: 0,
    midtoneDetail: 0,
    hueRotate: 0,
  };
}

export function createDefaultHdr(): HdrState {
  return {
    globalExposure: 0,
    globalSaturation: 1,
    globalTemp: 0,
    globalTint: 0,
    previewZone: null,
    zones: {
      black:     { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.00, falloffMax: 0.16 },
      dark:      { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.08, falloffMax: 0.36 },
      shadow:    { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.22, falloffMax: 0.56 },
      light:     { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.44, falloffMax: 0.78 },
      highlight: { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.64, falloffMax: 0.92 },
      specular:  { x: 0, y: 0, exposure: 0, saturation: 1, falloffMin: 0.82, falloffMax: 1.00 },
    },
  };
}

export function createDefaultCurves(): CurvesState {
  const linear = () => [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];
  const flatMid = () => [
    { x: 0, y: 0.5 },
    { x: 1, y: 0.5 },
  ];
  return {
    master: linear(),
    red: linear(),
    green: linear(),
    blue: linear(),
    hueVsHue: flatMid(),
    hueVsSat: flatMid(),
    hueVsLum: flatMid(),
    lumVsSat: flatMid(),
    satVsSat: flatMid(),
    satVsLum: flatMid(),
  };
}

export function createDefaultQualifier(): QualifierState {
  return {
    enabled: false,
    showMatte: false,
    invert: false,
    hueCenter: 30,
    hueWidth: 45,
    hueSoftness: 18,
    satMin: 0.15,
    satMax: 1.0,
    satSoftness: 0.12,
    lumMin: 0.12,
    lumMax: 0.92,
    lumSoftness: 0.12,
    secHueShift: 0,
    secSaturation: 1,
    secGain: 1,
    secGamma: 0,
    secTintX: 0,
    secTintY: 0,
  };
}

export function createDefaultFinish(): FinishState {
  return {
    splitShadowHue: 215,
    splitShadowSat: 0,
    splitHighlightHue: 38,
    splitHighlightSat: 0,
    splitBalance: 0,
    vignetteAmount: 0,
    vignetteMidpoint: 0.58,
    vignetteRoundness: 0.85,
    vignetteFeather: 0.55,
    halationAmount: 0,
    halationThreshold: 0.78,
    grainAmount: 0,
    grainSize: 1.2,
    lutMix: 1.0,
    lutName: null,
  };
}

export function createDefaultMask(): MaskState {
  return {
    shape: 'none',
    centerX: 0.5,
    centerY: 0.5,
    width: 0.32,
    height: 0.36,
    rotation: 0,
    feather: 0.22,
    invert: false,
    showOverlay: true,
    showMatte: false,
  };
}

export function createGradeNode(name = 'Primary Balance', id?: string): GradeNode {
  return {
    id: id ?? `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    enabled: true,
    opacity: 1,
    primaries: createDefaultPrimaries(),
    hdr: createDefaultHdr(),
    curves: createDefaultCurves(),
    qualifier: createDefaultQualifier(),
    mask: createDefaultMask(),
    finish: createDefaultFinish(),
    lut: null,
  };
}

export function cloneGradeNode(node: GradeNode, newId?: string): GradeNode {
  return {
    ...node,
    id: newId ?? node.id,
    primaries: {
      ...node.primaries,
      lift: { ...node.primaries.lift },
      gamma: { ...node.primaries.gamma },
      gain: { ...node.primaries.gain },
      offset: { ...node.primaries.offset },
      logShadows: { ...node.primaries.logShadows },
      logMidtones: { ...node.primaries.logMidtones },
      logHighlights: { ...node.primaries.logHighlights },
    },
    hdr: {
      ...node.hdr,
      zones: {
        black: { ...node.hdr.zones.black },
        dark: { ...node.hdr.zones.dark },
        shadow: { ...node.hdr.zones.shadow },
        light: { ...node.hdr.zones.light },
        highlight: { ...node.hdr.zones.highlight },
        specular: { ...node.hdr.zones.specular },
      },
    },
    curves: {
      master: node.curves.master.map((p) => ({ ...p })),
      red: node.curves.red.map((p) => ({ ...p })),
      green: node.curves.green.map((p) => ({ ...p })),
      blue: node.curves.blue.map((p) => ({ ...p })),
      hueVsHue: node.curves.hueVsHue.map((p) => ({ ...p })),
      hueVsSat: node.curves.hueVsSat.map((p) => ({ ...p })),
      hueVsLum: node.curves.hueVsLum.map((p) => ({ ...p })),
      lumVsSat: node.curves.lumVsSat.map((p) => ({ ...p })),
      satVsSat: node.curves.satVsSat.map((p) => ({ ...p })),
      satVsLum: node.curves.satVsLum.map((p) => ({ ...p })),
    },
    qualifier: { ...node.qualifier },
    mask: { ...node.mask },
    finish: { ...node.finish },
    lut: node.lut,
  };
}

export function cloneNodes(nodes: GradeNode[]): GradeNode[] {
  return nodes.map((n) => cloneGradeNode(n));
}

/**
 * Convert 2D color wheel (x, y) inside unit circle to calibrated RGB balance vector.
 * Follows standard CIE/DaVinci vectorscope orientation:
 * +Y = Red/Magenta-ish top, rotated so Red ~ 103deg, Yellow ~ 167deg, Green ~ 241deg, Cyan ~ 283deg, Blue ~ 347deg, Magenta ~ 61deg.
 * Using intuitive visual wheel mapping matching our color wheel ring:
 * Angle 0 (right) = Red/Orange, 60 = Yellow, 120 = Green, 180 = Cyan, 240 = Blue, 300 = Magenta
 * Wait: let's match standard HSV wheel where angle = atan2(-y, x):
 * 0° (right) = Red, 60° (top-right) = Yellow, 120° (top-left) = Green, 180° (left) = Cyan, 240° (bottom-left) = Blue, 300° (bottom-right) = Magenta.
 */
export function wheelToRgbOffset(x: number, y: number): [number, number, number] {
  const mag = Math.min(1, Math.hypot(x, y));
  if (mag < 1e-5) return [0, 0, 0];
  let angle = Math.atan2(-y, x); // screen Y-down to math Y-up
  if (angle < 0) angle += Math.PI * 2;

  // Compute balanced zero-sum RGB weights along the hue circle
  const r = Math.cos(angle);
  const g = Math.cos(angle - (2 * Math.PI) / 3);
  const b = Math.cos(angle - (4 * Math.PI) / 3);

  // Normalize so peak channel reaches 1.0 at edge
  return [r * mag, g * mag, b * mag];
}
