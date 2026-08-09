/**
 * Synthetic media for the development seed.
 *
 * Before/after treatment photographs are the most sensitive thing this system
 * holds, so the fixtures are deliberately **not** photographic. Each one is a
 * flat gradient test card with its phase and the word DEMO drawn into the
 * pixels, meaning a seeded image is recognisable as a fixture even if it is
 * downloaded and viewed with no surrounding context.
 *
 * PNG is written by hand rather than pulling in `sharp` or `canvas`: those are
 * heavyweight native dependencies to add to the production image for the sake
 * of a dev-only fixture. The encoder below is the minimal truecolour subset —
 * one IHDR, one IDAT, one IEND.
 */
import { deflateSync } from 'node:zlib';

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

type Rgb = [number, number, number];

function encodePng(width: number, height: number, pixel: (x: number, y: number) => Rgb): Buffer {
  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- A 5x7 bitmap font, only the glyphs these captions need -----------------

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Renders `text` into a lookup of lit pixels, scaled by `scale`. */
function textMask(text: string, scale: number): { lit: Set<string>; width: number; height: number } {
  const lit = new Set<string>();
  const letters = [...text.toUpperCase()];
  let cursor = 0;

  for (const letter of letters) {
    const glyph = GLYPHS[letter] ?? GLYPHS[' ']!;
    glyph.forEach((row, gy) => {
      [...row].forEach((bit, gx) => {
        if (bit !== '1') return;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            lit.add(`${cursor + gx * scale + dx},${gy * scale + dy}`);
          }
        }
      });
    });
    cursor += 6 * scale; // 5px glyph + 1px spacing
  }

  return { lit, width: cursor, height: 7 * scale };
}

// --- Placeholder builders ---------------------------------------------------

const PALETTES: Record<'before' | 'after', { from: Rgb; to: Rgb }> = {
  // Muted and cooler for "before", warmer and lighter for "after", so the pair
  // reads as a progression at a glance in the admin grid.
  before: { from: [186, 166, 156], to: [126, 112, 122] },
  after: { from: [238, 222, 205], to: [206, 178, 166] },
};

/**
 * A labelled gradient test card. `phase` drives the palette and the caption, so
 * a before and its after are visually distinguishable in the UI.
 */
export function placeholderPhoto(phase: 'before' | 'after', width = 480, height = 640): Buffer {
  const palette = PALETTES[phase];
  const caption = textMask(phase, 6);
  const badge = textMask('DEMO', 4);

  const captionX = Math.round((width - caption.width) / 2);
  const captionY = Math.round(height * 0.44);
  const badgeX = Math.round((width - badge.width) / 2);
  const badgeY = Math.round(height * 0.56);

  return encodePng(width, height, (x, y) => {
    const t = y / height;
    const base: Rgb = [
      Math.round(palette.from[0] + (palette.to[0] - palette.from[0]) * t),
      Math.round(palette.from[1] + (palette.to[1] - palette.from[1]) * t),
      Math.round(palette.from[2] + (palette.to[2] - palette.from[2]) * t),
    ];

    // Diagonal hatching — the visual language of "this is a placeholder".
    const hatched = (x + y) % 26 < 2;
    const shade: Rgb = hatched
      ? [Math.round(base[0] * 0.92), Math.round(base[1] * 0.92), Math.round(base[2] * 0.92)]
      : base;

    if (caption.lit.has(`${x - captionX},${y - captionY}`)) return [255, 252, 248];
    if (badge.lit.has(`${x - badgeX},${y - badgeY}`)) return [92, 74, 64];

    return shade;
  });
}

/**
 * A minimal but structurally valid PDF, so the seeded consent form opens in a
 * viewer rather than looking like a corrupt download.
 */
export function placeholderPdf(title: string): Buffer {
  const text = `${title} — DEMO DATA, not a real consent form.`;
  const body = `BT /F1 14 Tf 60 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
