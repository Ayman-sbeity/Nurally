import type { ServiceCategorySlug } from '@/types/api';

/**
 * WHAT EACH TREATMENT PHOTO SHOWS
 * -------------------------------
 * The scene suggested for a treatment's AI photograph. The look — light,
 * palette, setting, the client, what must never appear — is fixed on the
 * server (`backend/src/services/aiImage/treatmentPhoto.ts`); these only say
 * what is happening in the picture.
 *
 * Written out per treatment because the model cannot be trusted to know what
 * "messo lifting", "nano balading" or "gel pose" look like from the name.
 * Matched by keywords rather than exact names, so a renamed treatment
 * ("Microbalding" → "Microblading") or a variant ("Botox — Korean") still
 * finds its scene; anything new falls back to its category.
 *
 * Every scene is a suggestion: the admin sees it and can rewrite it before an
 * image is made. Injectables are shown at the consultation or preparation
 * moment — marking, a capped syringe — never a needle in the skin.
 */

interface SceneRule {
  match: RegExp;
  scene: string;
}

/** First match wins, so the specific rules come before the general ones. */
const RULES: SceneRule[] = [
  // --- Laser -------------------------------------------------------------------
  {
    match: /laser hair|hair removal/,
    scene:
      'The woman lies relaxed on a treatment bed wearing protective laser goggles, covered by a soft cream towel, while a practitioner glides a sleek laser hair-removal handpiece along her lower leg.',
  },
  {
    match: /tattoo/,
    scene:
      'A woman’s forearm with a small fine-line tattoo rests on a padded cream armrest while a practitioner holds a slim laser handpiece just above it; both wear protective glasses.',
  },
  {
    match: /co2|co₂|resurfacing/,
    scene:
      'The woman reclines with her eyes covered by small protective eye shields while a practitioner holds a fractional laser handpiece a short distance from her cheek; her skin looks calm and even.',
  },
  {
    match: /rf micro/,
    scene:
      'The woman lies on a treatment bed with her hair wrapped in a towel while a practitioner rests a modern radiofrequency handpiece against her cheek; a sleek device glows softly in the background.',
  },
  {
    match: /radio ?frequency/,
    scene:
      'The woman lies with a warm towel folded at her neck while a practitioner holds a smooth, rounded radiofrequency handpiece to her forehead; a light sheen of gel on the skin.',
  },
  {
    match: /hifu/,
    scene:
      'The woman lies with her eyes closed while a practitioner presses a smooth ultrasound handpiece gently along her jawline, a thin layer of clear gel on the skin.',
  },

  // --- Skin --------------------------------------------------------------------
  {
    match: /micro ?needling/,
    scene:
      'The woman lies with her hair wrapped in a soft towel while a practitioner holds a sleek microneedling pen near her forehead; serum glistens lightly on her skin.',
  },
  {
    match: /hydra ?facial/,
    scene:
      'The woman lies with her eyes closed while a practitioner glides a hydrafacial wand across her cheek, a fine dewy glow of serum on her skin and the device softly out of focus behind.',
  },
  {
    match: /diamond/,
    scene:
      'A practitioner moves a diamond-tip microdermabrasion wand gently across the forehead of a woman lying with her eyes closed and her hair wrapped in a cream towel.',
  },
  {
    match: /deep clean/,
    scene:
      'The woman lies with her hair wrapped in a towel while a practitioner gently cleanses her face with soft brushes and a creamy cleanser; a bowl of warm water and folded towels sit nearby.',
  },
  {
    // "messo lifting" — a mesolift, as the catalogue spells it.
    match: /mess+o/,
    scene:
      'The woman reclines with dewy skin while a practitioner presses gently upward along her cheekbone with gloved fingertips; a small glass vial of serum waits on a tray.',
  },
  {
    match: /meso|cocktail/,
    scene:
      'The woman reclines calmly with dewy, fresh skin while a practitioner prepares a small glass vial of serum on a linen-lined tray beside her.',
  },
  {
    match: /acne scar/,
    scene:
      'During a consultation, a practitioner examines the cheek of a relaxed woman under a softly lit magnifying lamp, one gloved hand resting lightly near her face.',
  },
  {
    match: /pigment/,
    scene:
      'The woman lies with protective glasses on while a practitioner holds a light-based handpiece near her cheek; her skin tone looks soft and even.',
  },

  // --- Permanent makeup ---------------------------------------------------------
  {
    match: /lip blush/,
    scene:
      'A close, elegant view of a woman’s softly tinted natural lips as a practitioner holds a fine permanent-makeup pen near the lip line; small cups of rose pigment sit on a tray.',
  },
  {
    // Nanoblading in either spelling the catalogue has used: nanoblading, nano balading.
    match: /nano ?b/,
    scene:
      'A close, soft view of a woman’s natural, fine hair-stroke brows as a practitioner holds a slim permanent-makeup pen just above the brow; her eyes are closed.',
  },
  {
    // Every spelling the catalogue has used: microblading, microbalding.
    match: /blad|balad|balding|brow/,
    scene:
      'The woman lies with her eyes closed while a practitioner maps the shape of her brows with a fine white pencil and a measuring thread; her brows look natural and groomed.',
  },
  {
    match: /eye ?liner/,
    scene:
      'The woman lies with her eyes closed while a practitioner holds a fine permanent-makeup pen close to her upper lash line, which shows a soft, natural liner.',
  },

  // --- Injectables and contouring ------------------------------------------------
  {
    match: /botox|dysport|wrinkle/,
    scene:
      'The woman sits relaxed on a treatment chair, smiling slightly, while a practitioner gently marks a few small points on her forehead with a white cosmetic pencil; a small vial waits on a tray.',
  },
  {
    match: /lip/,
    scene:
      'A calm close portrait of a woman with naturally defined lips while a practitioner’s gloved fingertip rests near the corner of her mouth during an assessment.',
  },
  {
    match: /filler/,
    scene:
      'A practitioner holds a small capped, pre-filled syringe beside a relaxed woman seated on a treatment chair, in a calm consultation moment before treatment.',
  },
  {
    match: /cheek/,
    scene:
      'The woman smiles softly with her eyes closed while a practitioner marks a small point on her cheekbone with a white cosmetic pencil during a consultation.',
  },
  {
    match: /under.?eye/,
    scene:
      'The woman rests with her eyes gently closed while a practitioner assesses the under-eye area with a light touch; she looks fresh and rested.',
  },
  {
    match: /thread/,
    scene:
      'A serene three-quarter portrait of a woman while a practitioner traces fine planning lines from her cheek towards her temple with a white cosmetic pencil.',
  },
  // Five contouring treatments sit side by side on the website, so each gets
  // its own picture rather than five of the same profile.
  {
    match: /slimming/,
    scene:
      'A three-quarter portrait of a woman while a practitioner rests gloved fingertips on her lower cheek, assessing the jaw muscle; soft side light.',
  },
  {
    match: /v.?shape/,
    scene:
      'A front-facing portrait of a woman with a softly tapered, natural face shape while a practitioner’s gloved hands gently frame both sides of her lower face.',
  },
  {
    match: /jaw|chin/,
    scene:
      'The woman tilts her chin slightly upward while a practitioner’s gloved fingertips trace along her jawline towards her chin; soft light falls along the jaw.',
  },
  {
    match: /sculpt/,
    scene:
      'A three-quarter view of a woman as a practitioner marks a few small guiding points along her cheekbone and jaw with a white cosmetic pencil.',
  },
  {
    match: /contour/,
    scene:
      'The woman is seen in soft profile with naturally defined cheekbones, eyes closed, while a practitioner gently assesses her cheekbone with gloved fingertips; side light shapes her face.',
  },
  {
    match: /plla/,
    scene:
      'The woman rests with her eyes closed and glowing, firm-looking skin while a practitioner gently massages her cheek; a small glass vial sits on a linen-lined tray beside them.',
  },
  {
    match: /caha/,
    scene:
      'The woman sits upright in warm side light as a practitioner gently lifts the skin along her cheek with two gloved fingertips, showing its firmness.',
  },
  {
    match: /collagen|biostim/,
    scene:
      'A close portrait of a woman with firm, smooth-looking skin along her cheek and jaw, eyes closed, a practitioner’s gloved hand resting lightly at her temple.',
  },
  {
    match: /booster/,
    scene:
      'A close portrait of a woman with deeply hydrated, dewy skin, touching her cheek lightly, a drop of serum on her fingertip.',
  },
  {
    match: /polynucleotide/,
    scene:
      'The woman reclines with her eyes closed while a practitioner smooths a soothing serum across her cheeks with gloved fingertips; her skin looks supple and calm.',
  },
  {
    match: /exosome/,
    scene:
      'The woman lies with her eyes closed while a practitioner spreads a clear serum across her forehead with a soft fan brush; small amber glass bottles stand on the tray.',
  },
  {
    match: /glow|bright/,
    scene:
      'The woman sits in warm golden window light with luminous skin and her eyes closed, while a practitioner applies a brightening serum with a glass dropper.',
  },
  {
    match: /anti.?aging|anti.?ageing/,
    scene:
      'A woman in her forties with naturally radiant skin smiles softly with her eyes closed while a practitioner gently massages her temples.',
  },

  // --- Nails ----------------------------------------------------------------------
  {
    match: /pedicure/,
    scene:
      'A woman’s feet rest in a stone basin of warm water scattered with rose petals while a technician gently cares for them; cream towels and natural light around.',
  },
  {
    match: /gel pose|gel polish/,
    scene:
      'A woman’s hands rest under a small sleek LED nail lamp, her nails glossy with a nude-pink gel polish, a technician’s hands guiding them on a minimal marble table.',
  },
  {
    match: /extension/,
    scene:
      'A technician shapes elegant almond-shaped nail extensions in a soft nude finish on a woman’s hands resting on a linen cushion.',
  },
  {
    match: /manicure/,
    scene:
      'A woman’s elegant hands rest on a linen cushion while a nail technician files and shapes her nails; neutral polish bottles and a small vase of dried flowers nearby.',
  },
  {
    match: /nail/,
    scene:
      'A woman’s hands show elegant almond-shaped nails in a soft nude and pearl finish, resting on folded linen beside neatly arranged nail tools.',
  },
  {
    match: /facial/,
    scene:
      'The woman lies with her hair wrapped in a towel enjoying a relaxing facial while a practitioner gently applies a cream mask with a soft brush.',
  },

  // --- Piercing ------------------------------------------------------------------
  {
    match: /ear/,
    scene:
      'A woman’s ear with delicate fine gold studs and a small hoop, while a piercer in gloves cleans the lobe with a cotton pad; minimal and elegant.',
  },
  {
    match: /belly|navel/,
    scene:
      'A tasteful close view of a woman’s waist in a high-waisted cream skirt and a short linen top, a delicate gold navel ring catching the light.',
  },
  {
    match: /dermal|surface/,
    scene:
      'A woman’s collarbone with a single delicate sparkling dermal jewel, her soft cream top draped just below it; minimal and elegant.',
  },
];

