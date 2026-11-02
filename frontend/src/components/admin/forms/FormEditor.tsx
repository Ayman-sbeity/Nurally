import { useEffect, useId, useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import {
  FORM_UI,
  answersToSave,
  isShown,
  missingToSign,
  type FieldDef,
  type FormDef,
} from '@/content/clientForms';
import { dateKey, formatShortDateTime } from '@/utils/format';
import { FormFrame } from './FormFrame';
import { SignaturePad } from './SignaturePad';
import type {
  Appointment,
  ClientFormSignaturePayload,
  FormAnswers,
  FormLocale,
  SignerRole,
} from '@/types/api';

type Values = Record<string, string | string[]>;

export interface EditorSaveInput {
  answers: FormAnswers;
  appointmentId: string | null;
  signature?: ClientFormSignaturePayload;
}

interface FormEditorProps {
  form: FormDef;
  locale: FormLocale;
  clientName: string;
  initialAnswers: FormAnswers;
  initialAppointmentId?: string;
  /** The client's bookings, offered as the session a record belongs to. */
  appointments: Appointment[];
  /** The lounge's treatments, suggested for "treatment the client would like". */
  serviceNames: string[];
  saving: boolean;
  /** Field errors from a refused save, keyed `answers.<question>`. */
  serverIssues: { field: string; message: string }[];
  /** Resolves true once saved, so the editor can mark itself clean. */
  onSave: (input: EditorSaveInput) => Promise<boolean>;
}

/** Every question starts as an empty string, or an empty list for tick-boxes. */
function toValues(fields: FieldDef[], answers: FormAnswers): Values {
  return Object.fromEntries(
    fields.map((field) => {
      const value = answers[field.key];
      if (field.kind === 'multi') return [field.key, Array.isArray(value) ? value : []];
      return [field.key, typeof value === 'string' ? value : ''];
    }),
  );
}

/**
 * Fills in, saves and signs a form.
 *
 * A draft saves whatever has been answered so far; signing is the moment the
 * required questions must be complete, and the signature is drawn on the form
 * itself. Questions that stop applying — allergy details after "No" — are
 * hidden, and their answers are dropped on save rather than left behind
 * contradicting the answer that hid them.
 *
 * Switching language only changes the words around the answers: nothing typed
 * is lost, and the choice is saved with the form.
 */
export function FormEditor({
  form,
  locale,
  clientName,
  initialAnswers,
  initialAppointmentId,
  appointments,
  serviceNames,
  saving,
  serverIssues,
  onSave,
}: FormEditorProps) {
  const t = FORM_UI[locale];
  const suggestionsId = useId();
  const fields = useMemo(() => [...form.header, ...form.sections.flatMap((section) => section.fields)], [form]);

  const {
    register,
    getValues,
    setValue,
    setError,
    clearErrors,
    setFocus,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({ defaultValues: toValues(fields, initialAnswers) });

  // Watched as a whole: whether a question shows depends on other answers.
  const values = watch() as FormAnswers;

  const [appointmentId, setAppointmentId] = useState(initialAppointmentId ?? '');
  const [appointmentChanged, setAppointmentChanged] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signerRole, setSignerRole] = useState<SignerRole>(form.signerRoles[0] ?? 'CLIENT');
  /** Null until edited: until then the name follows the form's own answers. */
  const [signerName, setSignerName] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signerNameError, setSignerNameError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const suggestedSigner =
    signerRole === 'CLIENT'
      ? String(values.fullName ?? '')
      : signerRole === 'PROVIDER'
        ? String(values.providerName ?? '')
        : '';
  const effectiveSigner = signerName ?? suggestedSigner;

  const dirty = isDirty || appointmentChanged || signature !== null;

  // A browser close or reload with unsaved answers asks first. Navigating
  // inside the app is not covered: this router has no blocking API.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The server re-checks everything; its refusals land under their questions.
  useEffect(() => {
    for (const issue of serverIssues) {
      if (!issue.field.startsWith('answers.')) continue;
      setError(issue.field.slice('answers.'.length), {
        type: 'server',
        message: issue.message === 'Required before signing.' ? t.required : issue.message,
      });
    }
  }, [serverIssues, setError, t.required]);

  const linkAppointment = (id: string) => {
    setAppointmentId(id);
    setAppointmentChanged(true);
    const appointment = appointments.find((candidate) => candidate._id === id);
    if (!appointment) return;
    setValue('sessionDate', dateKey(parseISO(appointment.startAt)), { shouldDirty: true });
    if (!getValues('requestedProcedure')) {
      setValue('requestedProcedure', appointment.serviceNameSnapshot, { shouldDirty: true });
    }
  };

  const saveDraft = async () => {
    setSummary(null);
    const current = getValues() as FormAnswers;
    const saved = await onSave({
      answers: answersToSave(form, current),
      appointmentId: appointmentId || null,
    });
    if (saved) {
      reset(getValues());
      setAppointmentChanged(false);
    }
  };

  const signAndSave = async () => {
    const current = getValues() as FormAnswers;
    clearErrors();

    const missing = missingToSign(form, current);
    missing.forEach((key) => setError(key, { type: 'required', message: t.required }));
    const name = effectiveSigner.trim();
    setSignerNameError(name.length < 2 ? t.signerNameMissing : null);
    setSignatureError(signature ? null : t.signatureMissing);

    if (missing.length > 0) {
      setSummary(t.fixBeforeSigning);
      setFocus(missing[0] as string);
      return;
    }
    setSummary(null);
    if (name.length < 2 || !signature) return;

    const saved = await onSave({
      answers: answersToSave(form, current),
      appointmentId: appointmentId || null,
      signature: { image: signature, signerName: name, signerRole },
    });
    if (saved) {
      reset(getValues());
      setAppointmentChanged(false);
    }
  };

  const question = (field: FieldDef) =>
    isShown(field.showWhen, values) ? (
      <Question
        key={field.key}
        field={field}
        locale={locale}
        register={register}
        error={errors[field.key]?.message}
        suggestionsId={suggestionsId}
      />
    ) : null;

  return (
    <FormFrame form={form} locale={locale} status="DRAFT">
      <form
        noValidate
        onSubmit={(event) => {
          // Enter in a text field must not sign the form.
          event.preventDefault();
        }}
      >
        <datalist id={suggestionsId}>
          {serviceNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="nu-cform__meta">
          <div className="nu-cform__q">
            <p className="nu-cform__label">{t.clientName}</p>
            <p className="nu-cform__answer" dir="auto">
              {clientName}
            </p>
          </div>
          {form.header.map(question)}
          {form.type === 'SESSION_RECORD' && appointments.length > 0 && (
            <AppointmentPicker
              label={t.linkedAppointment}
              noneLabel={t.noAppointment}
              value={appointmentId}
              appointments={appointments}
              onChange={linkAppointment}
            />
          )}
        </div>

        {form.sections
          .filter((section) => isShown(section.showWhen, values))
          .map((section) => (
            <section key={section.key} className="nu-cform__section">
              <h2 className="nu-cform__heading">{section.title[locale]}</h2>
              {section.intro && <p className="nu-cform__intro">{section.intro[locale]}</p>}
              <div className="nu-cform__grid">{section.fields.map(question)}</div>
              {section.note && <p className="nu-cform__note">{section.note[locale]}</p>}
            </section>
          ))}

        <section className="nu-cform__section nu-cform__sign">
          {form.declaration && <p className="nu-cform__declaration">{form.declaration[locale]}</p>}

          <div className="nu-cform__grid">
            {form.signerRoles.length > 1 && (
              <fieldset className="nu-cform__q nu-cform__q--full">
                <legend className="nu-cform__label">{t.signedBy}</legend>
                <div className="nu-cform__options">
                  {form.signerRoles.map((role) => (
                    <label key={role} className="nu-cform__option">
                      <input
                        type="radio"
                        name="signerRole"
                        checked={signerRole === role}
                        onChange={() => {
                          setSignerRole(role);
                          setSignerName(null);
                        }}
                      />
                      <span>{t.signerRole[role]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <SignerNameField
              label={t.signerName}
              value={effectiveSigner}
              error={signerNameError ?? undefined}
              onChange={setSignerName}
            />
          </div>

          <SignaturePad
            label={form.signatureLabel[locale]}
            hint={t.signHint}
            clearLabel={t.clearSignature}
            error={signatureError ?? undefined}
            onChange={(image) => {
              setSignature(image);
              if (image) setSignatureError(null);
            }}
          />
        </section>

        <div className="nu-cform__actions nu-noprint">
          {summary && (
            <p className="nu-error nu-cform__summary" role="alert">
              {summary}
            </p>
          )}
          <Button variant="outline" onClick={() => void saveDraft()} disabled={saving}>
            {t.saveDraft}
          </Button>
          <Button onClick={() => void signAndSave()} loading={saving}>
            {t.signAndSave}
          </Button>
        </div>
      </form>
    </FormFrame>
  );
}

// --- One question ---------------------------------------------------------------

interface QuestionProps {
  field: FieldDef;
  locale: FormLocale;
  register: UseFormRegister<Values>;
  error?: string;
  suggestionsId: string;
}

/**
 * A question with its label, hint and error wired to the control for screen
 * readers. Choices are large tap targets rather than a dropdown: on the
 * lounge's tablet one tap answers, and every option is visible at once as on
 * the paper form.
 */
function Question({ field, locale, register, error, suggestionsId }: QuestionProps) {
  const id = useId();
  const t = FORM_UI[locale];
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const label = (
    <>
      {field.label[locale]}
      {field.requiredToSign && (
        <>
          <span className="nu-cform__req" aria-hidden="true">
            *
          </span>
          <span className="nu-sr-only"> ({t.required})</span>
        </>
      )}
    </>
  );

  const footer = (
    <>
      {field.hint && (
        <p className="nu-hint" id={hintId}>
          {field.hint[locale]}
        </p>
      )}
      {error && (
        <p className="nu-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (field.kind === 'choice' || field.kind === 'multi') {
    return (
      <fieldset
        className={`nu-cform__q nu-cform__q--full${error ? ' is-invalid' : ''}`}
        aria-describedby={describedBy}
      >
        <legend className="nu-cform__label">{label}</legend>
        <div className="nu-cform__options">
          {field.options.map((option) => (
            <label key={option.value} className="nu-cform__option">
              <input
                type={field.kind === 'choice' ? 'radio' : 'checkbox'}
                value={option.value}
                {...register(field.key)}
              />
              <span>{option.label[locale]}</span>
            </label>
          ))}
        </div>
        {footer}
      </fieldset>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <div className="nu-cform__q nu-cform__q--full">
        <label className="nu-cform__label" htmlFor={id}>
          {label}
        </label>
        <textarea
          id={id}
          className="nu-textarea"
          rows={3}
          // Follows whatever language is typed, not the language of the form.
          dir="auto"
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          {...register(field.key)}
        />
        {footer}
      </div>
    );
  }

  return (
    <div className="nu-cform__q">
      <label className="nu-cform__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="nu-input"
        type={field.kind}
        // Phone numbers read left to right in either language.
        dir={field.kind === 'tel' ? 'ltr' : field.kind === 'text' ? 'auto' : undefined}
        list={field.kind === 'text' && field.suggest ? suggestionsId : undefined}
        autoComplete="off"
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        {...register(field.key)}
      />
      {footer}
    </div>
  );
}

function SignerNameField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="nu-cform__q">
      <label className="nu-cform__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="nu-input"
        dir="auto"
        autoComplete="off"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p className="nu-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function AppointmentPicker({
  label,
  noneLabel,
  value,
  appointments,
  onChange,
}: {
  label: string;
  noneLabel: string;
  value: string;
  appointments: Appointment[];
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div className="nu-cform__q">
      <label className="nu-cform__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="nu-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{noneLabel}</option>
        {appointments.map((appointment) => (
          <option key={appointment._id} value={appointment._id}>
            {formatShortDateTime(appointment.startAt)} · {appointment.serviceNameSnapshot}
          </option>
        ))}
      </select>
    </div>
  );
}
