import { BRAND } from '@/content/brand';

/**
 * FLOATING "CHAT ON WHATSAPP".
 *
 * A plain link — `wa.me` opens the app (or WhatsApp Web on a desktop) with the
 * message pre-typed, and the assistant on the other end handles everything from
 * there. No API, no state, nothing to go wrong on the page.
 *
 * Renders nothing at all unless `VITE_WHATSAPP_NUMBER` is set. The site's rule
 * throughout is that an unsupplied contact detail is omitted rather than
 * guessed, and a chat button that opens WhatsApp on an empty number is worse
 * than no button.
 */

/** Digits only, country code included — `wa.me` rejects `+`, spaces and dashes. */
const NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, '');

const MESSAGE =
  import.meta.env.VITE_WHATSAPP_MESSAGE ?? `Hi ${BRAND.name}, I would like to ask about a treatment`;

export function WhatsAppButton() {
  if (!NUMBER) return null;

  const href = `https://wa.me/${NUMBER}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      className="nu-whatsapp"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with us on WhatsApp"
    >
      {/* Inline rather than an <img>: it inherits currentColor, costs no
          request, and cannot flash in late over the page. */}
      <svg className="nu-whatsapp__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.83 9.83 0 0 1 2.892 6.994c-.003 5.45-4.437 9.884-9.884 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.548 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413"
        />
      </svg>
      <span className="nu-whatsapp__label">Chat on WhatsApp</span>
    </a>
  );
}
