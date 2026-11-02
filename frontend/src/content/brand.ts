/**
 * NURELLA BRAND CONTENT — SOURCE OF TRUTH
 *
 * Every headline, paragraph and label below is reproduced exactly as supplied
 * by the lounge. Do not reword, shorten or embellish. Anything Nurella has not
 * provided (address, phone number, prices, staff, reviews, statistics) is
 * deliberately absent rather than invented — see `MISSING_INFORMATION`.
 */
import type { IconName } from '@/components/ui/Icon';

export const BRAND = {
  name: 'NURELLA BEAUTY LOUNGE',
  tagline: 'Advanced Aesthetics • Skin • Beauty',
  instagramHandle: import.meta.env.VITE_INSTAGRAM_HANDLE ?? 'nurella_beauty_lounge',
} as const;

export const instagramUrl = `https://instagram.com/${BRAND.instagramHandle}`;

/** The three promises shown under the hero headline and again in About. */
export const PILLARS = [
  { icon: 'diamond', label: 'Advanced Technology' },
  { icon: 'lotus', label: 'Personalized Care' },
  { icon: 'shield', label: 'Safe & Effective' },
] as const;

export const HERO = {
  eyebrow: BRAND.name,
  /** "Beauty, Refined." — split so the second word can carry the gold italic. */
  title: { lead: 'Beauty,', accent: 'Refined.' },
  subtitle:
    'Where advanced aesthetics meet elegance, precision, and personalized care.',
  pillars: PILLARS,
  primaryCta: 'BOOK YOUR APPOINTMENT',
  secondaryCta: 'Explore treatments',
  /**
   * Background artwork. Swap for real Nurella photography (≥2400px wide, the
   * subject on the right third) and set `position` so the subject stays in
   * frame as the viewport narrows — no other change needed.
   */
  image: { src: '/images/hero.svg', width: 1920, height: 1280, position: '70% center' },
  /**
   * The card lists the first few treatments of one category, in the order set
   * in Admin → Services. A price appears only once the lounge has set one.
   */
  featured: { title: 'Featured Treatments', category: 'laser', limit: 4 },
  hoursTitle: 'Opening Hours',
  /** Shortcut tiles under the CTAs. Labels mirror the API's category labels. */
  categories: [
    { slug: 'laser', label: 'Laser' },
    { slug: 'skin-care', label: 'Skin Care' },
    { slug: 'facial-aesthetics', label: 'Facial Aesthetics' },
    { slug: 'skin-boosters-rejuvenation', label: 'Skin Boosters & Rejuvenation' },
  ],
} as const;

export const ABOUT = {
  eyebrow: 'ABOUT NURELLA',
  /** "The Art of Natural Enhancement" — split so the last word can carry the gold italic. */
  title: { lead: 'The Art of Natural', accent: 'Enhancement' },
  intro:
    'Welcome to Nurella Beauty Lounge, a destination dedicated to advanced aesthetics, skin rejuvenation, and beauty.',
  philosophyLead: 'Our philosophy is simple:',
  pullQuote: 'Enhance, never change.',
  paragraphsAfter: [
    'Every face is unique. That is why each treatment begins with a personalized consultation and a carefully designed plan based on your features, skin needs, and desired results.',
    'From facial rejuvenation and contouring to advanced skin and collagen treatments, our approach combines experience, precision, and attention to detail to create elegant, natural-looking results.',
  ],
  /**
   * Placeholder artwork until real photography arrives (4:5 portrait, ≥1200px
   * wide). The alt is empty while the image is decorative; describe what the
   * photograph shows once it is a real one.
   */
  image: { src: '/images/about.svg', alt: '', width: 1200, height: 1500 },
} as const;

export const PHILOSOPHY = {
  eyebrow: 'OUR PHILOSOPHY',
  title: 'You, Only Enhanced.',
  paragraphs: [
    'Beauty should never look artificial.',
    'At Nurella, our goal is to enhance what is already beautiful — respecting your facial proportions, individuality, and personal style.',
  ],
  closing: 'Subtle. Elegant. Timeless.',
} as const;

export const BOOKING_CTA = {
  eyebrow: 'BOOK YOUR APPOINTMENT',
  title: 'Your Beauty Journey Starts Here.',
  body: 'Book your personalized consultation at Nurella Beauty Lounge and discover a treatment plan created specifically for you.',
  cta: 'BOOK NOW',
} as const;

/** Section intro for the Collagen & Biostimulation category. */
export const COLLAGEN_INTRO = {
  /** "Restore. Regenerate. Rejuvenate." — split so the last word can carry the gold italic. */
  title: { lead: 'Restore. Regenerate.', accent: 'Rejuvenate.' },
  body: 'Advanced treatments designed to support collagen production and gradually improve skin firmness, texture, and overall quality.',
} as const;

/** The banner that opens the Treatments page. */
export const SERVICES_HERO = {
  eyebrow: 'Our Treatments & Services',
  title: COLLAGEN_INTRO.title,
  body: COLLAGEN_INTRO.body,
  /**
   * Background artwork. Swap for real Nurella photography (≥2400px wide, the
   * subject on the right third) — no other change needed.
   */
  image: { src: '/images/hero.svg', width: 1920, height: 1280, position: '70% center' },
} as const;

export const CONCERNS = {
  title: 'Not sure which treatment is right for you?',
  intro: 'Explore our treatments according to your concern:',
  outcome:
    'A personalized consultation will help determine the most appropriate treatment plan for you.',
  items: [
    'Fine Lines & Wrinkles',
    'Facial Volume & Definition',
    'Sagging & Loss of Firmness',
    'Dark Circles & Tired Eyes',
    'Dull & Dehydrated Skin',
    'Acne & Acne Scars',
    'Pigmentation & Uneven Tone',
    'Large Pores & Skin Texture',
    'Facial Contouring',
    'Skin Rejuvenation',
  ],
} as const;

