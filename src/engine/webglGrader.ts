import { packCurvesToTextureData } from './curveMath';
import {
  wheelToRgbOffset,
  type CompareMode,
  type CubeLutData,
  type GradeNode,
  type HdrZoneId,
  type ViewerOverlay,
} from '../types/grading';

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const NODE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uCurveTex;
uniform sampler3D uLutTex;
uniform vec2 uTexelSize;
uniform float uOpacity;
uniform int uDisableSpatial;
uniform float uTimeSeed;

// Primary adjustments
uniform float uExposure;
uniform float uContrast;
uniform float uPivot;
uniform float uTemp;
uniform float uTint;
uniform float uSaturation;
uniform float uVibrance;
uniform float uHighlights;
uniform float uShadows;
uniform float uMidtoneDetail;
uniform float uHueRotate;

// Primary wheels (xyz = rgb vector, w = luma)
uniform vec4 uLift;
uniform vec4 uGamma;
uniform vec4 uGain;
uniform vec4 uOffset;

// Log wheels
uniform vec4 uLogShadows;
uniform vec4 uLogMidtones;
uniform vec4 uLogHighlights;
uniform vec2 uLogRanges;

// HDR Global + 6 Zones
uniform vec4 uHdrGlobal; // x=exp, y=sat, z=temp, w=tint
uniform int uHdrPreviewZone; // -1 none, 0..5 zone index
uniform vec4 uHdrWheel[6]; // xyz=rgb, w=exposure
uniform vec4 uHdrParams[6]; // x=sat, y=min, z=max, w=unused

// Qualifier
uniform int uQualEnabled;
uniform int uQualShowMatte;
uniform int uQualInvert;
uniform vec3 uQualHue; // center(0..1), halfWidth(0..0.5), softness(0..0.25)
uniform vec3 uQualSat; // min, max, soft
uniform vec3 uQualLum; // min, max, soft
uniform vec4 uQualSec1; // hueShift(-0.5..0.5), sat(0..2), gain, gamma
uniform vec3 uQualSecTint;

// Finish
uniform vec4 uSplitShadow; // rgb, sat
uniform vec4 uSplitHigh;   // rgb, sat
uniform float uSplitBalance;
uniform vec4 uVignette; // amount, midpoint, roundness, feather
uniform vec2 uHalation; // amount, threshold
uniform vec2 uGrain;    // amount, size
uniform int uHasLut;
uniform float uLutMix;
uniform float uLutSize;

// Power Window Spatial Mask
uniform int uMaskShape;      // 0=none, 1=ellipse, 2=rectangle, 3=linear
uniform vec2 uMaskCenter;    // normalized WebGL UV center
uniform vec2 uMaskSize;      // width, height radii
uniform vec4 uMaskParams;    // x=rotRad, y=feather, z=invert(0/1), w=showMatte(0/1)

const vec3 LUMA_W = vec3(0.2126, 0.7152, 0.0722);

float getLuma(vec3 c) {
  return dot(c, LUMA_W);
}

vec3 rgb2hsl(vec3 c) {
  float maxC = max(max(c.r, c.g), c.b);
  float minC = min(min(c.r, c.g), c.b);
  float l = 0.5 * (maxC + minC);
  float d = maxC - minC;
  float s = 0.0;
  float h = 0.0;
  if (d > 1e-5) {
    s = d / (1.0 - abs(2.0 * l - 1.0) + 1e-5);
    if (maxC == c.r) {
      h = mod((c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0), 6.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / d + 2.0;
    } else {
      h = (c.r - c.g) / d + 4.0;
    }
    h /= 6.0;
  }
  return vec3(fract(h), clamp(s, 0.0, 1.0), clamp(l, 0.0, 1.0));
}

float hue2rgb(float p, float q, float t) {
  t = fract(t);
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = fract(hsl.x);
  float s = clamp(hsl.y, 0.0, 1.0);
  float l = clamp(hsl.z, 0.0, 1.0);
  if (s < 1e-5) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0 / 3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0 / 3.0)
  );
}

float sampleCurve(int row, float x) {
  float u = clamp(x, 0.0, 1.0);
  float v = (float(row) + 0.5) / 10.0;
  vec4 tex = texture(uCurveTex, vec2(u, v));
  return (tex.r * 255.0 * 256.0 + tex.g * 255.0) / 65535.0;
}

vec3 applyWhiteBalance(vec3 col, float temp, float tint) {
  // Perceptual Planckian warm/cool + green/magenta balance
  vec3 wb = vec3(
    1.0 + temp * 0.28 + tint * 0.12,
    1.0 - tint * 0.20,
    1.0 - temp * 0.28 + tint * 0.12
  );
  float lumBefore = getLuma(col);
  vec3 shifted = col * max(wb, vec3(0.15));
  float lumAfter = getLuma(shifted);
  if (lumAfter > 1e-4) {
    shifted *= mix(1.0, lumBefore / lumAfter, 0.45);
  }
  return shifted;
}

