import { Link } from 'react-router-dom';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { FORM_UI, LOCALE_NAMES, formatFormDate, healthAlerts } from '@/content/clientForms';
import { useClientForms } from '@/hooks/queries';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';
import type { ClientForm } from '@/types/api';

interface Props {
  clientId: string;
}

const StatusBadge = ({ form }: { form: ClientForm }) => (
  <span className={`nu-badge nu-badge--form-${form.status.toLowerCase()}`}>
    {FORM_UI.en[form.status === 'SIGNED' ? 'signed' : 'draft']}
  </span>
);

const signedLine = (form: ClientForm) =>
  form.signature
    ? `Signed ${formatDate(form.signature.signedAt)} by ${form.signature.signerName} (${FORM_UI.en.signerRole[form.signature.signerRole].toLowerCase()})`
    : `Draft started ${formatDate(form.createdAt)}`;

/**
 * The client's clinical forms: the health form, with its earlier versions, and
 * a record per session.
 *
 * Both read from one listing, which is also where the health alerts at the
 * top of the client page come from — one request for all of it.
 */
export function ClientForms({ clientId }: Props) {
  const { can } = usePermissions();
  const { data, isPending } = useClientForms(clientId);
  const forms = data?.forms ?? [];

  // The listing is newest first.
  const healthForms = forms.filter((form) => form.type === 'HEALTH_INTAKE');
  const current = healthForms.find((form) => form.status === 'SIGNED');
  const draft = healthForms.find((form) => form.status === 'DRAFT');
  const earlier = healthForms.filter((form) => form !== current && form !== draft);
  const versionOf = (form: ClientForm) => healthForms.length - healthForms.indexOf(form);

  const sessions = forms
    .filter((form) => form.type === 'SESSION_RECORD')
    .sort((a, b) =>
      String(b.answers.sessionDate ?? b.createdAt).localeCompare(String(a.answers.sessionDate ?? a.createdAt)),
    );

  return (
    <div className="nu-cforms">
      <section className="nu-panel">
        <header className="nu-panel__head">
          <h2 className="nu-panel__title">Health form</h2>
          {draft && can('CLIENTS', 'EDIT') ? (
            <ButtonLink to={`/admin/clients/${clientId}/forms/${draft._id}`} size="sm" variant="outline">
              Continue draft
            </ButtonLink>
          ) : (
            can('CLIENTS', 'CREATE') && (
              <ButtonLink to={`/admin/clients/${clientId}/forms/new/health`} size="sm" variant="outline">
                {current ? 'Update' : 'Fill in'}
              </ButtonLink>
            )
          )}
        </header>
        <div className="nu-panel__body nu-stack">
          {isPending && <p className="nu-hint">Loading forms…</p>}

          {!isPending && healthForms.length === 0 && (
            <EmptyState
              title="No health form yet"
              message="Fill it in with the client before their first treatment — in Arabic or English — and have them sign it on screen."
            />
          )}

          {current && (
            <div className="nu-cforms__current">
              <div>
                <p>
                  <Link className="nu-link" to={`/admin/clients/${clientId}/forms/${current._id}`}>
                    Version {versionOf(current)}
                  </Link>{' '}
                  <StatusBadge form={current} />
                </p>
                <p className="nu-hint">
                  {signedLine(current)} · {LOCALE_NAMES[current.locale]}
                </p>
              </div>
              {/* Anything that is recorded is flagged at the top of the page. */}
              {healthAlerts(current.answers).length === 0 && (
                <p className="nu-hint">No allergies, reactions or conditions recorded.</p>
              )}
            </div>
          )}

          {draft && (
            <p className="nu-hint">
              {current ? 'An update is in progress' : 'A draft is in progress'} — started{' '}
              {formatDate(draft.createdAt)}.{' '}
              <Link className="nu-link" to={`/admin/clients/${clientId}/forms/${draft._id}`}>
                Open draft
              </Link>
            </p>
          )}

          {earlier.length > 0 && (
            <details className="nu-cforms__history">
              <summary>Earlier versions ({earlier.length})</summary>
              <ul>
                {earlier.map((form) => (
                  <li key={form._id}>
                    <Link className="nu-link" to={`/admin/clients/${clientId}/forms/${form._id}`}>
                      Version {versionOf(form)}
                    </Link>{' '}
                    <span className="nu-hint">{signedLine(form)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </section>

      <section className="nu-panel">
        <header className="nu-panel__head">
          <h2 className="nu-panel__title">Session records</h2>
          {can('CLIENTS', 'CREATE') && (
            <ButtonLink to={`/admin/clients/${clientId}/forms/new/session`} size="sm" variant="outline">
              New session record
            </ButtonLink>
          )}
        </header>
        <div className="nu-panel__body nu-panel__body--flush">
          {!isPending && sessions.length === 0 ? (
            <div className="nu-panel__body">
              <EmptyState
                title="No session records yet"
                message="Start one for each treatment: what was asked for, what was used, and the follow-up."
              />
            </div>
          ) : (
            <div className="nu-table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="nu-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Treatment</th>
                    <th scope="col">Provider</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="nu-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((form) => {
                    const { answers } = form;
                    const treatment = answers.performedProcedure ?? answers.requestedProcedure;
                    const followUp =
                      form.status === 'DRAFT' && typeof answers.followUpDate === 'string'
                        ? answers.followUpDate
                        : null;
                    return (
                      <tr key={form._id}>
                        <td>
                          {typeof answers.sessionDate === 'string'
                            ? formatFormDate(answers.sessionDate, 'en')
                            : formatDate(form.createdAt)}
                        </td>
                        <td dir="auto" className="nu-cforms__treatment">
                          {typeof treatment === 'string' ? treatment : '—'}
                        </td>
                        <td dir="auto">{typeof answers.providerName === 'string' ? answers.providerName : '—'}</td>
                        <td>
                          <StatusBadge form={form} />
                          {followUp && (
                            <span className="nu-hint nu-cforms__followup">
                              Follow-up {formatFormDate(followUp, 'en')}
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/admin/clients/${clientId}/forms/${form._id}`}
                            className="nu-btn nu-btn--ghost nu-btn--sm"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
