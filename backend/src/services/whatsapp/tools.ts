import crypto from 'node:crypto';
import { Service, type ServiceDocument } from '../../models/Service';
import { User, normalizePhone, type UserDocument } from '../../models/User';
import { UserRole } from '../../types/domain';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import {
  formatInLoungeZone,
  isDateKey,
  loungeTimezone,
  zonedMinuteToInstant,
} from '../../utils/time';
import { createBooking } from '../appointment.service';
import { computeDayAvailability } from '../availability.service';
import type { FunctionDeclaration } from './gemini';

/**
 * WHAT THE ASSISTANT CAN ACTUALLY DO.
 *
 * Both tools read and write through the same services the website uses. That is
 * the point: a WhatsApp booking is checked against opening hours, breaks,
 * blocked periods, weekday-restricted treatments and the minimum-notice window
 * by the *same* code that checks a booking made on the site, and it claims the
 * same slot lock. Two booking paths that disagree about what "14:00 is free"
 * means would eventually put two people in one chair.
 *
 * Every result is shaped for the model rather than for a UI: a refusal always
 * carries a reason it can say out loud, and, where possible, the alternatives
 * to offer instead.
 */

/** Openings named in one reply. More than this reads as a wall of numbers. */
const MAX_SLOTS_OFFERED = 8;

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'check_availability',
    description:
      "The lounge's real openings for one treatment on one date. Call this before naming any time to the customer. Returns the bookable start times, or the reason the day has none.",
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Treatment name, as close to the menu wording as possible.',
        },
        date: { type: 'string', description: 'Calendar date, YYYY-MM-DD.' },
      },
      required: ['service', 'date'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Submit a booking REQUEST for the customer. The lounge reviews and confirms it separately — this never confirms an appointment. Call only when you have the treatment, the date, a time that check_availability returned, and the customer name.',
    parameters: {
      type: 'object',
      properties: {
        service: { type: 'string', description: 'Treatment name from the menu.' },
        date: { type: 'string', description: 'Calendar date, YYYY-MM-DD.' },
        time: { type: 'string', description: '24-hour start time, HH:MM.' },
        name: { type: 'string', description: "The customer's name." },
      },
      required: ['service', 'date', 'time', 'name'],
    },
  },
];

// ---------------------------------------------------------------------------
// Matching what the customer said to what the lounge sells
// ---------------------------------------------------------------------------

const simplify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim();

/** Same again with the spaces closed up, so "micro blading" == "microblading". */
const squash = (value: string): string => simplify(value).replace(/\s+/g, '');

/**
 * Edits needed to find `needle` somewhere inside `haystack`.
 *
 * Approximate substring search, not plain Levenshtein: whatever surrounds the
 * treatment name in the customer's sentence costs nothing, so "eyebrows
 * nanoblading please" is measured against "nanobalading" alone rather than
 * penalised for the eleven characters of context around it.
 *
 * This exists because the catalogue is typed by people and read by people, and
 * the two spellings rarely agree. The lounge's own record says "Microbalding";
 * a customer asks for "microblading". One transposed pair should not be the
 * difference between booking a $150 treatment and being handed a list of twelve
 * options to choose from.
 *
 * Rows are needle characters, columns haystack characters. Row zero is all
 * zeroes — an empty needle matches at any offset for free, which is what makes
 * the start of the match floating — and the answer is the cheapest cell in the
 * final row, which does the same for the end.
 */
function approxContainsDistance(haystack: string, needle: string, limit: number): number {
  if (needle.length === 0) return 0;
  if (haystack.length + limit < needle.length) return limit + 1;

  let previous = new Array<number>(haystack.length + 1).fill(0);

  for (let i = 1; i <= needle.length; i += 1) {
    const current: number[] = [i];
    let best = i;

    for (let j = 1; j <= haystack.length; j += 1) {
      const substitute =
        (previous[j - 1] as number) + (needle[i - 1] === haystack[j - 1] ? 0 : 1);
      const value = Math.min(
        substitute,
        (previous[j] as number) + 1, // drop a needle character
        (current[j - 1] as number) + 1, // skip a haystack character
      );
      current.push(value);
      if (value < best) best = value;
    }

    // Every route through this row already costs more than we will accept.
    if (best > limit) return limit + 1;
    previous = current;
  }

  return Math.min(...previous);
}

