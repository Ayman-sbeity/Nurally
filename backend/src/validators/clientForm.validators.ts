import { z } from 'zod';
import { ClientFormType, FormLocale, SignerRole } from '../types/domain';
import { objectIdSchema } from './appointment.validators';

/**
 * CLINICAL FORM ANSWERS
 * ---------------------
 * One schema per form, keyed exactly as the questions are keyed in
 * `frontend/src/content/clientForms.ts`. Rename a key in one place and it must
 * change in the other.
 *
 * Every answer is optional here because a draft may be saved half-filled. What
 * must be answered before a form can be signed is a separate list below, so
 * the rule is stated once and the server enforces it however the request was
 * made.
 *
 * Choices are stored as language-neutral codes (`YES`, `LATEX`), so a form
 * filled in Arabic reads correctly to someone viewing it in English. Free text
 * is stored exactly as written.
 */

/** A blank field and an absent one mean the same thing: not answered. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const short = z.preprocess(blankToUndefined, z.string().trim().max(300).optional());
const long = z.preprocess(blankToUndefined, z.string().trim().max(4000).optional());

/**
 * Calendar dates — birth, session, expiry — are kept as `YYYY-MM-DD` strings,
 * not instants. A date of birth stored as midnight UTC is a different day once
 * shown in the lounge's timezone; a plain date has no timezone to get wrong.
 */
const day = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a full date.')
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a valid date.')
    .optional(),
);

const oneOf = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

const manyOf = <T extends [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .transform((list) => [...new Set(list)])
    .optional();

const YES_NO = ['YES', 'NO'] as [string, ...string[]];
const YES_NO_UNKNOWN = ['YES', 'NO', 'UNKNOWN'] as [string, ...string[]];
const YES_NO_NA = ['YES', 'NO', 'NA'] as [string, ...string[]];

export const healthIntakeAnswersSchema = z.object({
  fileNumber: short,
  fileOpenedAt: day,

  fullName: short,
  dateOfBirth: day,
  phone: short,
  emergencyContact: short,

  hasKnownAllergy: oneOf(YES_NO_UNKNOWN),
  allergySources: manyOf([
    'MEDICATION',
    'LOCAL_ANAESTHETIC',
    'LATEX',
    'ANTISEPTIC',
    'COSMETIC',
    'FOOD',
    'OTHER',
  ]),
  allergen: short,
  allergyReaction: long,
  severeReaction: oneOf(YES_NO_UNKNOWN),
  severeReactionDetails: long,

  conditions: manyOf([
    'DIABETES',
    'BLEEDING_DISORDER',
    'AUTOIMMUNE',
    'IMMUNOCOMPROMISED',
    'OTHER_CHRONIC',
    'HERPES',
    'KELOID',
    'DELAYED_HEALING',
    'INFECTION_AT_SITE',
  ]),
  pregnant: oneOf(YES_NO_NA),
  breastfeeding: oneOf(YES_NO_NA),
  medicalHistory: long,
  medications: long,

  homeProducts: long,
  productUsage: long,
  previousProcedures: long,
});

export const sessionRecordAnswersSchema = z.object({
  fileNumber: short,
  sessionDate: day,
  providerName: short,

  chiefComplaint: long,
  requestedProcedure: short,
  treatmentArea: short,
  proposedProduct: short,
  proposedProductDetails: short,
  historyReviewed: oneOf(YES_NO),
  changesSinceLastVisit: long,
  preAssessment: long,
  decision: oneOf(['PROCEED', 'POSTPONE', 'REFER']),
  decisionReason: long,

  performedProcedure: long,
  productUsed: short,
  productConcentration: short,
  quantity: short,
  batchNumber: short,
  expiryDate: day,
  anaesthetic: short,
  device: short,
  procedureNotes: long,
  additionalProducts: long,

  procedureConsent: oneOf(['SIGNED', 'INCOMPLETE']),
  photoConsent: oneOf(['AGREE', 'DECLINE', 'NA']),

  postSessionCondition: long,
  aftercareExplained: long,
  writtenInstructions: oneOf(YES_NO),
  followUpDate: day,
  followUpOutcome: long,
});

export type FormAnswers = Record<string, string | string[] | undefined>;

export const answersSchemaFor = (type: ClientFormType) =>
  type === ClientFormType.HEALTH_INTAKE ? healthIntakeAnswersSchema : sessionRecordAnswersSchema;

interface SignRule {
  field: string;
  /** Required only when another answer is one of these values. */
  when?: { field: string; in: string[] };
}

/**
 * What a form must answer before it can be signed — the questions a provider
 * cannot safely treat without. Mirrored by `requiredToSign` in the front end's
 * form definitions, which only exists to say so before the round trip.
 */
export const REQUIRED_TO_SIGN: Record<ClientFormType, SignRule[]> = {
  [ClientFormType.HEALTH_INTAKE]: [
    { field: 'fullName' },
    { field: 'hasKnownAllergy' },
    { field: 'allergen', when: { field: 'hasKnownAllergy', in: ['YES'] } },
    { field: 'severeReaction' },
    { field: 'severeReactionDetails', when: { field: 'severeReaction', in: ['YES'] } },
    { field: 'pregnant' },
    { field: 'breastfeeding' },
  ],
  [ClientFormType.SESSION_RECORD]: [
    { field: 'sessionDate' },
    { field: 'providerName' },
    { field: 'historyReviewed' },
    { field: 'decision' },
    { field: 'decisionReason', when: { field: 'decision', in: ['POSTPONE', 'REFER'] } },
  ],
};

/** Keys of the unanswered required questions, in form order. */
export function missingForSignature(type: ClientFormType, answers: FormAnswers): string[] {
  const answered = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.length > 0;

  return REQUIRED_TO_SIGN[type]
    .filter((rule) => !rule.when || rule.when.in.includes(String(answers[rule.when.field] ?? '')))
    .filter((rule) => !answered(answers[rule.field]))
    .map((rule) => rule.field);
}

/**
 * A signature as drawn on the form's pad. The image is a PNG data URL; it is
 * decoded and re-encoded server-side, so this only bounds its size. A pad
 * signature is a few tens of kilobytes; the ceiling sits well inside the 1 MB
 * JSON body limit.
 */
const signatureSchema = z.object({
  image: z
    .string()
    .max(700_000, 'That signature is too large.')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, 'The signature could not be read.'),
  signerName: z.string().trim().min(2, 'Enter the name of the person signing.').max(120),
  signerRole: z.nativeEnum(SignerRole),
});

// Answers are validated against the form's own schema in the service, once its
// type is known — the PATCH body does not carry the type.
const answersInput = z.record(z.unknown());

export const createClientFormSchema = z.object({
  type: z.nativeEnum(ClientFormType),
  locale: z.nativeEnum(FormLocale),
  answers: answersInput.default({}),
  appointmentId: objectIdSchema.optional(),
  signature: signatureSchema.optional(),
});

export const updateClientFormSchema = z.object({
  /**
   * The `updatedAt` the editor loaded. A save against an older copy is refused
   * rather than silently overwriting a colleague's changes to the same draft.
   */
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  locale: z.nativeEnum(FormLocale).optional(),
  answers: answersInput.optional(),
  /** `null` unlinks the appointment. */
  appointmentId: objectIdSchema.nullable().optional(),
  signature: signatureSchema.optional(),
});

export type SignatureInput = z.infer<typeof signatureSchema>;

export const formIdParamSchema = z.object({ formId: objectIdSchema });
