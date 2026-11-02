import {
  FORM_UI,
  answerText,
  isShown,
  type FieldDef,
  type FormDef,
} from '@/content/clientForms';
import { FormFrame } from './FormFrame';
import type { Appointment, ClientForm, FormLocale } from '@/types/api';
import { formatShortDateTime } from '@/utils/format';

interface FormViewProps {
  form: FormDef;
  record: ClientForm;
  /** The language to show the questions in — the answers stay as written. */
  locale: FormLocale;
  appointment?: Appointment;
}

const isWide = (field: FieldDef) => field.kind !== 'text' && field.kind !== 'tel' && field.kind !== 'date';

/**
 * A saved form, read-only, laid out like the paper original. This is also
 * what prints.
 *
 * Free-text answers carry `dir="auto"`: an answer typed in Arabic on a form
 * now being read in English still runs right-to-left, and the reverse.
 */
export function FormView({ form, record, locale, appointment }: FormViewProps) {
  const t = FORM_UI[locale];
  const answers = record.answers;

  const answer = (field: FieldDef) => {
    const text = answerText(field, answers[field.key], locale);
    return (
      <div key={field.key} className={`nu-cform__q${isWide(field) ? ' nu-cform__q--full' : ''}`}>
        <p className="nu-cform__label">{field.label[locale]}</p>
        <p className={`nu-cform__answer${text ? '' : ' is-empty'}`} dir="auto">
          {text || t.notAnswered}
        </p>
      </div>
    );
  };

  const recordedBy =
    record.signature && typeof record.signature.recordedBy === 'object'
      ? record.signature.recordedBy.fullName
      : null;

  return (
    <FormFrame form={form} locale={locale} status={record.status}>
      <div className="nu-cform__meta">
        <div className="nu-cform__q">
          <p className="nu-cform__label">{t.clientName}</p>
          <p className="nu-cform__answer" dir="auto">
            {record.clientName}
          </p>
        </div>
        {form.header.map(answer)}
        {appointment && (
          <div className="nu-cform__q">
            <p className="nu-cform__label">{t.linkedAppointment}</p>
            <p className="nu-cform__answer">
              {formatShortDateTime(appointment.startAt)} · {appointment.serviceNameSnapshot}
            </p>
          </div>
        )}
      </div>

      {form.sections
        .filter((section) => isShown(section.showWhen, answers))
        .map((section) => (
          <section key={section.key} className="nu-cform__section">
            <h2 className="nu-cform__heading">{section.title[locale]}</h2>
            <div className="nu-cform__grid">
              {section.fields.filter((field) => isShown(field.showWhen, answers)).map(answer)}
            </div>
            {section.note && <p className="nu-cform__note">{section.note[locale]}</p>}
          </section>
        ))}

      <section className="nu-cform__section nu-cform__sign">
        {form.declaration && <p className="nu-cform__declaration">{form.declaration[locale]}</p>}
        <p className="nu-cform__label">{form.signatureLabel[locale]}</p>
        {record.signature ? (
          <div className="nu-cform__signed">
            {record.signatureImage && (
              <img className="nu-cform__signature" src={record.signatureImage} alt={record.signature.signerName} />
            )}
            <p dir="auto">
              {record.signature.signerName} · {t.signerRole[record.signature.signerRole]}
            </p>
            <p className="nu-hint">
              {t.date}: {formatShortDateTime(record.signature.signedAt)}
            </p>
            {recordedBy && (
              <p className="nu-hint nu-noprint" lang="en" dir="ltr">
                Recorded by {recordedBy}
              </p>
            )}
          </div>
        ) : (
          <p className="nu-cform__answer is-empty">{t.draft}</p>
        )}
      </section>
    </FormFrame>
  );
}
