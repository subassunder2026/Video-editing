import {
  createGradeNode,
  type GradeNode,
  type MediaItem,
} from '../types/grading';

export const SAMPLE_MEDIA: MediaItem[] = [
  {
    id: 'sample_portrait',
    name: 'Cafe Twilight 35mm',
    type: 'image',
    src: '/src/assets/images/sample_cinema_portrait_1795263435827.jpg',
    subtitle: 'Mixed Tungsten / Dusk Skin',
  },
  {
    id: 'sample_coast',
    name: 'Basalt Sea Cliffs',
    type: 'image',
    src: '/src/assets/images/sample_landscape_coast_1795263435648.jpg',
    subtitle: 'Wide Dynamic Range HDR',
  },
  {
    id: 'sample_night',
    name: 'Wet Alley Speculars',
    type: 'image',
    src: '/src/assets/images/sample_night_street_1795263437426.jpg',
    subtitle: 'Night Lanterns & Highlights',
  },
  {
    id: 'sample_studio',
    name: 'Studio Color Chart',
    type: 'image',
    src: '/src/assets/images/sample_studio_color_1795263436298.jpg',
    subtitle: 'Hue / Sat Calibration',
  },
];

export interface GradingLookPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  buildNodes: () => GradeNode[];
}

export const LOOK_PRESETS: GradingLookPreset[] = [
  {
    id: 'clean_rec709',
    name: 'Neutral Rec.709',
    category: 'Technical',
    description: 'Clean linear baseline reset',
    buildNodes: () => [createGradeNode('Primary Balance')],
  },
  {
    id: 'kodak_2383',
    name: 'Kodak 2383 Print',
    category: 'Film Print',
    description: 'Rich toe contrast, cyan shadows, golden highlights, subtle halation',
    buildNodes: () => {
      const n1 = createGradeNode('Base Balance');
      n1.primaries.contrast = 1.18;
      n1.primaries.pivot = 0.44;
      n1.primaries.saturation = 1.08;
      n1.primaries.lift = { x: -0.22, y: -0.14, luma: -0.05 };
      n1.primaries.gamma = { x: 0.08, y: 0.04, luma: -0.02 };
      n1.primaries.gain = { x: 0.16, y: 0.14, luma: 0.05 };
      n1.curves.master = [
        { x: 0, y: 0.025 },
        { x: 0.22, y: 0.17 },
        { x: 0.52, y: 0.53 },
        { x: 0.80, y: 0.84 },
        { x: 1, y: 0.975 },
      ];
      n1.curves.lumVsSat = [
        { x: 0, y: 0.36 },
        { x: 0.18, y: 0.50 },
        { x: 0.85, y: 0.50 },
        { x: 1, y: 0.38 },
      ];

      const n2 = createGradeNode('2383 Print Finish');
      n2.finish.splitShadowHue = 205;
      n2.finish.splitShadowSat = 0.24;
      n2.finish.splitHighlightHue = 42;
      n2.finish.splitHighlightSat = 0.22;
      n2.finish.halationAmount = 0.28;
      n2.finish.halationThreshold = 0.78;
      n2.finish.grainAmount = 0.16;
      n2.finish.vignetteAmount = -0.22;
      return [n1, n2];
    },
  },
  {
    id: 'fuji_eterna',
    name: 'Fuji Eterna 250D',
    category: 'Film Print',
    description: 'Lifted matte blacks, emerald greens, soft rolled highlights',
    buildNodes: () => {
      const n1 = createGradeNode('Eterna Emulsion');
      n1.primaries.contrast = 0.94;
      n1.primaries.saturation = 0.88;
      n1.primaries.vibrance = 0.15;
      n1.primaries.tint = -0.08;
      n1.primaries.highlights = -0.22;
      n1.primaries.shadows = 0.14;
      n1.curves.master = [
        { x: 0, y: 0.065 },
        { x: 0.25, y: 0.24 },
        { x: 0.75, y: 0.76 },
        { x: 1, y: 0.94 },
      ];
      n1.curves.hueVsHue = [
        { x: 0, y: 0.5 },
        { x: 0.33, y: 0.56 },
        { x: 0.62, y: 0.46 },
        { x: 1, y: 0.5 },
      ];
      n1.finish.grainAmount = 0.2;
      return [n1];
    },
  },
  {
    id: 'teal_orange',
    name: 'Cinema Blockbuster',
    category: 'Cinematic',
    description: 'Deep teal shadows separated against warm skin-tone highlights',
    buildNodes: () => {
      const n1 = createGradeNode('Primary Contrast');
      n1.primaries.contrast = 1.22;
      n1.primaries.pivot = 0.42;
      n1.primaries.midtoneDetail = 0.22;
      n1.primaries.logShadows = { x: -0.34, y: -0.10, luma: -0.06 };
      n1.primaries.logHighlights = { x: 0.26, y: 0.15, luma: 0.04 };
      n1.hdr.zones.specular.exposure = 0.18;
      n1.hdr.zones.black.exposure = -0.22;

      const n2 = createGradeNode('Hue Separation');
      n2.curves.hueVsHue = [
        { x: 0, y: 0.5 },
        { x: 0.08, y: 0.48 },
        { x: 0.55, y: 0.48 },
        { x: 0.65, y: 0.44 },
        { x: 1, y: 0.5 },
      ];
      n2.curves.satVsLum = [
        { x: 0, y: 0.5 },
        { x: 0.75, y: 0.45 },
        { x: 1, y: 0.42 },
      ];
      n2.finish.vignetteAmount = -0.28;
      return [n1, n2];
    },
  },
  {
    id: 'bleach_bypass',
    name: 'Bleach Bypass',
    category: 'Film Process',
    description: 'Silver-retained high contrast, muted chroma, crisp midtone edge',
    buildNodes: () => {
      const n1 = createGradeNode('Silver Retention');
      n1.primaries.contrast = 1.42;
      n1.primaries.pivot = 0.45;
      n1.primaries.saturation = 0.44;
      n1.primaries.midtoneDetail = 0.42;
      n1.primaries.highlights = 0.18;
      n1.primaries.shadows = -0.18;
      n1.hdr.zones.dark.exposure = -0.32;
      n1.hdr.zones.highlight.exposure = 0.24;
      n1.finish.grainAmount = 0.28;
      n1.finish.vignetteAmount = -0.32;
      return [n1];
    },
  },
  {
    id: 'hdr_punch',
    name: 'HDR Dynamic Sculpt',
    category: 'HDR Grade',
    description: 'Deepened blacks, luminous specular roll-off, rich micro-detail',
    buildNodes: () => {
      const n1 = createGradeNode('HDR Zones');
      n1.hdr.zones.black.exposure = -0.35;
      n1.hdr.zones.dark.exposure = -0.15;
      n1.hdr.zones.shadow.exposure = 0.16;
      n1.hdr.zones.light.exposure = 0.12;
      n1.hdr.zones.highlight.exposure = -0.18;
      n1.hdr.zones.specular.exposure = 0.34;
      n1.hdr.zones.specular.x = 0.12;
      n1.hdr.zones.specular.y = 0.08;
      n1.hdr.globalSaturation = 1.14;
      n1.primaries.midtoneDetail = 0.26;
      return [n1];
    },
  },
  {
    id: 'tungsten_night',
    name: 'Tungsten Nocturne',
    category: 'Mood',
    description: 'Cool slate twilight balance with amber practical bloom',
    buildNodes: () => {
      const n1 = createGradeNode('Nocturne Base');
      n1.primaries.temperature = -0.22;
      n1.primaries.contrast = 1.16;
      n1.primaries.lift = { x: -0.20, y: -0.18, luma: -0.04 };
      n1.hdr.zones.highlight.x = 0.28;
      n1.hdr.zones.highlight.y = 0.14;
      n1.hdr.zones.specular.x = 0.35;
      n1.hdr.zones.specular.y = 0.18;
      n1.finish.halationAmount = 0.42;
      n1.finish.halationThreshold = 0.72;
      n1.finish.vignetteAmount = -0.35;
      return [n1];
    },
  },
  {
    id: 'silver_noir',
    name: 'Silver Gelatin Noir',
    category: 'Monochrome',
    description: 'High-drama B&W print with deep selenium shadows and film grain',
    buildNodes: () => {
      const n1 = createGradeNode('Monochrome Print');
      n1.primaries.saturation = 0;
      n1.primaries.contrast = 1.38;
      n1.primaries.pivot = 0.44;
      n1.primaries.midtoneDetail = 0.34;
      n1.curves.master = [
        { x: 0, y: 0.015 },
        { x: 0.20, y: 0.13 },
        { x: 0.50, y: 0.52 },
        { x: 0.82, y: 0.89 },
        { x: 1, y: 0.99 },
      ];
      n1.finish.splitShadowHue = 225;
      n1.finish.splitShadowSat = 0.10;
      n1.finish.grainAmount = 0.32;
      n1.finish.grainSize = 1.4;
      n1.finish.vignetteAmount = -0.38;
      return [n1];
    },
  },
];
