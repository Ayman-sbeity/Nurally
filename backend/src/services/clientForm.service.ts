import type { Types } from 'mongoose';
import { z } from 'zod';
import { Appointment } from '../models/Appointment';
import { ClientForm, type ClientFormAttrs } from '../models/ClientForm';
import { User } from '../models/User';
import {
  ClientFormStatus,
  ClientFormType,
  SignerRole,
  UserRole,
  type FormLocale,
} from '../types/domain';
import { ApiError } from '../utils/ApiError';
import {
  answersSchemaFor,
  missingForSignature,
  type FormAnswers,
  type SignatureInput,
} from '../validators/clientForm.validators';
import { renderSignature } from './image.service';

/** Who may sign each form: the client signs their own declaration, the provider their notes. */
const SIGNER_ROLES: Record<ClientFormType, SignerRole[]> = {
  [ClientFormType.HEALTH_INTAKE]: [SignerRole.CLIENT, SignerRole.GUARDIAN],
  [ClientFormType.SESSION_RECORD]: [SignerRole.PROVIDER],
};

const AUTHORS = 'createdBy updatedBy signature.recordedBy';

/**
 * Checks answers against the form's own schema. Parsed inside an `answers`
 * object so a rejected field is reported as `answers.<key>` — the same path
 * the editor uses to put the message under the right question.
 *
 * Unanswered questions are dropped rather than stored as empty: "not
 * answered" then has exactly one representation, and the driver would
 * otherwise write an `undefined` as `null`.
 */
function parseAnswers(type: ClientFormType, answers: unknown): FormAnswers {
  const parsed = z.object({ answers: answersSchemaFor(type) }).parse({ answers }).answers as FormAnswers;
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined,
    ),
  );
}

/**
 * Validates and renders a signature. Refused while a required question is
 * unanswered — signing is the point at which the form has to be complete.
 */
async function sign(
  type: ClientFormType,
  answers: FormAnswers,
  signature: SignatureInput,
  actorId: Types.ObjectId,
) {
  const missing = missingForSignature(type, answers);
  if (missing.length > 0) {
    throw ApiError.badRequest(
      'Answer the required questions before signing.',
      missing.map((field) => ({ field: `answers.${field}`, message: 'Required before signing.' })),
    );
  }

  if (!SIGNER_ROLES[type].includes(signature.signerRole)) {
    throw ApiError.badRequest('That person cannot sign this form.');
  }

  const image = await renderSignature(
    Buffer.from(signature.image.slice(signature.image.indexOf(',') + 1), 'base64'),
  );

  return {
    signature: {
      signerName: signature.signerName,
      signerRole: signature.signerRole,
      signedAt: new Date(),
      recordedBy: actorId,
    },
    signatureImage: image,
  };
}

/** A session can be linked to one of this client's own bookings, never another's. */
async function assertAppointmentOf(
  clientId: Types.ObjectId,
  appointmentId: string,
  type: ClientFormType,
): Promise<void> {
  if (type !== ClientFormType.SESSION_RECORD) {
    throw ApiError.badRequest('Only a session record can be linked to an appointment.');
  }
  if (!(await Appointment.exists({ _id: appointmentId, client: clientId }))) {
    throw ApiError.badRequest('That appointment does not belong to this client.');
  }
}

export async function listForms(clientId: Types.ObjectId) {
  return ClientForm.find({ client: clientId })
    .sort({ createdAt: -1 })
    .populate(AUTHORS, 'fullName')
    .lean();
}

/** One form, with its signature image — the only read that carries it. */
export async function getForm(formId: string) {
  const form = await ClientForm.findById(formId)
    .select('+signatureImage')
    .populate(AUTHORS, 'fullName')
    .lean();
  if (!form) throw ApiError.notFound('That form could not be found.');
  return form;
}

export async function createForm(input: {
  clientId: string;
  type: ClientFormType;
  locale: FormLocale;
  answers: unknown;
  appointmentId?: string;
  signature?: SignatureInput;
  actorId: Types.ObjectId;
}) {
  const client = await User.findOne({ _id: input.clientId, role: UserRole.CLIENT })
    .select('fullName')
    .lean();
  if (!client) throw ApiError.notFound('That client could not be found.');

  const answers = parseAnswers(input.type, input.answers);
  if (input.appointmentId) await assertAppointmentOf(client._id, input.appointmentId, input.type);
  const signed = input.signature
    ? await sign(input.type, answers, input.signature, input.actorId)
    : null;

  const form = await ClientForm.create({
    client: client._id,
    type: input.type,
    locale: input.locale,
    status: signed ? ClientFormStatus.SIGNED : ClientFormStatus.DRAFT,
    clientName: client.fullName,
    ...(input.appointmentId ? { appointment: input.appointmentId } : {}),
    answers,
    ...(signed ?? {}),
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return getForm(form.id as string);
}

const staleCopy = () =>
  ApiError.conflict('Someone else saved this form after you opened it. Reload to see their changes.');

const signedAlready = () =>
  ApiError.conflict('This form has been signed and can no longer be changed.');

/**
 * Saves a draft, optionally signing it in the same write.
 *
 * The write is conditional on the form still being the draft the editor
 * loaded: two people saving the same draft cannot silently overwrite each
 * other, and nothing can change a form another request has just signed.
 */
export async function updateForm(
  formId: string,
  input: {
    expectedUpdatedAt: string;
    locale?: FormLocale;
    answers?: unknown;
    appointmentId?: string | null;
    signature?: SignatureInput;
    actorId: Types.ObjectId;
  },
) {
  const form = await ClientForm.findById(formId).lean();
  if (!form) throw ApiError.notFound('That form could not be found.');
  if (form.status === ClientFormStatus.SIGNED) throw signedAlready();
  if (form.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) throw staleCopy();

  const answers =
    input.answers === undefined ? (form.answers as FormAnswers) : parseAnswers(form.type, input.answers);
  if (input.appointmentId) await assertAppointmentOf(form.client, input.appointmentId, form.type);
  const signed = input.signature
    ? await sign(form.type, answers, input.signature, input.actorId)
    : null;

  const set: Partial<ClientFormAttrs> = {
    answers,
    updatedBy: input.actorId,
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.appointmentId ? { appointment: input.appointmentId as unknown as Types.ObjectId } : {}),
    ...(signed ? { status: ClientFormStatus.SIGNED, ...signed } : {}),
  };

  const updated = await ClientForm.findOneAndUpdate(
    { _id: form._id, status: ClientFormStatus.DRAFT, updatedAt: form.updatedAt },
    input.appointmentId === null ? { $set: set, $unset: { appointment: 1 } } : { $set: set },
  );
  if (!updated) {
    const current = await ClientForm.findById(formId).select('status').lean();
    throw current?.status === ClientFormStatus.SIGNED ? signedAlready() : staleCopy();
  }

  return getForm(formId);
}

/**
 * Only drafts can be deleted. A signed form is part of the client's clinical
 * record and goes only when the client is erased as a whole.
 */
export async function deleteForm(formId: string): Promise<void> {
  const deleted = await ClientForm.findOneAndDelete({ _id: formId, status: ClientFormStatus.DRAFT });
  if (deleted) return;

  if (await ClientForm.exists({ _id: formId })) {
    throw ApiError.conflict('Signed forms are kept with the client’s record and cannot be deleted.');
  }
  throw ApiError.notFound('That form could not be found.');
}
