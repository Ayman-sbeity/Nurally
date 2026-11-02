import type { ReactNode } from 'react';
import { FORM_UI, directionOf, type FormDef } from '@/content/clientForms';
import type { ClientFormStatus, FormLocale } from '@/types/api';

interface FormFrameProps {
  form: FormDef;
  locale: FormLocale;
  status?: ClientFormStatus;
  children: ReactNode;
}

/**
 * The paper form's frame — letterhead, title, standing notes and the
 * confidential footer — around either the editor or the read-only view.
 *
 * `lang` and `dir` are set here, on the document, rather than on the page:
 * only the form switches to Arabic and right-to-left, while the admin around
 * it stays as it is. The brand line is pinned to English as on the paper.
 */
export function FormFrame({ form, locale, status, children }: FormFrameProps) {
  const t = FORM_UI[locale];

  return (
    <article className="nu-cform" lang={locale} dir={directionOf(locale)}>
      <header className="nu-cform__masthead">
        <p className="nu-cform__brand" lang="en" dir="ltr">
          NURELLA BEAUTY LOUNGE
        </p>
        <h1 className="nu-cform__title">{form.title[locale]}</h1>
        <p className="nu-cform__subtitle">{form.subtitle[locale]}</p>
        {status && (
          <span className={`nu-badge nu-badge--form-${status.toLowerCase()}`}>
            {status === 'SIGNED' ? t.signed : t.draft}
          </span>
        )}
      </header>

      {children}

      {form.disclaimer && <p className="nu-cform__disclaimer">{form.disclaimer[locale]}</p>}
      <footer className="nu-cform__footer">{t.confidential}</footer>
    </article>
  );
}
