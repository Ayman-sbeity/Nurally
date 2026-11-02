/**
 * TREATMENT PHOTOGRAPHY — ART DIRECTION
 * ------------------------------------
 * Every generated treatment image is described to the model with this brief
 * first, then the scene for the particular treatment. The brief is fixed here,
 * on the server, rather than sent by the admin: it is what keeps forty-odd
 * images looking like one shoot, and it carries the rules that matter for an
 * aesthetics clinic — no invented results, no before/after, nothing graphic.
 * The admin only ever chooses the scene.
 *
 * Change the look of every future image here — palette, setting, who the
 * client is. Images already published are not affected.
 */
const ART_DIRECTION = [
  'A photorealistic editorial photograph for the website of Nurella, a luxury beauty and aesthetics lounge.',
  'Light and colour: soft natural daylight, warm and calm; a palette of cream, warm sand, soft beige and muted champagne gold with warm brown accents; no cold clinical blue, no harsh white.',
  'Setting: a clean, minimal, modern treatment room with warm wood, linen and stone textures, uncluttered.',
  'People: the client is an elegant woman with a natural Middle Eastern or Mediterranean appearance, natural makeup and a relaxed, confident expression, with realistic skin texture — not airbrushed — and natural, correctly formed hands.',
  'Practitioners appear only in part — hands in white nitrile gloves, the sleeve of a cream uniform — and never face the camera.',
  'Modesty: tasteful and covered, with robes, towels and draped linen; no nudity and nothing suggestive.',
  'Composition: a square frame with the subject centred and calm space on every side, so the picture can be cropped to a wide banner or a tall portrait without cutting the subject; shallow depth of field, the look of an 85mm lens.',
  'Never include: text, letters, numbers, logos, watermarks or brand names; before-and-after comparisons; exaggerated or unrealistic results; blood, redness, bruising or wounds; needles piercing the skin.',
].join(' ');

/** The full prompt for one treatment: the shared brief, then what this picture shows. */
export function treatmentPhotoPrompt(input: { title: string; scene: string }): string {
  return `${ART_DIRECTION}\n\nTreatment: ${input.title}.\nScene: ${input.scene}`;
}
