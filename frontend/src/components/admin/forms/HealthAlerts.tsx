import { Link } from 'react-router-dom';
import { healthAlerts } from '@/content/clientForms';
import { formatDate } from '@/utils/format';
import type { ClientForm } from '@/types/api';

/** The newest signed health form — the one a provider should be reading. */
export const currentHealthForm = (forms: ClientForm[] | undefined): ClientForm | undefined =>
  forms?.find((form) => form.type === 'HEALTH_INTAKE' && form.status === 'SIGNED');

interface HealthAlertsProps {
  clientId: string;
  forms: ClientForm[] | undefined;
  /** Also says so when there is nothing to flag, or no signed form at all. */
  showClear?: boolean;
}

/**
 * Allergies, past severe reactions, pregnancy and contraindicating conditions
 * from the client's current health form, where a provider cannot miss them —
 * at the top of the client's page and above every new session record.
 *
 * Only a signed form counts: a draft is unconfirmed by the client.
 */
export function HealthAlerts({ clientId, forms, showClear = false }: HealthAlertsProps) {
  const current = currentHealthForm(forms);

  if (!current) {
    if (!showClear) return null;
    return (
      <div className="nu-notice nu-notice--warn" role="status">
        <p>
          <strong>No signed health form on file.</strong> Allergies and medical history have not
          been recorded for this client.{' '}
          <Link className="nu-link" to={`/admin/clients/${clientId}/forms/new/health`}>
            Fill it in
          </Link>
        </p>
      </div>
    );
  }

  const alerts = healthAlerts(current.answers);
  const signedOn = current.signature ? formatDate(current.signature.signedAt) : '';

  if (alerts.length === 0) {
    if (!showClear) return null;
    return (
      <div className="nu-notice nu-notice--success" role="status">
        <p>No allergies, reactions or conditions recorded on the health form signed {signedOn}.</p>
      </div>
    );
  }

  const severe = alerts.some((alert) => alert.severe);

  return (
    <section
      className={`nu-notice ${severe ? 'nu-notice--danger' : 'nu-notice--warn'} nu-health-alerts`}
      aria-label="Health alerts"
    >
      <div>
        <p className="nu-health-alerts__title">
          Health alerts{' '}
          <span className="nu-health-alerts__source">
            — from the health form signed {signedOn} ·{' '}
            <Link className="nu-link" to={`/admin/clients/${clientId}/forms/${current._id}`}>
              View
            </Link>
          </span>
        </p>
        <ul className="nu-health-alerts__list">
          {alerts.map((alert) => (
            <li key={alert.key}>
              <strong>{alert.label}</strong>
              {/* Free text is in whatever language the client wrote it in. */}
              {alert.detail && (
                <>
                  : <span dir="auto">{alert.detail}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