/**
 * How wrong a spelling may be before it stops being the same word.
 *
 * Zero below five characters is the important end: "hifu" and "hair" are one
 * edit apart, and a fuzzy match there would book the wrong treatment rather
 * than ask a question.
 */
function toleranceFor(length: number): number {
  if (length >= 9) return 2;
  if (length >= 5) return 1;
  return 0;
}

/**
 * Resolves a spoken treatment name to a catalogue entry.
 *
 * Deliberately unforgiving about ambiguity: "laser" matching four laser
 * treatments returns *no* match and the candidate names, so the model asks
 * which one rather than silently booking the first. A wrong treatment booked
 * confidently is worse than one extra question.
 */
async function resolveService(
  spoken: string,
): Promise<{ service: ServiceDocument } | { candidates: string[] }> {
  const services = await Service.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
  const wanted = simplify(spoken);
  if (!wanted) return { candidates: services.map((service) => service.name) };

  const exact = services.find((service) => simplify(service.name) === wanted);
  if (exact) return { service: exact };

  // Substring either way: "lip blush" finds "Lip Blush Permanent Makeup", and
  // "book me the hydrafacial treatment please" finds "HydraFacial".
  const contains = services.filter((service) => {
    const name = simplify(service.name);
    return name.includes(wanted) || wanted.includes(name);
  });
  if (contains.length === 1) return { service: contains[0] as ServiceDocument };
  if (contains.length > 1) return { candidates: contains.map((service) => service.name) };

  // Last resort: shared significant words, ranked. Short words are dropped —
  // "the" and "of" would otherwise match everything.
  const words = wanted.split(' ').filter((word) => word.length > 2);
  const scored = services
    .map((service) => {
      const name = simplify(service.name);
      return { service, score: words.filter((word) => name.includes(word)).length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best && (scored.length === 1 || best.score > (scored[1]?.score ?? 0))) {
    return { service: best.service };
  }

  /**
   * Several treatments share a word and none stands out — "micro blading" hits
   * every "micro" in the menu. Held rather than returned, because a spelling
   * match below may still name the one the customer meant; if it does not,
   * these are the options to ask between.
   */
  const tied = scored.length > 1 ? scored.slice(0, 6).map((entry) => entry.service.name) : [];

  /**
   * Nothing shares a whole word. Before giving up, allow for a misspelling on
   * either side — the customer's or the catalogue's.
   *
   * Compared with the spaces closed up, because where the break falls is
   * exactly what the two sides disagree about ("nano blading" / "nanoblading").
   * A match must be within tolerance *and* strictly closer than the runner-up:
   * two treatments equally near a typo is not a match, it is a question.
   */
  const haystack = squash(spoken);
  const ranked = services
    .map((service) => {
      const name = squash(service.name);
      const tolerance = toleranceFor(name.length);
      return {
        service,
        distance: tolerance === 0 ? 1 : approxContainsDistance(haystack, name, tolerance),
        tolerance,
      };
    })
    .filter((entry) => entry.tolerance > 0 && entry.distance <= entry.tolerance)
    .sort((a, b) => a.distance - b.distance);

  const closest = ranked[0];
  if (closest && (ranked.length === 1 || closest.distance < (ranked[1]?.distance ?? 0))) {
    return { service: closest.service };
  }

  if (tied.length) return { candidates: tied };
  if (ranked.length > 1) return { candidates: ranked.map((entry) => entry.service.name) };

  return { candidates: services.slice(0, 12).map((service) => service.name) };
}

/** `HH:MM` → minutes from midnight, or `null` if it is not a time. */
function parseClock(value: string): number | null {
  const match = /^\s*(\d{1,2})\s*[:.h]?\s*(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// ---------------------------------------------------------------------------
// check_availability
// ---------------------------------------------------------------------------

const CLOSED_REASONS: Record<string, string> = {
  DAY_OFF: 'The lounge is closed that day.',
  BLOCKED: 'The lounge is closed that day.',
  FULLY_BOOKED: 'Fully booked that day.',
  PAST: 'That date has already passed.',
  TOO_FAR_AHEAD: 'That is further ahead than the lounge takes bookings.',
  SERVICE_DAY_OFF: 'That treatment is not performed on that day of the week.',
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function checkAvailability(args: {
  service?: unknown;
  date?: unknown;
}): Promise<Record<string, unknown>> {
  const spoken = typeof args.service === 'string' ? args.service : '';
  const date = typeof args.date === 'string' ? args.date.trim() : '';

  if (!isDateKey(date)) {
    return { ok: false, reason: 'Invalid date. Use YYYY-MM-DD.' };
  }

  const resolved = await resolveService(spoken);
  if ('candidates' in resolved) {
    return {
      ok: false,
      reason: 'That treatment could not be matched to the menu. Ask the customer which one they mean.',
      options: resolved.candidates,
    };
  }

  const service = resolved.service;
  const availability = await computeDayAvailability({
    dateKey: date,
    durationMinutes: service.durationMinutes,
    ...(service.availableWeekdays.length
      ? { availableWeekdays: service.availableWeekdays }
      : {}),
  });

  if (availability.slots.length === 0) {
    return {
      ok: true,
      service: service.name,
      date,
      open: false,
      reason: CLOSED_REASONS[availability.closedReason ?? ''] ?? 'No openings that day.',
      ...(availability.serviceAvailableWeekdays
        ? {
            treatmentDays: availability.serviceAvailableWeekdays.map(
              (weekday) => WEEKDAY_NAMES[weekday],
            ),
          }
        : {}),
    };
  }

  return {
    ok: true,
    service: service.name,
    date,
    open: true,
    timezone: loungeTimezone,
    durationMinutes: service.durationMinutes,
    times: availability.slots.slice(0, MAX_SLOTS_OFFERED).map((slot) => slot.label),
    more: Math.max(0, availability.slots.length - MAX_SLOTS_OFFERED),
  };
}

// ---------------------------------------------------------------------------
// book_appointment
// ---------------------------------------------------------------------------

/**
 * Finds the client record behind a WhatsApp number, creating one if this is a
 * first contact.
 *
 * The number arrives from Meta in full international form (`96170303380`) while
 * the lounge may have typed the same person in locally (`70 303 380`), so an
 * exact match on the normalised digits is tried first and a unique match on the
 * last eight second. "Unique" is doing the work there: two candidates mean we
 * do not know which one this is, and inventing a link would attach a stranger's
 * booking — and, later, their treatment photographs — to the wrong record.
 */
async function resolveClient(customerPhone: string, name: string): Promise<UserDocument> {
  const digits = normalizePhone(customerPhone);

  const exact = await User.findOne({ phoneNormalized: digits });
  if (exact) return exact;

  if (digits.length >= 8) {
    const tail = digits.slice(-8);
    const nearby = await User.find({ phoneNormalized: new RegExp(`${tail}$`) }).limit(2);
    if (nearby.length === 1) return nearby[0] as UserDocument;
  }

  /**
   * A password is required by the schema and this person has never chosen one,
   * so they get an unguessable value they will never be told. They can sign in
   * to the client app later through the lounge's reset flow; until then the
   * account exists only to hold their bookings.
   */
  const client = new User({
    fullName: name.trim().slice(0, 120),
    phone: `+${digits}`,
    passwordHash: await User.hashPassword(crypto.randomBytes(32).toString('hex')),
    role: UserRole.CLIENT,
    isActive: true,
  });
  await client.save();

  logger.info('WhatsApp: created a client record', {
    clientId: client.id,
    phone: client.phone,
  });
  return client;
}

export async function bookAppointment(
  args: { service?: unknown; date?: unknown; time?: unknown; name?: unknown },
  context: { customerPhone: string },
): Promise<Record<string, unknown>> {
  const spoken = typeof args.service === 'string' ? args.service : '';
  const date = typeof args.date === 'string' ? args.date.trim() : '';
  const time = typeof args.time === 'string' ? args.time.trim() : '';
  const name = typeof args.name === 'string' ? args.name.trim() : '';

  if (!name || name.length < 2) {
    return { ok: false, reason: 'The customer has not given their name yet. Ask for it.' };
  }
  if (!isDateKey(date)) return { ok: false, reason: 'Invalid date. Use YYYY-MM-DD.' };

  const minuteOfDay = parseClock(time);
  if (minuteOfDay === null) return { ok: false, reason: 'Invalid time. Use 24-hour HH:MM.' };

  const resolved = await resolveService(spoken);
  if ('candidates' in resolved) {
    return {
      ok: false,
      reason: 'That treatment could not be matched to the menu. Ask which one they mean.',
      options: resolved.candidates,
    };
  }
  const service = resolved.service;

  const startAt = zonedMinuteToInstant(date, minuteOfDay);

  /**
   * The same day's availability the customer was shown, recomputed now. It is
   * both the guard against a slot taken since and the source of the
   * alternatives offered when this one has gone — so a refusal is useful rather
   * than a dead end.
   */
  const availability = await computeDayAvailability({
    dateKey: date,
    durationMinutes: service.durationMinutes,
    ...(service.availableWeekdays.length
      ? { availableWeekdays: service.availableWeekdays }
      : {}),
  });

  const target = startAt.toISOString();
  if (!availability.slots.some((slot) => slot.startAt === target)) {
    return {
      ok: false,
      service: service.name,
      date,
      reason:
        availability.slots.length === 0
          ? (CLOSED_REASONS[availability.closedReason ?? ''] ?? 'No openings that day.')
          : 'That exact time is not available.',
      alternatives: availability.slots.slice(0, MAX_SLOTS_OFFERED).map((slot) => slot.label),
    };
  }

  try {
    const client = await resolveClient(context.customerPhone, name);
    if (!client.isActive) {
      return {
        ok: false,
        reason:
          'This customer’s account is on hold. Ask them to call the lounge directly — do not explain why.',
      };
    }

    const appointment = await createBooking(client._id, {
      serviceId: service._id.toString(),
      startAt: target,
      clientNotes: `Requested over WhatsApp by ${name}.`,
    });

    logger.info('WhatsApp: booking request created', {
      appointmentId: appointment.id,
      clientId: client.id,
      service: service.name,
      startAt: target,
    });

    return {
      ok: true,
      status: 'REQUESTED',
      service: appointment.serviceNameSnapshot,
      when: formatInLoungeZone(appointment.startAt, "EEEE d MMMM 'at' HH:mm"),
      timezone: loungeTimezone,
      note: 'This is a request, not a confirmation. Tell the customer the lounge will confirm shortly.',
    };
  } catch (error) {
    /**
     * An ApiError is the booking engine refusing for a reason a person can
     * understand — the slot went in the last second, the treatment was
     * deactivated — so the message is passed to the model to relay. Anything
     * else is ours, and is logged rather than narrated to a customer.
     */
    if (error instanceof ApiError) {
      return { ok: false, reason: error.message };
    }
    logger.error('WhatsApp: booking failed', error);
    return {
      ok: false,
      reason:
        'The booking could not be saved. Apologise and say a team member will follow up shortly.',
    };
  }
}

/** Runs a tool call by name. Unknown names cannot reach here — but say so if they do. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  context: { customerPhone: string },
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'check_availability':
      return checkAvailability(args);
    case 'book_appointment':
      return bookAppointment(args, context);
    default:
      return { ok: false, reason: `Unknown tool "${name}".` };
  }
}
