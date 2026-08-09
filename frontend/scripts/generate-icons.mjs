/**
 * Generates the PWA icon set as real PNG files.
 *
 * A PWA cannot be installed without raster icons, and the project ships with
 * no binary assets, so they are produced here from the Nurella monogram: an
 * "N" drawn as three quads, rasterised at 4x and box-filtered down for clean
 * antialiasing, then encoded to PNG with zlib.
 *
 * Replace these with the real Nurella logo when it is available.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const INK = [0x1c, 0x17, 0x14];
const GOLD = [0xc9, 0xa6, 0x6b];
const SS = 4; // supersampling factor

/** Monogram geometry in a 0..1 unit square: left stem, diagonal, right stem. */
const GLYPH = [
  [
    [0.3, 0.28],
    [0.385, 0.28],
    [0.385, 0.72],
    [0.3, 0.72],
  ],
  [
    [0.3, 0.28],
    [0.385, 0.28],
    [0.7, 0.72],
    [0.615, 0.72],
  ],
  [
    [0.615, 0.28],
    [0.7, 0.28],
    [0.7, 0.72],
    [0.615, 0.72],
  ],
];

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * @param {number} size    output edge length in pixels
 * @param {boolean} maskable  full-bleed square (Android masks it itself) vs.
 *                            rounded square with transparent corners
 */
function renderIcon(size, maskable) {
  const big = size * SS;
  // Maskable icons must keep their content inside the safe zone (80% circle),
  // so the monogram is scaled down rather than cropped by the launcher mask.
  const glyphScale = maskable ? 0.78 : 1;
  const radius = maskable ? 0 : big * 0.22;

  const accum = new Float32Array(size * size * 4);

  for (let by = 0; by < big; by += 1) {
    for (let bx = 0; bx < big; bx += 1) {
      const u = (bx + 0.5) / big;
      const v = (by + 0.5) / big;

      // Rounded-corner mask.
      let alpha = 1;
      if (radius > 0) {
        const cx = Math.min(bx, big - 1 - bx);
        const cy = Math.min(by, big - 1 - by);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          if (dx * dx + dy * dy > radius * radius) alpha = 0;
        }
      }

      let colour = INK;
      const gu = (u - 0.5) / glyphScale + 0.5;
      const gv = (v - 0.5) / glyphScale + 0.5;
      if (GLYPH.some((polygon) => insidePolygon(gu, gv, polygon))) colour = GOLD;

      const px = Math.floor(bx / SS);
      const py = Math.floor(by / SS);
      const index = (py * size + px) * 4;
      accum[index] += colour[0] * alpha;
      accum[index + 1] += colour[1] * alpha;
      accum[index + 2] += colour[2] * alpha;
      accum[index + 3] += 255 * alpha;
    }
  }

  const samples = SS * SS;
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 1) {
    pixels[i] = Math.round(accum[i] / samples);
  }
  return pixels;
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12: compression, filter, interlace — all zero (default).

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TARGETS = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];

for (const [name, size, maskable] of TARGETS) {
  writeFileSync(resolve(outDir, name), encodePng(size, renderIcon(size, maskable)));
  console.log(`wrote icons/${name} (${size}x${size}${maskable ? ', maskable' : ''})`);
}
