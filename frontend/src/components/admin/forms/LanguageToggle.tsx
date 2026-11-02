import { LOCALE_NAMES } from '@/content/clientForms';
import type { FormLocale } from '@/types/api';

const STORAGE_KEY = 'nurella.formLocale';

/**
 * The language this device last filled a form in. The lounge's tablet tends to
 * stay with one language, so the next form opens in it. A per-device
 * convenience only — storage can be unavailable, and Arabic, the lounge's own
 * paper form, is the fallback.
 */
export function preferredFormLocale(): FormLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'en' || stored === 'ar' ? stored : 'ar';
  } catch {
    return 'ar';
  }
}

export function rememberFormLocale(locale: FormLocale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the choice simply is not remembered.
  }
}

interface LanguageToggleProps {
  value: FormLocale;
  onChange: (locale: FormLocale) => void;
  /** Names the group for screen readers, e.g. "Form language". */
  label: string;
}

/**
 * Two toggle buttons rather than tabs: switching language changes the words on
 * the same form, it does not reveal a different panel. Each name is written in
 * its own language and tagged with it, so a screen reader pronounces it
 * correctly.
 */
export function LanguageToggle({ value, onChange, label }: LanguageToggleProps) {
  return (
    <div className="nu-langtoggle" role="group" aria-label={label}>
      {(['ar', 'en'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={value === locale}
          onClick={() => onChange(locale)}
        >
          {LOCALE_NAMES[locale]}
        </button>
      ))}
    </div>
  );
}
