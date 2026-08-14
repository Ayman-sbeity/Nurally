import { Schema, model, type HydratedDocument } from 'mongoose';
import { omitInternal } from './serialization';

/**
 * EVERYTHING THE ASSISTANT IS ALLOWED TO SAY.
 *
 * The WhatsApp assistant answers strictly from this document. That is the whole
 * design: a fact that is not written here cannot be stated, so the lounge edits
 * one record rather than a prompt buried in the source, and a wrong answer is
 * always traceable to a wrong field.
 *
 * Keyed by `phoneNumberId` — which of our WhatsApp numbers the message arrived
 * on — rather than being a lone singleton, so one deployment can serve several
 * businesses without their answers bleeding into each other.
 *
 * Build or refresh it from the live catalogue with:
 *   npm run whatsapp:profile:apply --workspace backend
 */

export interface ProfileService {
  name: string;
  /**
   * Omitted rather than zeroed when the lounge has not set one. The prompt
   * turns an absent price into "confirmed at consultation"; a `0` would be
   * read as free.
   */
  price?: number;
  currency?: string;
  durationMinutes?: number;
  /** Category label, so the assistant can group a long menu when asked. */
  category?: string;
  /**
   * Weekdays this treatment is performed on (0 = Sunday … 6 = Saturday), when
   * it is restricted to some — the permanent-makeup and piercing work is done
   * by a visiting practitioner who is only in on Wednesdays.
   *
   * Empty means the lounge's own opening days are the only limit. Carried into
   * the prompt so the assistant can say "that one is Wednesdays only" up front,
   * rather than discovering it from `check_availability` after having already
   * suggested a Friday.
   */
  availableWeekdays?: number[];
}

export interface ProfileFaq {
  q: string;
  a: string;
}

export interface BusinessProfileAttrs {
  /** The Meta phone-number id this profile answers on. One profile per number. */
  phoneNumberId: string;
  /** WhatsApp Business Account id. Recorded for support, not used at runtime. */
  wabaId?: string;
  /**
   * Set only when this number carries its own token. Otherwise the shared
   * `WA_TOKEN` is used. Never serialised.
   */
  accessToken?: string;

  name: string;
  description: string;
  /** Free text — `Mon–Sat 10:00–19:00, closed Sunday`. Written for a reader. */
  hours: string;
  location: string;
  timezone: string;

  services: ProfileService[];
  faqs: ProfileFaq[];

  /**
   * What the assistant must say about pricing and about what a booking means.
   * Kept separate from `description` because these two are the answers most
   * likely to embarrass the lounge if improvised.
   */
  pricingPolicy?: string;
  bookingPolicy?: string;
  /** Anything the lounge wants added verbatim to the assistant's rules. */
  extraInstructions?: string;

  isActive: boolean;
}

export type BusinessProfileDocument = HydratedDocument<BusinessProfileAttrs>;

const serviceSchema = new Schema<ProfileService>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, min: 0 },
    currency: { type: String, trim: true, maxlength: 8 },
    durationMinutes: { type: Number, min: 5, max: 600 },
    category: { type: String, trim: true, maxlength: 80 },
    availableWeekdays: { type: [{ type: Number, min: 0, max: 6 }], default: undefined },
  },
  { _id: false },
);

const faqSchema = new Schema<ProfileFaq>(
  {
    q: { type: String, required: true, trim: true, maxlength: 300 },
    a: { type: String, required: true, trim: true, maxlength: 1200 },
  },
  { _id: false },
);

const businessProfileSchema = new Schema<BusinessProfileAttrs>(
  {
    phoneNumberId: { type: String, required: true, unique: true, trim: true, index: true },
    wabaId: { type: String, trim: true },
    // A client's own Meta token is a credential: never returned by an API, and
    // not loaded unless a caller asks for it by name.
    accessToken: { type: String, select: false },

    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    hours: { type: String, required: true, trim: true, maxlength: 1000 },
    location: { type: String, default: '', trim: true, maxlength: 500 },
    timezone: { type: String, required: true, trim: true, maxlength: 64 },

    services: { type: [serviceSchema], default: [] },
    faqs: { type: [faqSchema], default: [] },

    pricingPolicy: { type: String, trim: true, maxlength: 1000 },
    bookingPolicy: { type: String, trim: true, maxlength: 1000 },
    extraInstructions: { type: String, trim: true, maxlength: 2000 },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => omitInternal(ret, ['accessToken']),
    },
  },
);

export const BusinessProfile = model<BusinessProfileAttrs>(
  'BusinessProfile',
  businessProfileSchema,
);
