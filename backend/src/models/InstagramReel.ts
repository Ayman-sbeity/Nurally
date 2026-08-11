import { Schema, model, type HydratedDocument } from 'mongoose';
import { omitInternal } from './serialization';

/**
 * A reel the lounge has chosen to feature on the website.
 *
 * Nothing here is fetched from Instagram. The Graph API needs a Business
 * account, a linked Facebook Page, an app review and a token that has to be
 * refreshed every sixty days — and the moment any of that lapses the section
 * on the home page empties itself. So the admin curates the reels instead:
 * paste the permalink, add a cover, optionally upload the video.
 *
 * `videoUrl` is what makes a reel playable without leaving the site. When it is
 * absent the front end falls back to Instagram's own embed, which still plays
 * in place but costs the visitor a third-party frame.
 */
export interface InstagramReelAttrs {
  /** Canonical `https://www.instagram.com/reel/<shortcode>/`. */
  permalink: string;
  /** Parsed out of the permalink; the embed URL is built from it. */
  shortcode: string;
  caption?: string;
  /** Poster frame. Required — a video with no poster is a black rectangle. */
  coverImageUrl: string;
  altText: string;
  /** Uploaded MP4. Absent means "play it through Instagram's embed". */
  videoUrl?: string;
  /** Editorial date, shown as a subtitle. Absent when the admin leaves it out. */
  postedAt?: Date;
  isActive: boolean;
  displayOrder: number;
}

export type InstagramReelDocument = HydratedDocument<InstagramReelAttrs>;

const instagramReelSchema = new Schema<InstagramReelAttrs>(
  {
    permalink: { type: String, required: true, trim: true, maxlength: 500 },
    // Unique so the same reel cannot be featured twice — the rail would show
    // it side by side with itself.
    shortcode: { type: String, required: true, trim: true, unique: true, maxlength: 40 },
    caption: { type: String, trim: true, maxlength: 600 },
    coverImageUrl: { type: String, required: true, trim: true, maxlength: 500 },
    altText: { type: String, required: true, trim: true, maxlength: 240 },
    videoUrl: { type: String, trim: true, maxlength: 500 },
    postedAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret),
    },
  },
);

instagramReelSchema.index({ isActive: 1, displayOrder: 1 });

export const InstagramReel = model<InstagramReelAttrs>('InstagramReel', instagramReelSchema);
