import { Link } from 'react-router-dom';
import { BUSINESS } from '@/content/business';
import { Seo } from '@/components/ui/Seo';

/**
 * FORGOT PASSWORD — HANDLED BY THE LOUNGE
 * ---------------------------------------
 * Clients sign in with their phone number, and the server has no way to send
 * anything to it: there is no SMS provider, and no mail transport either. A
 * self-service reset form would collect a number, promise a message, and send
 * nothing — worse than no form at all.
 *
 * So this page does the honest thing and routes the client to the desk, which
 * can set a temporary password from their record (Admin → Clients → Reset
 * password). The lounge knows its clients; that is the check that replaces the
 * emailed link.
 *
 * The token endpoints on the server are untouched. Add a transport later and a
 * self-service flow can go back in front of them without unpicking this.
 */

/** Digits only — what `tel:` and `wa.me` both want. */
const dialable = BUSINESS.telephone?.replace(/[^\d+]/g, '') ?? null;
const whatsappNumber = BUSINESS.telephone?.replace(/\D/g, '') ?? null;

export function ForgotPasswordPage() {
  return (
    <>
      <Seo title="Forgot your password — Nurella Beauty Lounge" noIndex />

      <div>
        <h1 className="nu-heading" style={{ fontSize: 'var(--nu-text-2xl)' }}>
          Forgot your password?
        </h1>
        <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
          Message the lounge and we will reset it for you straight away. We will give you a
          temporary password to sign in with, which you can change once you are back in.
        </p>
      </div>

      <div className="nu-stack">
        <div className="nu-notice" role="note">
          <div>
            <p style={{ fontWeight: 500 }}>Have your phone number ready</p>
            <p>
              It is the number your account is under, and how we will find you.
            </p>
          </div>
        </div>

        {/* Only channels the lounge has actually configured are offered — an
            unconfigured phone number must not become a dead link. */}
        <div className="nu-stack" style={{ gap: 'var(--nu-space-3)' }}>
          {dialable && (
            <a href={`tel:${dialable}`} className="nu-btn nu-btn--primary nu-btn--block">
              Call {BUSINESS.telephone}
            </a>
          )}

          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="nu-btn nu-btn--outline nu-btn--block"
            >
              Message on WhatsApp
            </a>
          )}

          <a
            href={BUSINESS.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`nu-btn nu-btn--block ${dialable ? 'nu-btn--ghost' : 'nu-btn--primary'}`}
          >
            Message on Instagram
          </a>

          {BUSINESS.email && (
            <a href={`mailto:${BUSINESS.email}`} className="nu-btn nu-btn--ghost nu-btn--block">
              Email {BUSINESS.email}
            </a>
          )}
        </div>

        {BUSINESS.hoursLine && (
          <p className="nu-hint" style={{ textAlign: 'center' }}>
            {BUSINESS.hoursLine}
          </p>
        )}

        <Link to="/login" className="nu-hint" style={{ textAlign: 'center' }}>
          Back to sign in
        </Link>
      </div>
    </>
  );
}

export default ForgotPasswordPage;
