import { ServiceCategorySlug } from '../types/domain';

/**
 * NURELLA SERVICE CATALOGUE — SOURCE OF TRUTH
 * -------------------------------------------
 * Names and descriptions are reproduced exactly as supplied by the lounge.
 * Do not rename, merge, remove or reword entries here.
 *
 * Some treatments legitimately appear under more than one category (e.g.
 * "Hifu" under Laser and "HIFU" under Advanced Skin Treatments). That mirrors
 * the brief and is preserved rather than de-duplicated.
 *
 * PRICES: none are recorded. Nurella has not published pricing, so no price is
 * invented — the UI simply omits it until an admin sets one.
 *
 * DURATIONS: `DEFAULT_DURATION_MINUTES` is a **placeholder** required by the
 * booking engine, not real business data. Adjust per service in
 * Admin → Services before taking bookings.
 */
export const DEFAULT_DURATION_MINUTES = 60;

export interface SeedService {
  name: string;
  category: ServiceCategorySlug;
  description?: string;
  durationMinutes?: number;
}

export const SEED_SERVICES: SeedService[] = [
  // --- LASER ---------------------------------------------------------------
  { name: 'Laser hair removal', category: ServiceCategorySlug.LASER },
  { name: 'Co2 laser', category: ServiceCategorySlug.LASER },
  { name: 'Hifu', category: ServiceCategorySlug.LASER },
  { name: 'Rf microneedling laser', category: ServiceCategorySlug.LASER },

  // --- SKIN CARE -----------------------------------------------------------
  { name: 'Deep cleaning', category: ServiceCategorySlug.SKIN_CARE },
  { name: 'Hydra facial', category: ServiceCategorySlug.SKIN_CARE },
  { name: 'diamond technique', category: ServiceCategorySlug.SKIN_CARE },
  { name: 'messo lifting', category: ServiceCategorySlug.SKIN_CARE },
  { name: 'micro needling', category: ServiceCategorySlug.SKIN_CARE },

  // --- PERMANENT MAKEUP ----------------------------------------------------
  { name: 'Lip blush', category: ServiceCategorySlug.PERMANENT_MAKEUP },
  { name: 'Microbalding', category: ServiceCategorySlug.PERMANENT_MAKEUP },
  { name: 'nano balading', category: ServiceCategorySlug.PERMANENT_MAKEUP },
  { name: 'eye liner', category: ServiceCategorySlug.PERMANENT_MAKEUP },

  // --- NAILS ---------------------------------------------------------------
  { name: 'manicure', category: ServiceCategorySlug.NAILS },
  { name: 'Pedicure', category: ServiceCategorySlug.NAILS },
  { name: 'gel pose', category: ServiceCategorySlug.NAILS },
  { name: 'gel extensions', category: ServiceCategorySlug.NAILS },

  // --- FACIAL AESTHETICS ---------------------------------------------------
  { name: 'Facial Contouring', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Lip Enhancement', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Cheek Enhancement', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Chin & Jawline Contouring', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Non-Surgical Face Sculpting', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  // Renamed from 'Anti-Wrinkle Treatments' at the lounge's request. A rename
  // here does NOT rename an existing record: seedServices() matches on name,
  // so a fresh install gets 'Botox' while an existing database keeps the old
  // row and gains a duplicate. Live databases are migrated separately.
  { name: 'Botox', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Face Slimming Treatments', category: ServiceCategorySlug.FACIAL_AESTHETICS },
  { name: 'Under-Eye Rejuvenation', category: ServiceCategorySlug.FACIAL_AESTHETICS },

  // --- COLLAGEN & BIOSTIMULATION -------------------------------------------
  {
    name: 'PLLA Collagen Stimulation',
    category: ServiceCategorySlug.COLLAGEN_BIOSTIMULATION,
    description:
      'A progressive collagen-stimulating treatment designed to restore firmness and improve facial structure over time.',
  },
  {
    name: 'CaHA Biostimulation',
    category: ServiceCategorySlug.COLLAGEN_BIOSTIMULATION,
    description:
      'An advanced treatment focused on skin firmness, contouring, and collagen stimulation.',
  },
  {
    name: 'Collagen Stimulators',
    category: ServiceCategorySlug.COLLAGEN_BIOSTIMULATION,
    description:
      'Personalized biostimulation protocols selected according to your skin condition, age, and aesthetic goals.',
  },

  // --- SKIN BOOSTERS & REJUVENATION ----------------------------------------
  {
    name: 'Skin Boosters',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Deep hydration and skin-quality treatments designed to improve radiance, elasticity, and texture.',
  },
  {
    name: 'Polynucleotide Treatments',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Advanced regenerative treatments focused on improving skin quality, hydration, and overall rejuvenation.',
  },
  {
    name: 'Mesotherapy',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Customized skin cocktails selected according to individual concerns and treatment goals.',
  },
  {
    name: 'Exosome Therapy',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Advanced skin rejuvenation protocols designed to support healthier-looking, refreshed skin.',
  },
  {
    name: 'Glow & Brightening Treatments',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Personalized treatments targeting dullness, uneven appearance, and loss of radiance.',
  },
  {
    name: 'Anti-Aging Protocols',
    category: ServiceCategorySlug.SKIN_BOOSTERS_REJUVENATION,
    description:
      'Combination treatments designed according to your skin needs to maintain a fresh, refined, and rejuvenated appearance.',
  },

  // --- ADVANCED SKIN TREATMENTS --------------------------------------------
  {
    name: 'Microneedling',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description:
      'A skin-renewal treatment designed to improve texture and the appearance of pores and superficial imperfections.',
  },
  {
    name: 'CO₂ Skin Resurfacing',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description:
      'Advanced resurfacing designed to improve skin texture and the appearance of selected skin concerns.',
  },
  {
    name: 'HIFU',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description: 'Non-surgical technology designed to support facial tightening and contouring.',
  },
  {
    name: 'Radiofrequency',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description:
      'Energy-based skin treatments designed to improve the appearance of firmness and skin quality.',
  },
  {
    name: 'Acne Scar Treatments',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description:
      'Personalized protocols selected according to scar type, skin condition, and individual needs.',
  },
  {
    name: 'Pigmentation Treatments',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    description:
      'Customized skin treatments targeting the appearance of uneven tone and pigmentation.',
  },

  // --- LIFTING & CONTOURING ------------------------------------------------
  {
    name: 'Non-Surgical Thread Lift',
    category: ServiceCategorySlug.LIFTING_CONTOURING,
    description:
      'Customized thread treatments designed to support facial contouring and create a refreshed appearance.',
  },
  {
    name: 'V-Shape Facial Contouring',
    category: ServiceCategorySlug.LIFTING_CONTOURING,
    description:
      'A personalized combination approach focused on enhancing facial definition and balance.',
  },

  // --- BEAUTY & NAILS ------------------------------------------------------
  {
    name: 'Manicure',
    category: ServiceCategorySlug.BEAUTY_NAILS,
    description: 'Professional nail care with an elegant, refined finish.',
  },
  {
    name: 'Pedicure',
    category: ServiceCategorySlug.BEAUTY_NAILS,
    description: 'Complete foot and nail care for beautifully maintained results.',
  },
  {
    name: 'Nail Beauty',
    category: ServiceCategorySlug.BEAUTY_NAILS,
    description: 'Customized nail services designed around your preferred style and look.',
  },
  {
    name: 'Professional Facials',
    category: ServiceCategorySlug.BEAUTY_NAILS,
    description:
      'Personalized facial treatments selected according to your skin type and concerns.',
  },
];

/**
 * EXAMPLE working schedule, seeded so the booking engine has something to work
 * with on a fresh database. These are **not** Nurella's real opening hours —
 * configure them in Admin → Availability.
 */
export const EXAMPLE_WORKING_HOURS = [
  { weekday: 0, isOpen: false, openMinute: 540, closeMinute: 1020, breaks: [] },
  { weekday: 1, isOpen: true, openMinute: 540, closeMinute: 1020, breaks: [{ startMinute: 780, endMinute: 840 }] },
  { weekday: 2, isOpen: true, openMinute: 540, closeMinute: 1020, breaks: [{ startMinute: 780, endMinute: 840 }] },
  { weekday: 3, isOpen: true, openMinute: 540, closeMinute: 1020, breaks: [{ startMinute: 780, endMinute: 840 }] },
  { weekday: 4, isOpen: true, openMinute: 540, closeMinute: 1020, breaks: [{ startMinute: 780, endMinute: 840 }] },
  { weekday: 5, isOpen: true, openMinute: 540, closeMinute: 1020, breaks: [{ startMinute: 780, endMinute: 840 }] },
  { weekday: 6, isOpen: true, openMinute: 600, closeMinute: 960, breaks: [] },
];

/**
 * Placeholder gallery entries pointing at locally generated SVG artwork.
 * Replace the files in `frontend/public/images/` — or upload real photography
 * through Admin → Gallery — when Nurella's own images are available.
 */
export const PLACEHOLDER_GALLERY = [
  {
    title: 'The Lounge',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/lounge.svg',
    altText: 'Placeholder image representing the Nurella Beauty Lounge interior',
    displayOrder: 1,
  },
  {
    title: 'Facial Aesthetics',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/facial-aesthetics.svg',
    category: ServiceCategorySlug.FACIAL_AESTHETICS,
    altText: 'Placeholder image representing facial aesthetics treatments',
    displayOrder: 2,
  },
  {
    title: 'Skin Treatments',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/skin-treatments.svg',
    category: ServiceCategorySlug.ADVANCED_SKIN_TREATMENTS,
    altText: 'Placeholder image representing advanced skin treatments',
    displayOrder: 3,
  },
  {
    title: 'Laser Treatments',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/laser.svg',
    category: ServiceCategorySlug.LASER,
    altText: 'Placeholder image representing laser treatments',
    displayOrder: 4,
  },
  {
    title: 'Nails',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/nails.svg',
    category: ServiceCategorySlug.NAILS,
    altText: 'Placeholder image representing nail services',
    displayOrder: 5,
  },
  {
    title: 'Treatment Room',
    caption: 'Placeholder image — replace with Nurella photography.',
    imageUrl: '/images/gallery/treatment-room.svg',
    altText: 'Placeholder image representing a professional treatment environment',
    displayOrder: 6,
  },
];