/** For a treatment no rule recognises — usually one added after this list. */
const CATEGORY_SCENES: Record<ServiceCategorySlug, string> = {
  laser:
    'The woman lies relaxed on a treatment bed wearing protective glasses while a practitioner holds a sleek laser handpiece near her skin.',
  'skin-care':
    'The woman lies with her hair wrapped in a towel while a practitioner gently applies a creamy treatment to her face.',
  'permanent-makeup':
    'The woman lies with her eyes closed while a practitioner holds a fine permanent-makeup pen near her face, small pigment cups on a tray.',
  nails:
    'A woman’s elegant hands rest on a linen cushion while a nail technician cares for her nails.',
  'facial-aesthetics':
    'The woman sits relaxed on a treatment chair while a practitioner gently assesses her face with gloved fingertips during a consultation.',
  'collagen-biostimulation':
    'The woman rests with glowing, firm-looking skin while a practitioner prepares a small glass vial on a linen-lined tray.',
  'skin-boosters-rejuvenation':
    'A close portrait of a woman with hydrated, luminous skin in warm window light.',
  'advanced-skin-treatments':
    'The woman lies on a treatment bed while a practitioner holds a modern skin-treatment device near her cheek.',
  'lifting-contouring':
    'A calm portrait of a woman in soft side light while a practitioner gently assesses her jawline and cheekbones.',
  'beauty-nails':
    'The woman enjoys a relaxing beauty treatment in a serene room, a practitioner’s hands caring for her.',
  piercing:
    'A close, elegant view of delicate fine gold jewellery on a woman, while a piercer in gloves prepares with a cotton pad.',
};

const DEFAULT_SCENE =
  'The woman relaxes in a serene, luxurious treatment room while a practitioner prepares her treatment.';

/** The suggested scene for a treatment's photo. */
export function sceneFor(service: { name: string; category: ServiceCategorySlug }): string {
  const name = service.name.toLowerCase();
  return RULES.find((rule) => rule.match.test(name))?.scene ?? CATEGORY_SCENES[service.category] ?? DEFAULT_SCENE;
}