/**
 * Maps a concern to the service categories most relevant to it, so the
 * interactive section can link into the real catalogue. This is navigation
 * only — it makes no clinical claim and always ends at a consultation.
 */
export const CONCERN_CATEGORIES: Record<string, string[]> = {
  'Fine Lines & Wrinkles': ['facial-aesthetics', 'advanced-skin-treatments'],
  'Facial Volume & Definition': ['facial-aesthetics', 'collagen-biostimulation'],
  'Sagging & Loss of Firmness': ['lifting-contouring', 'collagen-biostimulation'],
  'Dark Circles & Tired Eyes': ['facial-aesthetics', 'skin-boosters-rejuvenation'],
  'Dull & Dehydrated Skin': ['skin-boosters-rejuvenation', 'skin-care'],
  'Acne & Acne Scars': ['advanced-skin-treatments', 'skin-care'],
  'Pigmentation & Uneven Tone': ['advanced-skin-treatments', 'laser'],
  'Large Pores & Skin Texture': ['advanced-skin-treatments', 'skin-care'],
  'Facial Contouring': ['lifting-contouring', 'facial-aesthetics'],
  'Skin Rejuvenation': ['skin-boosters-rejuvenation', 'collagen-biostimulation'],
};

/**
 * One line under each category's name. Collagen uses the lounge's own intro;
 * the rest are the lines from the treatments-page design. A category with no
 * line here shows none — nothing is written in for it.
 */
export const CATEGORY_INTROS: Partial<Record<string, string>> = {
  laser: 'Advanced laser solutions for smoother, clearer, hair-free skin.',
  'skin-care': 'Targeted care for healthy, clear, and glowing skin.',
  'permanent-makeup': 'Long-lasting, natural results that enhance your features.',
  'collagen-biostimulation': COLLAGEN_INTRO.body,
  'skin-boosters-rejuvenation':
    'Deep hydration and skin-quality treatments for a fresher, more youthful look.',
  'advanced-skin-treatments': 'Innovative treatments to renew, resurface, and tighten the skin.',
  'lifting-contouring': 'Non-surgical solutions to lift, define, and contour your features.',
  'beauty-nails': 'Complete nail care and beauty services for a polished look.',
};

/** The line icon that stands for each category, in badges, tiles and the category bar. */
export const CATEGORY_ICONS: Partial<Record<string, IconName>> = {
  laser: 'laser',
  'skin-care': 'leaf',
  'permanent-makeup': 'lips',
  nails: 'nail',
  'facial-aesthetics': 'face',
  'collagen-biostimulation': 'molecule',
  'skin-boosters-rejuvenation': 'droplet',
  'advanced-skin-treatments': 'flask',
  'lifting-contouring': 'lift',
  'beauty-nails': 'sparkle',
  piercing: 'earring',
};

export const categoryIcon = (slug: string): IconName => CATEGORY_ICONS[slug] ?? 'sparkle';

/**
 * Card artwork per category, used when a service carries no `imageUrl` of its
 * own. Files are generated by `scripts/generate-placeholders.mjs` — replace
 * them in `public/images/categories/` with real Nurella photography (same 4:1
 * framing) as it becomes available, no code change needed.
 */
export const CATEGORY_IMAGES: Partial<Record<string, string>> = {
  laser: '/images/categories/laser.svg',
  'skin-care': '/images/categories/skin-care.svg',
  'permanent-makeup': '/images/categories/permanent-makeup.svg',
  nails: '/images/categories/nails.svg',
  'facial-aesthetics': '/images/categories/facial-aesthetics.svg',
  'collagen-biostimulation': '/images/categories/collagen-biostimulation.svg',
  'skin-boosters-rejuvenation': '/images/categories/skin-boosters-rejuvenation.svg',
  'advanced-skin-treatments': '/images/categories/advanced-skin-treatments.svg',
  'lifting-contouring': '/images/categories/lifting-contouring.svg',
  'beauty-nails': '/images/categories/beauty-nails.svg',
  piercing: '/images/categories/piercing.svg',
};

/** Falls back to neutral brand artwork for categories added after this list. */
export const DEFAULT_CATEGORY_IMAGE = '/images/categories/default.svg';

export const categoryImage = (slug: string) => CATEGORY_IMAGES[slug] ?? DEFAULT_CATEGORY_IMAGE;

export const CATEGORY_ORDER = [
  'laser',
  'skin-care',
  'permanent-makeup',
  'nails',
  'facial-aesthetics',
  'collagen-biostimulation',
  'skin-boosters-rejuvenation',
  'advanced-skin-treatments',
  'lifting-contouring',
  'beauty-nails',
  'piercing',
] as const;

/**
 * CONFIGURATION PLACEHOLDERS.
 *
 * Nurella did not supply these details. They are listed explicitly instead of
 * being filled with plausible-looking fiction.
 *
 * Most of them now have a home: set the `VITE_BUSINESS_*` variables in
 * `frontend/.env` (see `.env.example`) and the footer, the structured data,
 * the location/phone/hours FAQ entries and `llms.txt` all pick them up at once
 * — see `docs/GEO-NAP-AUDIT.md`. Until then every one of those surfaces omits
 * the detail rather than inventing it.
 */
export const MISSING_INFORMATION = [
  'Street address',
  'Phone number',
  'Contact email',
  'Opening hours shown publicly (the booking engine uses the admin-configured schedule)',
  'Service pricing',
  'Team members',
] as const;