float hdrZoneWeight(int idx, float lum, float zMin, float zMax) {
  float safeMax = max(zMin + 0.005, zMax);
  float span = safeMax - zMin;
  if (idx == 0) {
    return 1.0 - smoothstep(zMin, safeMax, lum);
  }
  if (idx == 5) {
    return smoothstep(zMin, safeMax, lum);
  }
  float mid = 0.5 * (zMin + safeMax);
  float halfSpan = 0.5 * span;
  float dist = abs(lum - mid) / max(0.01, halfSpan);
  float t = clamp(1.0 - dist, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 srcSample = texture(uImage, vUv);
  vec3 orig = srcSample.rgb;
  vec3 col = orig;

  // 1. Midtone Detail (local unsharp micro-contrast in midtones)
  if (uDisableSpatial == 0 && abs(uMidtoneDetail) > 0.001) {
    vec3 blur = (
      texture(uImage, vUv + vec2(uTexelSize.x * 1.5, 0.0)).rgb +
      texture(uImage, vUv - vec2(uTexelSize.x * 1.5, 0.0)).rgb +
      texture(uImage, vUv + vec2(0.0, uTexelSize.y * 1.5)).rgb +
      texture(uImage, vUv - vec2(0.0, uTexelSize.y * 1.5)).rgb
    ) * 0.25;
    float l = clamp(getLuma(col), 0.0, 1.0);
    float midMask = 4.0 * l * (1.0 - l);
    col += (col - blur) * uMidtoneDetail * 1.35 * midMask;
  }

  // 2. White Balance
  if (abs(uTemp) > 0.0005 || abs(uTint) > 0.0005) {
    col = applyWhiteBalance(col, uTemp, uTint);
  }

  // 3. Primary Exposure & Shadow/Highlight Recovery
  if (abs(uExposure) > 0.0005) {
    col *= pow(2.0, uExposure);
  }
  if (abs(uShadows) > 0.0005 || abs(uHighlights) > 0.0005) {
    float l = clamp(getLuma(col), 0.0, 1.0);
    float shadowW = pow(1.0 - l, 2.4);
    float highW = pow(l, 2.4);
    col += col * (uShadows * 0.75 * shadowW) + (uShadows * 0.12 * shadowW);
    col -= col * (-uHighlights * 0.48 * highW) - (uHighlights * 0.10 * highW);
  }

  // 4. Primary Color Wheels (Offset -> Lift -> Gain -> Gamma)
  vec3 offsetVec = uOffset.rgb * 0.35 + vec3(uOffset.a * 0.35);
  col += offsetVec;

  vec3 liftVec = uLift.rgb * 0.32 + vec3(uLift.a * 0.32);
  col = col + liftVec * (1.0 - clamp(col, 0.0, 1.0));

  vec3 gainVec = max(vec3(0.05), vec3(1.0) + uGain.rgb * 0.65 + vec3(uGain.a * 0.65));
  col *= gainVec;

  vec3 gammaVec = max(vec3(0.2), vec3(1.0) + uGamma.rgb * 0.7 + vec3(uGamma.a * 0.7));
  col = max(col, vec3(0.0));
  col = pow(col, 1.0 / gammaVec);

  // 5. Log Grading Wheels (Shadows / Midtones / Highlights with configurable ranges)
  {
    float l = clamp(getLuma(col), 0.0, 1.0);
    float wS = 1.0 - smoothstep(0.0, uLogRanges.x, l);
    float wH = smoothstep(uLogRanges.y, 1.0, l);
    float wM = max(0.0, 1.0 - wS - wH);

    vec3 logS = uLogShadows.rgb * 0.30 + vec3(uLogShadows.a * 0.28);
    vec3 logM = uLogMidtones.rgb * 0.30 + vec3(uLogMidtones.a * 0.28);
    vec3 logH = uLogHighlights.rgb * 0.30 + vec3(uLogHighlights.a * 0.28);

    col += logS * wS + logM * wM + logH * wH;
  }

  // 6. Contrast around Pivot (with gentle filmic shoulder)
  if (abs(uContrast - 1.0) > 0.0005) {
    col = (col - uPivot) * uContrast + uPivot;
  }

  // 7. Saturation, Vibrance & Global Hue Rotation
  if (abs(uSaturation - 1.0) > 0.0005 || abs(uVibrance) > 0.0005) {
    float l = getLuma(col);
    float maxC = max(max(col.r, col.g), col.b);
    float minC = min(min(col.r, col.g), col.b);
    float satEst = maxC - minC;
    float vibFactor = 1.0 + uVibrance * (1.0 - smoothstep(0.0, 0.75, satEst));
    col = mix(vec3(l), col, max(0.0, uSaturation * vibFactor));
  }
  if (abs(uHueRotate) > 0.05) {
    vec3 hsl = rgb2hsl(clamp(col, 0.0, 1.0));
    hsl.x = fract(hsl.x + uHueRotate / 360.0);
    col = hsl2rgb(hsl);
  }

  // 8. HDR 6-Zone Perceptual Grading Palette
  {
    if (abs(uHdrGlobal.z) > 0.0005 || abs(uHdrGlobal.w) > 0.0005) {
      col = applyWhiteBalance(col, uHdrGlobal.z, uHdrGlobal.w);
    }
    if (abs(uHdrGlobal.x) > 0.0005) {
      col *= pow(2.0, uHdrGlobal.x);
    }
    if (abs(uHdrGlobal.y - 1.0) > 0.0005) {
      float gl = getLuma(col);
      col = mix(vec3(gl), col, uHdrGlobal.y);
    }

    float baseLum = clamp(getLuma(col), 0.0, 1.0);
    float previewW = 0.0;

    for (int i = 0; i < 6; i++) {
      float zMin = uHdrParams[i].y;
      float zMax = uHdrParams[i].z;
      float w = hdrZoneWeight(i, baseLum, zMin, zMax);
      if (i == uHdrPreviewZone) {
        previewW = w;
      }

      vec3 zTint = uHdrWheel[i].rgb;
      float zExp = uHdrWheel[i].a;
      float zSat = uHdrParams[i].x;

      if (w > 0.0005 && (abs(zExp) > 0.0005 || length(zTint) > 0.0005 || abs(zSat - 1.0) > 0.0005)) {
        vec3 zoneCol = col;
        // EV exposure scaled cleanly in this tonal zone
        zoneCol *= pow(2.0, zExp * 0.85);
        // Chromaticity push inside zone
        zoneCol += zTint * 0.24 * (0.25 + 0.75 * clamp(getLuma(zoneCol), 0.0, 1.0));
        // Zone saturation
        float zl = getLuma(zoneCol);
        zoneCol = mix(vec3(zl), zoneCol, zSat);
        col = mix(col, zoneCol, w);
      }
    }

    if (uHdrPreviewZone >= 0 && uDisableSpatial == 0) {
      float gl = getLuma(clamp(col, 0.0, 1.0));
      vec3 dimmed = vec3(gl * 0.22);
      vec3 maskTint = mix(vec3(0.90, 0.54, 0.18), vec3(1.0, 0.85, 0.45), previewW);
      col = mix(dimmed, mix(col, maskTint, 0.35), previewW);
      fragColor = vec4(clamp(col, 0.0, 1.0), srcSample.a);
      return;
    }
  }

  // 9. Custom Curves (Master Y + R/G/B)
  col = clamp(col, 0.0, 1.0);
  col = vec3(
    sampleCurve(0, col.r),
    sampleCurve(0, col.g),
    sampleCurve(0, col.b)
  );
  col = vec3(
    sampleCurve(1, col.r),
    sampleCurve(2, col.g),
    sampleCurve(3, col.b)
  );

  // 10. Secondary HSL Curves (HvH, HvS, HvL, LvS, SvS, SvL)
  {
    vec3 hsl = rgb2hsl(clamp(col, 0.0, 1.0));
    float h = hsl.x;
    float s = hsl.y;
    float l = hsl.z;

    float hvh = sampleCurve(4, h) - 0.5;
    float hvs = sampleCurve(5, h) - 0.5;
    float hvl = sampleCurve(6, h) - 0.5;
    float lvs = sampleCurve(7, l) - 0.5;
    float svs = sampleCurve(8, s) - 0.5;
    float svl = sampleCurve(9, s) - 0.5;

    float changed = abs(hvh) + abs(hvs) + abs(hvl) + abs(lvs) + abs(svs) + abs(svl);
    if (changed > 0.002) {
      float newH = fract(h + hvh * 0.5);
      float satMult = pow(4.0, (hvs + lvs + svs) * 2.0);
      float newS = clamp(s * satMult, 0.0, 1.0);
      // Weight Hue vs Lum by pixel saturation so neutral greys aren't tinted weirdly
      float hueWeight = smoothstep(0.02, 0.18, s);
      float newL = clamp(l + hvl * 0.55 * hueWeight + svl * 0.55, 0.0, 1.0);
      col = hsl2rgb(vec3(newH, newS, newL));
    }
  }

  // 11. HSL Secondary Qualifier
  if (uQualEnabled == 1) {
    vec3 qHsl = rgb2hsl(clamp(col, 0.0, 1.0));
    // Circular hue distance [0, 0.5]
    float dHue = abs(qHsl.x - uQualHue.x);
    dHue = min(dHue, 1.0 - dHue);
    float mHue = 1.0 - smoothstep(uQualHue.y, uQualHue.y + max(0.005, uQualHue.z), dHue);

    float mSatLow = smoothstep(uQualSat.x - max(0.005, uQualSat.z), uQualSat.x + 0.001, qHsl.y);
    float mSatHigh = 1.0 - smoothstep(uQualSat.y - 0.001, uQualSat.y + max(0.005, uQualSat.z), qHsl.y);
    float mSat = mSatLow * mSatHigh;

    float mLumLow = smoothstep(uQualLum.x - max(0.005, uQualLum.z), uQualLum.x + 0.001, qHsl.z);
    float mLumHigh = 1.0 - smoothstep(uQualLum.y - 0.001, uQualLum.y + max(0.005, uQualLum.z), qHsl.z);
    float mLum = mLumLow * mLumHigh;

    float matte = clamp(mHue * mSat * mLum, 0.0, 1.0);
    if (uQualInvert == 1) {
      matte = 1.0 - matte;
    }

    vec3 sec = col;
    if (abs(uQualSec1.x) > 0.001 || abs(uQualSec1.y - 1.0) > 0.001) {
      vec3 shsl = rgb2hsl(clamp(sec, 0.0, 1.0));
      shsl.x = fract(shsl.x + uQualSec1.x);
      shsl.y = clamp(shsl.y * uQualSec1.y, 0.0, 1.0);
      sec = hsl2rgb(shsl);
    }
    sec *= max(0.05, uQualSec1.z);
    sec = pow(max(sec, vec3(0.0)), vec3(1.0 / max(0.2, 1.0 + uQualSec1.w)));
    sec += uQualSecTint * 0.25;

    col = mix(col, sec, matte);

    if (uQualShowMatte == 1 && uDisableSpatial == 0) {
      float gl = getLuma(clamp(col, 0.0, 1.0));
      vec3 bg = vec3(gl * 0.18 + 0.06);
      col = mix(bg, col, matte);
      fragColor = vec4(clamp(col, 0.0, 1.0), srcSample.a);
      return;
    }
  }

  // 12. Split Toning
  if (uSplitShadow.a > 0.001 || uSplitHigh.a > 0.001) {
    float l = clamp(getLuma(col), 0.0, 1.0);
    float pivotSplit = clamp(0.5 - uSplitBalance * 0.35, 0.08, 0.92);
    float highW = smoothstep(pivotSplit - 0.28, pivotSplit + 0.28, l);
    float shadowW = 1.0 - highW;
    vec3 shTint = mix(vec3(1.0), uSplitShadow.rgb * 1.4, uSplitShadow.a * 0.55);
    vec3 hiTint = mix(vec3(1.0), uSplitHigh.rgb * 1.4, uSplitHigh.a * 0.55);
    col = mix(col * shTint, col * hiTint, highW);
    // Keep blacks clean
    col = mix(col, col + (uSplitShadow.rgb - 0.5) * uSplitShadow.a * 0.09, shadowW * (1.0 - l));
  }

  // 13. 3D LUT Lookup (Trilinear WebGL2 sampler3D)
  if (uHasLut == 1 && uLutMix > 0.001) {
    vec3 cClamped = clamp(col, 0.0, 1.0);
    float scale = (uLutSize - 1.0) / uLutSize;
    float offsetLut = 0.5 / uLutSize;
    vec3 lutCoord = cClamped * scale + offsetLut;
    vec3 lutCol = texture(uLutTex, lutCoord).rgb;
    col = mix(col, lutCol, uLutMix);
  }

  // 14. Film Halation (warm red-orange specular highlight scatter)
  if (uDisableSpatial == 0 && uHalation.x > 0.001) {
    vec3 glow = vec3(0.0);
    float totalW = 0.0;
    float r = 4.5;
    for (int i = -2; i <= 2; i++) {
      for (int j = -2; j <= 2; j++) {
        vec2 off = vec2(float(i), float(j)) * uTexelSize * r;
        vec3 s = texture(uImage, vUv + off).rgb;
        float sl = getLuma(s);
        float bright = smoothstep(uHalation.y, min(1.0, uHalation.y + 0.18), sl);
        float w = 1.0 / (1.0 + float(i * i + j * j));
        glow += s * bright * w;
        totalW += w;
      }
    }
    glow /= max(totalW, 0.001);
    col += glow * vec3(1.0, 0.36, 0.14) * uHalation.x * 0.85;
  }

  // 15. Vignette
  if (uDisableSpatial == 0 && abs(uVignette.x) > 0.001) {
    vec2 centered = (vUv - 0.5) * 2.0;
    centered.x *= mix(1.0, 1.35, clamp(1.0 - uVignette.z, -0.5, 1.0));
    float dist = length(centered);
    float edge = smoothstep(uVignette.y, uVignette.y + max(0.05, uVignette.w), dist);
    float vig = 1.0 + uVignette.x * edge * 0.88;
    col *= max(0.05, vig);
  }

  // 16. Organic Film Grain
  if (uDisableSpatial == 0 && uGrain.x > 0.001) {
    vec2 grainUv = floor(vUv / (uTexelSize * max(0.5, uGrain.y)));
    float n = hash12(grainUv + vec2(uTimeSeed, uTimeSeed * 1.37)) - 0.5;
    float n2 = hash12(grainUv * 1.13 + vec2(uTimeSeed * 0.7, 19.1)) - 0.5;
    float grainVal = (n + n2) * 0.5;
    float l = clamp(getLuma(col), 0.0, 1.0);
    float lumWeight = 1.0 - abs(l - 0.45) * 1.15;
    col += vec3(grainVal) * uGrain.x * 0.16 * max(0.2, lumWeight);
  }

  // 17. Power Window Spatial Mask (Ellipse / Rectangle / Linear Gradient)
  float winMask = 1.0;
  if (uDisableSpatial == 0 && uMaskShape > 0) {
    vec2 d = vUv - uMaskCenter;
    float cs = cos(uMaskParams.x);
    float sn = sin(uMaskParams.x);
    vec2 rot = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    float feather = max(0.004, uMaskParams.y);

    if (uMaskShape == 1) {
      // Ellipse
      vec2 norm = rot / max(vec2(0.01), uMaskSize);
      float dist = length(norm);
      winMask = 1.0 - smoothstep(max(0.0, 1.0 - feather), 1.0 + feather, dist);
    } else if (uMaskShape == 2) {
      // Rectangle (SDF)
      vec2 q = abs(rot) - max(vec2(0.01), uMaskSize);
      float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      winMask = 1.0 - smoothstep(-feather * 0.5, feather * 0.5, sdf);
    } else if (uMaskShape == 3) {
      // Linear Gradient (top/side ND filter along rotated Y axis)
      winMask = smoothstep(-feather * 0.65, feather * 0.65, rot.y);
    }

    if (uMaskParams.z > 0.5) {
      winMask = 1.0 - winMask;
    }

    col = mix(orig, col, clamp(uOpacity * winMask, 0.0, 1.0));

    if (uMaskParams.w > 0.5) {
      float gl = getLuma(clamp(col, 0.0, 1.0));
      vec3 dim = vec3(gl * 0.20 + 0.05);
      col = mix(dim, col, winMask);
    }
    fragColor = vec4(clamp(col, 0.0, 1.0), srcSample.a);
    return;
  }

  col = mix(orig, col, clamp(uOpacity, 0.0, 1.0));
  fragColor = vec4(clamp(col, 0.0, 1.0), srcSample.a);
}
`;

const DISPLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uOriginal;
uniform sampler2D uGraded;
uniform int uBypass;
uniform int uCompareMode; // 0=normal, 1=wipe, 2=split
uniform float uWipePos;
uniform int uOverlayMode; // 0=none, 1=falseColor, 2=clipping

const vec3 LUMA_W = vec3(0.2126, 0.7152, 0.0722);

vec3 arriFalseColor(float ire) {
  // Broadcast ARRI-style IRE exposure map
  if (ire < 0.03) return vec3(0.36, 0.08, 0.65);      // Crushed Black (Purple)
  if (ire < 0.09) return vec3(0.08, 0.25, 0.85);      // Deep Shadow (Blue)
  if (ire < 0.20) return vec3(0.05, 0.58, 0.72);      // Shadow Detail (Cyan)
  if (ire < 0.38) return vec3(ire * 1.1);             // Lower Midtones (Gray)
  if (ire < 0.46) return vec3(0.18, 0.72, 0.24);      // 18% Middle Gray (Green)
  if (ire < 0.54) return vec3(ire * 1.05);            // Upper Midtones (Gray)
  if (ire < 0.62) return vec3(0.95, 0.55, 0.68);      // Skin Tone Key ~56 IRE (Pink)
  if (ire < 0.78) return vec3(ire * 1.0);             // Bright Midtones (Gray)
  if (ire < 0.90) return vec3(0.95, 0.84, 0.16);      // High Key (Yellow)
  if (ire < 0.97) return vec3(0.96, 0.45, 0.10);      // Near Clip (Orange)
  return vec3(0.92, 0.12, 0.12);                      // Clipped Highlight (Red)
}

void main() {
  vec2 uv = vUv;
  vec3 orig;
  vec3 grad;
  vec3 finalCol;

  if (uCompareMode == 2) {
    // Side-by-side split view (left original, right graded)
    if (uv.x < 0.5) {
      vec2 subUv = vec2(uv.x * 2.0, uv.y);
      finalCol = texture(uOriginal, subUv).rgb;
    } else {
      vec2 subUv = vec2((uv.x - 0.5) * 2.0, uv.y);
      finalCol = uBypass == 1 ? texture(uOriginal, subUv).rgb : texture(uGraded, subUv).rgb;
    }
  } else {
    orig = texture(uOriginal, uv).rgb;
    grad = uBypass == 1 ? orig : texture(uGraded, uv).rgb;
    if (uCompareMode == 1) {
      finalCol = uv.x < uWipePos ? orig : grad;
    } else {
      finalCol = grad;
    }
  }

  // Diagnostic Overlays
  if (uOverlayMode == 1) {
    float ire = dot(finalCol, LUMA_W);
    finalCol = arriFalseColor(ire);
  } else if (uOverlayMode == 2) {
    float maxC = max(max(finalCol.r, finalCol.g), finalCol.b);
    float minC = min(min(finalCol.r, finalCol.g), finalCol.b);
    if (maxC >= 0.985) {
      float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.12));
      finalCol = mix(vec3(0.95, 0.15, 0.15), vec3(1.0, 0.85, 0.85), stripe * 0.5);
    } else if (minC <= 0.012) {
      float stripe = step(0.5, fract((gl_FragCoord.x - gl_FragCoord.y) * 0.12));
      finalCol = mix(vec3(0.12, 0.35, 0.95), vec3(0.55, 0.78, 1.0), stripe * 0.5);
    }
  }

  fragColor = vec4(finalCol, 1.0);
}
`;

function hueToRgbNormalized(hueDeg: number): [number, number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  if (h < 1) return [1, x, 0];
  if (h < 2) return [x, 1, 0];
  if (h < 3) return [0, 1, x];
  if (h < 4) return [0, x, 1];
  if (h < 5) return [x, 0, 1];
  return [1, 0, x];
}

const HDR_ZONE_ORDER: HdrZoneId[] = ['black', 'dark', 'shadow', 'light', 'highlight', 'specular'];

export interface RenderOptions {
  nodes: GradeNode[];
  activeNodeId: string;
  bypass: boolean;
  compareMode: CompareMode;
  wipePos: number;
  overlayMode: ViewerOverlay;
  timeSeed?: number;
}

export class WebGLColorGrader {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private nodeProgram: WebGLProgram;
  private displayProgram: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private sourceTex: WebGLTexture;
  private curveTex: WebGLTexture;
  private lutTex: WebGLTexture;
  private lutCacheKey = '';
  private fboA: WebGLFramebuffer;
  private fboB: WebGLFramebuffer;
  private texA: WebGLTexture;
  private texB: WebGLTexture;
  private scopeFbo: WebGLFramebuffer;
  private scopeTex: WebGLTexture;
  private fboW = 0;
  private fboH = 0;
  private srcW = 1280;
  private srcH = 720;
  private useFloatFbo = false;
  private scopeW = 240;
  private scopeH = 135;
  private scopeBuffer = new Uint8Array(240 * 135 * 4);
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL2 is required for GPU color grading.');
    }
    this.gl = gl;
    this.useFloatFbo = Boolean(gl.getExtension('EXT_color_buffer_float'));

    this.nodeProgram = this.createProgram(VERTEX_SHADER, NODE_FRAGMENT_SHADER);
    this.displayProgram = this.createProgram(VERTEX_SHADER, DISPLAY_FRAGMENT_SHADER);
    this.quadVao = this.createFullscreenQuad();

    this.sourceTex = this.createTex2D(gl.LINEAR);
    this.curveTex = this.createTex2D(gl.LINEAR);
    this.lutTex = this.createIdentityLut3D();

    this.texA = this.createTex2D(gl.LINEAR);
    this.texB = this.createTex2D(gl.LINEAR);
    this.fboA = gl.createFramebuffer()!;
    this.fboB = gl.createFramebuffer()!;

    // Dedicated downscaled scope readback target
    this.scopeTex = this.createTex2D(gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, this.scopeTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      this.scopeW,
      this.scopeH,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    this.scopeFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scopeFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.scopeTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`GLSL compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const { gl } = this;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error(`GLSL link error: ${info}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private createFullscreenQuad(): WebGLVertexArrayObject {
    const { gl } = this;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private createTex2D(filter: number): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private createIdentityLut3D(): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    const idData = new Uint8Array([
      0, 0, 0, 255, 255, 0, 0, 255,
      0, 255, 0, 255, 255, 255, 0, 255,
      0, 0, 255, 255, 255, 0, 255, 255,
      0, 255, 255, 255, 255, 255, 255, 255,
    ]);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 2, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, idData);
    return tex;
  }

  private uploadLut3D(lut: CubeLutData) {
    const key = `${lut.title}_${lut.size}_${lut.data.length}_${lut.data[0]}_${lut.data[lut.data.length - 2]}`;
    if (key === this.lutCacheKey) return;
    this.lutCacheKey = key;

    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
    // Convert float RGBA [0,1] to RGBA16F or RGBA8 safely
    const bytes = new Uint8Array(lut.data.length);
    for (let i = 0; i < lut.data.length; i++) {
      bytes[i] = Math.max(0, Math.min(255, Math.round(lut.data[i] * 255)));
    }
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA8,
      lut.size,
      lut.size,
      lut.size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bytes
    );
  }

  private ensureFboSize(w: number, h: number) {
    if (this.fboW === w && this.fboH === h) return;
    this.fboW = w;
    this.fboH = h;
    const { gl } = this;

    const internalFmt = this.useFloatFbo ? gl.RGBA16F : gl.RGBA8;
    const texType = this.useFloatFbo ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    const setup = (fbo: WebGLFramebuffer, tex: WebGLTexture) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFmt, w, h, 0, gl.RGBA, texType, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    };

    setup(this.fboA, this.texA);
    setup(this.fboB, this.texB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public setSource(source: HTMLImageElement | HTMLVideoElement) {
    if (this.disposed) return;
    const { gl } = this;
    const w = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
    const h = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
    if (!w || !h) return;

    this.srcW = w;
    this.srcH = h;

    // Limit interactive display canvas max dimension for crisp 60fps grading (export uses full srcW/srcH)
    const maxInteractive = 1920;
    const scale = Math.min(1, maxInteractive / Math.max(w, h));
    const cw = Math.max(2, Math.round(w * scale));
    const ch = Math.max(2, Math.round(h * scale));

    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  public getSourceDimensions(): { width: number; height: number } {
    return { width: this.srcW, height: this.srcH };
  }

  private runNodePipeline(
    inputTex: WebGLTexture,
    width: number,
    height: number,
    nodes: GradeNode[],
    activeNodeId: string,
    disableSpatial: boolean,
    timeSeed: number
  ): WebGLTexture {
    const { gl } = this;
    this.ensureFboSize(width, height);

    const enabledNodes = nodes.filter((n) => n.enabled);
    if (enabledNodes.length === 0) {
      return inputTex;
    }

    gl.useProgram(this.nodeProgram);
    gl.bindVertexArray(this.quadVao);
    gl.viewport(0, 0, width, height);

    let currentInput = inputTex;
    let useA = true;

    for (const node of enabledNodes) {
      const targetFbo = useA ? this.fboA : this.fboB;
      const targetTex = useA ? this.texA : this.texB;
      useA = !useA;

      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);

      // Bind input image to unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentInput);
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uImage'), 0);

      // Upload & bind packed 16-bit curves texture to unit 1
      const curveBytes = packCurvesToTextureData(node.curves);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        256,
        10,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        curveBytes
      );
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uCurveTex'), 1);

      // Bind 3D LUT texture to unit 2
      gl.activeTexture(gl.TEXTURE2);
      if (node.lut) {
        this.uploadLut3D(node.lut);
        gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
        gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uHasLut'), 1);
        gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uLutMix'), node.finish.lutMix);
        gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uLutSize'), node.lut.size);
      } else {
        gl.bindTexture(gl.TEXTURE_3D, this.lutTex);
        gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uHasLut'), 0);
        gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uLutMix'), 0);
        gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uLutSize'), 2);
      }
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uLutTex'), 2);

      // Node uniforms
      const p = node.primaries;
      const h = node.hdr;
      const q = node.qualifier;
      const f = node.finish;
      const isNodeActive = node.id === activeNodeId;

      gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'uTexelSize'), 1 / width, 1 / height);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uOpacity'), node.opacity);
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uDisableSpatial'), disableSpatial ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uTimeSeed'), timeSeed);

      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uExposure'), p.exposure);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uContrast'), p.contrast);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uPivot'), p.pivot);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uTemp'), p.temperature);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uTint'), p.tint);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uSaturation'), p.saturation);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uVibrance'), p.vibrance);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uHighlights'), p.highlights);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uShadows'), p.shadows);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uMidtoneDetail'), p.midtoneDetail);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uHueRotate'), p.hueRotate);

      const liftRgb = wheelToRgbOffset(p.lift.x, p.lift.y);
      const gammaRgb = wheelToRgbOffset(p.gamma.x, p.gamma.y);
      const gainRgb = wheelToRgbOffset(p.gain.x, p.gain.y);
      const offsetRgb = wheelToRgbOffset(p.offset.x, p.offset.y);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uLift'), liftRgb[0], liftRgb[1], liftRgb[2], p.lift.luma);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uGamma'), gammaRgb[0], gammaRgb[1], gammaRgb[2], p.gamma.luma);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uGain'), gainRgb[0], gainRgb[1], gainRgb[2], p.gain.luma);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uOffset'), offsetRgb[0], offsetRgb[1], offsetRgb[2], p.offset.luma);

      const logSRgb = wheelToRgbOffset(p.logShadows.x, p.logShadows.y);
      const logMRgb = wheelToRgbOffset(p.logMidtones.x, p.logMidtones.y);
      const logHRgb = wheelToRgbOffset(p.logHighlights.x, p.logHighlights.y);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uLogShadows'), logSRgb[0], logSRgb[1], logSRgb[2], p.logShadows.luma);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uLogMidtones'), logMRgb[0], logMRgb[1], logMRgb[2], p.logMidtones.luma);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uLogHighlights'), logHRgb[0], logHRgb[1], logHRgb[2], p.logHighlights.luma);
      gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'uLogRanges'), p.logLowRange, p.logHighRange);

      // HDR uniforms
      gl.uniform4f(
        gl.getUniformLocation(this.nodeProgram, 'uHdrGlobal'),
        h.globalExposure,
        h.globalSaturation,
        h.globalTemp,
        h.globalTint
      );
      const previewIdx =
        !disableSpatial && isNodeActive && h.previewZone
          ? HDR_ZONE_ORDER.indexOf(h.previewZone)
          : -1;
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uHdrPreviewZone'), previewIdx);

      const wheelArr = new Float32Array(24);
      const paramArr = new Float32Array(24);
      for (let i = 0; i < 6; i++) {
        const z = h.zones[HDR_ZONE_ORDER[i]];
        const rgb = wheelToRgbOffset(z.x, z.y);
        wheelArr[i * 4] = rgb[0];
        wheelArr[i * 4 + 1] = rgb[1];
        wheelArr[i * 4 + 2] = rgb[2];
        wheelArr[i * 4 + 3] = z.exposure;
        paramArr[i * 4] = z.saturation;
        paramArr[i * 4 + 1] = z.falloffMin;
        paramArr[i * 4 + 2] = z.falloffMax;
        paramArr[i * 4 + 3] = 0;
      }
      gl.uniform4fv(gl.getUniformLocation(this.nodeProgram, 'uHdrWheel[0]'), wheelArr);
      gl.uniform4fv(gl.getUniformLocation(this.nodeProgram, 'uHdrParams[0]'), paramArr);

      // Qualifier uniforms
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uQualEnabled'), q.enabled ? 1 : 0);
      gl.uniform1i(
        gl.getUniformLocation(this.nodeProgram, 'uQualShowMatte'),
        !disableSpatial && isNodeActive && q.showMatte ? 1 : 0
      );
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uQualInvert'), q.invert ? 1 : 0);
      gl.uniform3f(
        gl.getUniformLocation(this.nodeProgram, 'uQualHue'),
        q.hueCenter / 360,
        (q.hueWidth * 0.5) / 360,
        q.hueSoftness / 360
      );
      gl.uniform3f(gl.getUniformLocation(this.nodeProgram, 'uQualSat'), q.satMin, q.satMax, q.satSoftness);
      gl.uniform3f(gl.getUniformLocation(this.nodeProgram, 'uQualLum'), q.lumMin, q.lumMax, q.lumSoftness);
      gl.uniform4f(
        gl.getUniformLocation(this.nodeProgram, 'uQualSec1'),
        q.secHueShift / 360,
        q.secSaturation,
        q.secGain,
        q.secGamma
      );
      const secTint = wheelToRgbOffset(q.secTintX, q.secTintY);
      gl.uniform3f(gl.getUniformLocation(this.nodeProgram, 'uQualSecTint'), secTint[0], secTint[1], secTint[2]);

      // Finish uniforms
      const shRgb = hueToRgbNormalized(f.splitShadowHue);
      const hiRgb = hueToRgbNormalized(f.splitHighlightHue);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uSplitShadow'), shRgb[0], shRgb[1], shRgb[2], f.splitShadowSat);
      gl.uniform4f(gl.getUniformLocation(this.nodeProgram, 'uSplitHigh'), hiRgb[0], hiRgb[1], hiRgb[2], f.splitHighlightSat);
      gl.uniform1f(gl.getUniformLocation(this.nodeProgram, 'uSplitBalance'), f.splitBalance);
      gl.uniform4f(
        gl.getUniformLocation(this.nodeProgram, 'uVignette'),
        f.vignetteAmount,
        f.vignetteMidpoint,
        f.vignetteRoundness,
        f.vignetteFeather
      );
      gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'uHalation'), f.halationAmount, f.halationThreshold);
      gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'uGrain'), f.grainAmount, f.grainSize);

      // Power Window Spatial Mask uniforms
      const m = node.mask;
      const shapeInt =
        m.shape === 'ellipse' ? 1 : m.shape === 'rectangle' ? 2 : m.shape === 'linear' ? 3 : 0;
      gl.uniform1i(gl.getUniformLocation(this.nodeProgram, 'uMaskShape'), shapeInt);
      gl.uniform2f(
        gl.getUniformLocation(this.nodeProgram, 'uMaskCenter'),
        m.centerX,
        1.0 - m.centerY
      );
      gl.uniform2f(gl.getUniformLocation(this.nodeProgram, 'uMaskSize'), m.width, m.height);
      gl.uniform4f(
        gl.getUniformLocation(this.nodeProgram, 'uMaskParams'),
        (m.rotation * Math.PI) / 180,
        m.feather,
        m.invert ? 1 : 0,
        !disableSpatial && isNodeActive && m.showMatte ? 1 : 0
      );

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      currentInput = targetTex;
    }

    return currentInput;
  }

  public render(options: RenderOptions) {
    if (this.disposed) return;
    const { gl } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    const gradedTex = options.bypass
      ? this.sourceTex
      : this.runNodePipeline(
          this.sourceTex,
          cw,
          ch,
          options.nodes,
          options.activeNodeId,
          false,
          options.timeSeed ?? 1.0
        );

    // Display pass to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(this.displayProgram);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOriginal'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gradedTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uGraded'), 1);

    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uBypass'), options.bypass ? 1 : 0);
    const cmpInt = options.compareMode === 'wipe' ? 1 : options.compareMode === 'split' ? 2 : 0;
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uCompareMode'), cmpInt);
    gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'uWipePos'), options.wipePos);
    const ovInt =
      options.overlayMode === 'falseColor' ? 1 : options.overlayMode === 'clipping' ? 2 : 0;
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOverlayMode'), ovInt);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Also blit clean graded result (without false color/wipe overlays) into downscaled scope FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scopeFbo);
    gl.viewport(0, 0, this.scopeW, this.scopeH);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uCompareMode'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOverlayMode'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Renders a pure graded frame (no wipe/split/false-color/zebra overlays) to the canvas for video recording */
  public renderCleanFrame(nodes: GradeNode[], activeNodeId: string, timeSeed = 1.0) {
    if (this.disposed) return;
    const { gl } = this;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    const gradedTex = this.runNodePipeline(
      this.sourceTex,
      cw,
      ch,
      nodes,
      activeNodeId,
      false,
      timeSeed
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.useProgram(this.displayProgram);
    gl.bindVertexArray(this.quadVao);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOriginal'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gradedTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uGraded'), 1);

    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uBypass'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uCompareMode'), 0);
    gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'uWipePos'), 0.5);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOverlayMode'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /** Fast pixel readback (240x135 RGBA8) for live Parade, Waveform, Vectorscope & Histogram */
  public readScopePixels(): { data: Uint8Array; width: number; height: number } {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scopeFbo);
    gl.readPixels(0, 0, this.scopeW, this.scopeH, gl.RGBA, gl.UNSIGNED_BYTE, this.scopeBuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { data: this.scopeBuffer, width: this.scopeW, height: this.scopeH };
  }

  /** Sample single pixel RGB [0..255] at normalized viewport coordinate (nx: 0..1 left-right, ny: 0..1 top-bottom) */
  public samplePixel(nx: number, ny: number): [number, number, number] {
    const { gl } = this;
    const px = Math.max(0, Math.min(this.canvas.width - 1, Math.floor(nx * this.canvas.width)));
    const py = Math.max(
      0,
      Math.min(this.canvas.height - 1, Math.floor((1 - ny) * this.canvas.height))
    );
    const buf = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return [buf[0], buf[1], buf[2]];
  }

  /** Capture a compact JPEG thumbnail data URL for the Snapshots gallery */
  public captureThumbnail(maxW = 320): string {
    const scale = Math.min(1, maxW / this.canvas.width);
    const tw = Math.max(2, Math.round(this.canvas.width * scale));
    const th = Math.max(2, Math.round(this.canvas.height * scale));
    const tmp = document.createElement('canvas');
    tmp.width = tw;
    tmp.height = th;
    const ctx = tmp.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.canvas, 0, 0, tw, th);
    }
    return tmp.toDataURL('image/jpeg', 0.82);
  }

  /** Full-resolution image export matching the original source dimensions */
  public exportFullResolution(
    nodes: GradeNode[],
    activeNodeId: string,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
    quality = 0.94
  ): string {
    const { gl } = this;
    const prevW = this.canvas.width;
    const prevH = this.canvas.height;
    const targetW = Math.min(4096, Math.max(2, this.srcW));
    const targetH = Math.min(4096, Math.max(2, this.srcH));

    this.canvas.width = targetW;
    this.canvas.height = targetH;

    const gradedTex = this.runNodePipeline(
      this.sourceTex,
      targetW,
      targetH,
      nodes,
      activeNodeId,
      false,
      1.0
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, targetW, targetH);
    gl.useProgram(this.displayProgram);
    gl.bindVertexArray(this.quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOriginal'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gradedTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uGraded'), 1);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uBypass'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uCompareMode'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOverlayMode'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const dataUrl = this.canvas.toDataURL(mimeType, quality);

    // Restore interactive viewport dimensions
    this.canvas.width = prevW;
    this.canvas.height = prevH;
    return dataUrl;
  }

  /**
   * Evaluates the entire active node stack across a genuine N×N×N RGB identity lattice on the GPU
   * (with spatial filters disabled) to bake an exact .cube 3D LUT.
   */
  public bake3DLut(nodes: GradeNode[], size = 33): Float32Array {
    const { gl } = this;
    const width = size * size; // x = r + g * size
    const height = size;       // y = b

    const lattice = new Uint8Array(width * height * 4);
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const x = r + g * size;
          const y = b;
          const idx = (y * width + x) * 4;
          lattice[idx] = Math.round((r / (size - 1)) * 255);
          lattice[idx + 1] = Math.round((g / (size - 1)) * 255);
          lattice[idx + 2] = Math.round((b / (size - 1)) * 255);
          lattice[idx + 3] = 255;
        }
      }
    }

    const lutInputTex = this.createTex2D(gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, lutInputTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, lattice);

    const outTex = this.runNodePipeline(lutInputTex, width, height, nodes, '__bake__', true, 0);

    // Readback via temporary RGBA8 FBO
    const readTex = this.createTex2D(gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, readTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const readFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, readTex, 0);

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.displayProgram);
    gl.bindVertexArray(this.quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lutInputTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOriginal'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, outTex);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uGraded'), 1);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uBypass'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uCompareMode'), 0);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'uOverlayMode'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const outBytes = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outBytes);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(readFbo);
    gl.deleteTexture(readTex);
    gl.deleteTexture(lutInputTex);

    // Unpack to R-fastest, G-middle, B-slowest Float32Array
    const rgbOut = new Float32Array(size * size * size * 3);
    let ptr = 0;
    for (let b = 0; b < size; b++) {
      for (let g = 0; g < size; g++) {
        for (let r = 0; r < size; r++) {
          const x = r + g * size;
          const y = b;
          const idx = (y * width + x) * 4;
          rgbOut[ptr++] = outBytes[idx] / 255;
          rgbOut[ptr++] = outBytes[idx + 1] / 255;
          rgbOut[ptr++] = outBytes[idx + 2] / 255;
        }
      }
    }
    return rgbOut;
  }

  public dispose() {
    this.disposed = true;
    const { gl } = this;
    gl.deleteProgram(this.nodeProgram);
    gl.deleteProgram(this.displayProgram);
    gl.deleteTexture(this.sourceTex);
    gl.deleteTexture(this.curveTex);
    gl.deleteTexture(this.lutTex);
    gl.deleteTexture(this.texA);
    gl.deleteTexture(this.texB);
    gl.deleteTexture(this.scopeTex);
    gl.deleteFramebuffer(this.fboA);
    gl.deleteFramebuffer(this.fboB);
    gl.deleteFramebuffer(this.scopeFbo);
  }
}
