import sharp, { type FitEnum, type Sharp } from 'sharp';
import { ApiError } from '../utils/ApiError';

/**
 * Every image the browser is shown is re-encoded here first.
 *
 * A phone photograph arrives at 3–6 MB and 4000+ pixels on a side. Sending
 * that to fill a 150px tile is what made the client file slow: the browser
 * downloads and decodes the whole thing for every thumbnail. Each preset below
 * is sized for where the image is actually drawn, and encoded as WebP, which
 * every browser the lounge uses decodes and which is a fraction of a JPEG's
 * size at the same quality.
 *
 * Re-encoding has two side effects worth having:
 *  - EXIF orientation is applied to the pixels, so a photo taken sideways
 *    shows upright everywhere, whatever the viewer does with the tag.
 *  - Metadata is dropped, GPS position included, so a photo never carries
 *    where it was taken to whoever is looking at it.
 *
 * Decoding is also the strictest check an upload gets: a file that passes the
 * magic-byte test but is not a readable image fails here, before anything is
 * written to storage.
 */

interface Preset {
  width: number;
  height: number;
  fit: keyof FitEnum;
  quality: number;
}

const PRESETS = {
  /**
   * Grid tiles. `outside` makes the *short* edge 400px, which covers a 3:4
   * tile at three times pixel density whichever way the photo was taken.
   */
  thumb: { width: 400, height: 400, fit: 'outside', quality: 72 },
  /**
   * The full-size preview. 2048px on the long edge keeps skin texture legible
   * on a laptop screen at retina density, at a tenth of the original's weight.
   */
  display: { width: 2048, height: 2048, fit: 'inside', quality: 82 },
  /** Profile photos are drawn at 88px at most; this covers that at 3×. */
  avatar: { width: 320, height: 320, fit: 'outside', quality: 78 },
  /** Website artwork, which can be a full-bleed hero on a retina display. */
  web: { width: 2400, height: 2400, fit: 'inside', quality: 80 },
} satisfies Record<string, Preset>;

export type ImagePreset = keyof typeof PRESETS;

export interface EncodedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/webp';
  extension: '.webp';
}

/** What a client photograph is stored as, alongside its untouched original. */
export interface RenderedVariants {
  /** The original's size once upright — its aspect ratio is what the UI needs. */
  width: number;
  height: number;
  thumb: EncodedImage;
  display: EncodedImage;
}

const unreadable = () =>
  ApiError.badRequest('That image could not be read. Try saving it again as a JPEG and re-uploading.');

/**
 * `failOn: 'error'` rather than the default `'warning'`: phone cameras write
 * JPEGs with small spec violations that every viewer shows correctly, and
 * refusing those would refuse real client photographs.
 */
const open = (input: Buffer) => sharp(input, { failOn: 'error' }).autoOrient();

async function encode(pipeline: Sharp, preset: Preset): Promise<EncodedImage> {
  const { data, info } = await pipeline
    .resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit,
      // A small source stays small; upscaling only adds bytes.
      withoutEnlargement: true,
    })
    .webp({ quality: preset.quality })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height, mimeType: 'image/webp', extension: '.webp' };
}

/** Re-encodes one image to a preset. Throws a 400 when the bytes are not a readable image. */
export async function encodeImage(input: Buffer, preset: ImagePreset): Promise<EncodedImage> {
  try {
    return await encode(open(input), PRESETS[preset]);
  } catch {
    throw unreadable();
  }
}

/** Format and size of an image, or null when the bytes are not one. */
export async function readImageInfo(
  input: Buffer,
): Promise<{ format: string; width: number; height: number } | null> {
  try {
    const { format, width, height } = await sharp(input, { failOn: 'error' }).metadata();
    return format && width && height ? { format, width, height } : null;
  } catch {
    return null;
  }
}

/**
 * Re-encodes a signature drawn on a form's signature pad, returned as a PNG
 * data URL ready to store.
 *
 * Kept as PNG rather than WebP: a signature is a few dark strokes on a
 * transparent ground, which PNG stores losslessly in a few kilobytes and
 * prints crisply. A uniform image — nothing drawn — is refused, so an
 * accidental tap on "Sign" cannot record an empty signature.
 */
export async function renderSignature(input: Buffer): Promise<string> {
  try {
    // A pad is at most a few thousand pixels a side; anything larger is not one.
    const image = sharp(input, { failOn: 'error', limitInputPixels: 8_000_000 });
    const [metadata, stats] = await Promise.all([image.metadata(), image.clone().stats()]);
    if (metadata.format !== 'png') throw unreadableSignature();
    if (stats.channels.every((channel) => channel.min === channel.max)) {
      throw ApiError.badRequest('Please sign in the box before signing the form.');
    }

    const png = await image
      .resize({ width: 1200, height: 400, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw unreadableSignature();
  }
}

const unreadableSignature = () => ApiError.badRequest('The signature could not be read. Please sign again.');

/**
 * Renders the thumbnail and preview of a client photograph from one decode.
 * Throws a 400 when the bytes are not a readable image.
 */
export async function renderVariants(input: Buffer): Promise<RenderedVariants> {
  try {
    const source = open(input);
    const [metadata, thumb, display] = await Promise.all([
      source.metadata(),
      encode(source.clone(), PRESETS.thumb),
      encode(source.clone(), PRESETS.display),
    ]);

    return { width: metadata.autoOrient.width, height: metadata.autoOrient.height, thumb, display };
  } catch {
    throw unreadable();
  }
}
