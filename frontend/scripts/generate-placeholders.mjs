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

/**
 * Mirrors the palette in `src/styles/tokens.css`. Keep the two in step — this
 * script bakes colour into files, so it cannot read the stylesheet at runtime.
 */
const BRAND = {
  ink: '#241d18',
  inkSoft: '#453a31',
  espresso: '#2f251f',
  sand: '#efe7da',
  sandDeep: '#e2d6c5',
  cream: '#f7f3ec',
  taupe: '#b5a392',
  taupeDeep: '#7e6b5c',
  champagne: '#c9a86c',
  champagneDeep: '#9f7a38',
  champagneSoft: '#e9dabc',
  blush: '#e4cac1',
  blushDeep: '#c2998c',
  wine: '#7c3a44',
};

/** Brand-derived palettes, one per subject: [dark, mid, accent]. */
const PALETTES = {
  lounge: [BRAND.espresso, BRAND.taupeDeep, BRAND.champagne],
  facial: [BRAND.blush, BRAND.blushDeep, '#8a6a5e'],
  skin: [BRAND.sand, BRAND.sandDeep, BRAND.champagneDeep],
  laser: [BRAND.ink, '#4d3038', BRAND.champagne],
  nails: [BRAND.sandDeep, BRAND.blushDeep, BRAND.taupeDeep],
  room: [BRAND.inkSoft, BRAND.taupe, BRAND.champagneSoft],
  hero: ['#1e1814', BRAND.inkSoft, BRAND.champagneDeep],
  philosophy: [BRAND.ink, '#5b4738', BRAND.champagne],
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
      <stop offset="0%" stop-color="${BRAND.cream}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${BRAND.cream}" stop-opacity="0"/>
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
  <ellipse cx="${width * 0.24}" cy="${height * 0.78}" rx="${width * 0.34}" ry="${height * 0.24}" fill="${BRAND.cream}" opacity="0.06"/>
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

/**
 * Card artwork for every service category, keyed by the slug the API returns.
 * Wide banners (4:1) because service cards crop them into a short strip.
 * Keep this list in step with `CATEGORY_IMAGES` in `src/content/brand.ts`.
 */
const CATEGORY_ART = {
  laser: PALETTES.laser,
  'skin-care': PALETTES.skin,
  'permanent-makeup': [BRAND.espresso, BRAND.wine, BRAND.blush],
  nails: PALETTES.nails,
  'facial-aesthetics': PALETTES.facial,
  'collagen-biostimulation': [BRAND.inkSoft, BRAND.taupeDeep, BRAND.champagneSoft],
  'skin-boosters-rejuvenation': [BRAND.taupe, BRAND.sandDeep, BRAND.champagne],
  'advanced-skin-treatments': [BRAND.taupeDeep, BRAND.sand, BRAND.champagneDeep],
  'lifting-contouring': [BRAND.espresso, BRAND.taupe, BRAND.champagne],
  'beauty-nails': [BRAND.blushDeep, BRAND.sandDeep, BRAND.champagneSoft],
  /* Used for any category the API adds before artwork is commissioned. */
  default: [BRAND.ink, BRAND.taupeDeep, BRAND.champagne],
};

Object.entries(CATEGORY_ART).forEach(([slug, palette], index) => {
  FILES.push([`images/categories/${slug}.svg`, 960, 240, palette, 11 + index]);
});

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
  <rect width="64" height="64" rx="14" fill="${BRAND.ink}"/>
  <path d="M20 46V18h5.5l13 19.5V18H44v28h-5.5L25.5 26.5V46H20Z" fill="${BRAND.champagne}"/>
</svg>
`,
);
console.log('wrote favicon.svg');
