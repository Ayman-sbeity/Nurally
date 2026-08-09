/**
 * Generates the placeholder artwork shipped with the project.
 *
 * These are deliberately abstract, brand-coloured gradients — NOT stock
 * photography of unrelated people or clinics. Replace the generated files in
 * `public/images/` with real Nurella photography (or upload through
 * Admin → Gallery) when it is available.
 *
 *   node scripts/generate-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Brand-derived palettes, one per subject. */
const PALETTES = {
  lounge: ['#2b211c', '#6b5346', '#c9a66b'],
  facial: ['#e7d3cb', '#cdb0a5', '#8a6a5e'],
  skin: ['#f2ece3', '#dcc7ab', '#a8813f'],
  laser: ['#1c1714', '#4a3b52', '#c9a66b'],
  nails: ['#e6dccf', '#cdb0a5', '#7a5c50'],
  room: ['#3a322c', '#7d6b5c', '#e8d9bd'],
  hero: ['#171310', '#3f3229', '#8d6f4a'],
  philosophy: ['#241d18', '#5b4738', '#c9a66b'],
}

const svg = (width, height, [dark, mid, accent], seed) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="g${seed}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="55%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="r${seed}" cx="${28 + (seed % 5) * 9}%" cy="${22 + (seed % 4) * 12}%" r="62%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="r2${seed}" cx="${70 - (seed % 3) * 11}%" cy="${74 - (seed % 5) * 7}%" r="55%">
      <stop offset="0%" stop-color="#faf7f2" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#faf7f2" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain${seed}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${seed}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g${seed})"/>
  <rect width="${width}" height="${height}" fill="url(#r${seed})"/>
  <rect width="${width}" height="${height}" fill="url(#r2${seed})"/>
  <ellipse cx="${width * 0.72}" cy="${height * 0.3}" rx="${width * 0.3}" ry="${height * 0.28}" fill="${accent}" opacity="0.08"/>
  <ellipse cx="${width * 0.24}" cy="${height * 0.78}" rx="${width * 0.34}" ry="${height * 0.24}" fill="#faf7f2" opacity="0.06"/>
  <rect width="${width}" height="${height}" filter="url(#grain${seed})" opacity="0.6"/>
</svg>
`;

const FILES = [
  ['images/hero.svg', 1920, 1280, PALETTES.hero, 1],
  ['images/about.svg', 1200, 1500, PALETTES.facial, 2],
  ['images/philosophy.svg', 1920, 1080, PALETTES.philosophy, 3],
  ['images/og-cover.svg', 1200, 630, PALETTES.hero, 4],
  ['images/gallery/lounge.svg', 900, 1200, PALETTES.lounge, 5],
  ['images/gallery/facial-aesthetics.svg', 900, 1200, PALETTES.facial, 6],
  ['images/gallery/skin-treatments.svg', 900, 1200, PALETTES.skin, 7],
  ['images/gallery/laser.svg', 900, 1200, PALETTES.laser, 8],
  ['images/gallery/nails.svg', 900, 1200, PALETTES.nails, 9],
  ['images/gallery/treatment-room.svg', 900, 1200, PALETTES.room, 10],
];

for (const [file, width, height, palette, seed] of FILES) {
  const target = resolve(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, svg(width, height, palette, seed));
  console.log(`wrote ${file}`);
}

/** The favicon carries the Nurella monogram rather than an abstract wash. */
writeFileSync(
  resolve(root, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#1c1714"/>
  <path d="M20 46V18h5.5l13 19.5V18H44v28h-5.5L25.5 26.5V46H20Z" fill="#c9a66b"/>
</svg>
`,
);
console.log('wrote favicon.svg');
