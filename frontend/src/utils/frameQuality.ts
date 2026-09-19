/*
 * Lightweight client-side frame analysis for the live scanner (web).
 * Runs on small downscaled canvases so it can keep up with a ~700ms sampling loop.
 *
 * - Sharpness: Laplacian variance on a grayscale downscale (mirrors the backend's
 *   compute_sharpness idea; thresholds are lower because preview frames are 720p).
 * - Brightness: mean luma, to reject too-dark / blown-out frames.
 * - Duplicate detection: 64-bit dHash + Hamming distance between frames.
 */

export interface FrameQuality {
  sharpness: number;
  brightness: number; // 0..255 mean luma
  hash: string; // 64-char '0'/'1' dHash
}

export const SHARPNESS_THRESHOLD = 25;
export const BRIGHTNESS_MIN = 40;
export const BRIGHTNESS_MAX = 235;
export const DUPLICATE_HAMMING = 10;

function toGrayMatrix(source: CanvasImageSource, w: number, h: number): Uint8ClampedArray | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  }
  return gray;
}

/** Analyze a video element (or canvas) for sharpness / brightness / duplicate hash. */
export function analyzeFrame(source: CanvasImageSource): FrameQuality | null {
  try {
    const W = 96;
    const H = 72;
    const gray = toGrayMatrix(source, W, H);
    if (!gray) return null;

    // Mean brightness
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    const brightness = sum / gray.length;

    // Laplacian variance (4-neighbour kernel) over the interior
    let lapSum = 0;
    let lapSqSum = 0;
    let n = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - W] - gray[i + W];
        lapSum += lap;
        lapSqSum += lap * lap;
        n++;
      }
    }
    const mean = lapSum / n;
    const sharpness = lapSqSum / n - mean * mean;

    return { sharpness, brightness, hash: dHash(source) };
  } catch {
    return null;
  }
}

/** 64-bit dHash: 9x8 grayscale downscale, horizontal gradient bits. */
export function dHash(source: CanvasImageSource): string {
  const W = 9;
  const H = 8;
  const gray = toGrayMatrix(source, W, H);
  if (!gray) return '';
  let bits = '';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      bits += gray[y * W + x] < gray[y * W + x + 1] ? '1' : '0';
    }
  }
  return bits;
}

export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export function isFrameAcceptable(q: FrameQuality): boolean {
  return (
    q.sharpness >= SHARPNESS_THRESHOLD &&
    q.brightness >= BRIGHTNESS_MIN &&
    q.brightness <= BRIGHTNESS_MAX
  );
}

/** Human-readable quality flag for the review layer. */
export function qualityFlag(q: FrameQuality, existingHashes: string[]): string | null {
  if (!isFrameAcceptable(q)) {
    if (q.brightness < BRIGHTNESS_MIN) return 'Too Dark';
    if (q.brightness > BRIGHTNESS_MAX) return 'Glare';
    return 'Blurry';
  }
  for (const h of existingHashes) {
    if (hammingDistance(q.hash, h) <= DUPLICATE_HAMMING) return 'Duplicate';
  }
  return null;
}
