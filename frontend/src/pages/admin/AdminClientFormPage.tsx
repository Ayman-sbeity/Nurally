import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { FormEditor, type EditorSaveInput } from '@/components/admin/forms/FormEditor';
import { FormView } from '@/components/admin/forms/FormView';
import { HealthAlerts } from '@/components/admin/forms/HealthAlerts';
import {
  LanguageToggle,
  preferredFormLocale,
  rememberFormLocale,
} from '@/components/admin/forms/LanguageToggle';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { FORMS, LOCALE_NAMES, formBySlug, todayKey, type FormDef } from '@/content/clientForms';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { qk, useAdminClient, useClientForm, useClientForms, useServices } from '@/hooks/queries';
import { usePermissions } from '@/hooks/usePermissions';
import { dateKey } from '@/utils/format';
import type { Appointment, ClientForm, FormAnswers, FormLocale, User } from '@/types/api';

/** Bookings worth linking a session record to — not ones that never happened. */
const LINKABLE = new Set(['CONFIRMED', 'COMPLETED', 'RESCHEDULE_REQUESTED', 'PENDING']);

/**
 * Where a new form starts.
 *
 * A new health form version starts from the last one: the health form is
 * "updated at every visit", so the client confirms or corrects what they told
 * us before rather than writing it all out again. A session record starts
 * with the file number, today's date and the signed-in provider.
 */
function startingAnswers(
  form: FormDef,
  client: User,
  forms: ClientForm[],
  provider: string | undefined,
  appointment: Appointment | undefined,
): FormAnswers {
  const healthForms = forms.filter((candidate) => candidate.type === 'HEALTH_INTAKE');
  const previous = healthForms.find((candidate) => candidate.status === 'SIGNED') ?? healthForms[0];

  if (form.type === 'HEALTH_INTAKE') {
    if (previous) return { ...previous.answers };
    return {
      fileOpenedAt: todayKey(),
      fullName: client.fullName,
      ...(client.phone ? { phone: client.phone } : {}),
    };
  }

  const fileNumber = previous?.answers.fileNumber;
  return {
    ...(typeof fileNumber === 'string' ? { fileNumber } : {}),
    sessionDate: appointment ? dateKey(parseISO(appointment.startAt)) : todayKey(),
    ...(provider ? { providerName: provider } : {}),
    ...(appointment ? { requestedProcedure: appointment.serviceNameSnapshot } : {}),
  };
}

/**
 * One clinical form: a new one, a draft being filled in, or a signed one to
 * read and print.
 *
 * A form gets a page of its own rather than a dialog: it is long, it is
 * filled in on a tablet, often by the client, and it has to print cleanly.
 */
export function AdminClientFormPage() {
  const { id: clientId, formId, formSlug } = useParams<{ id: string; formId?: string; formSlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { can } = usePermissions();
  const { user } = useAuth();

  const isNew = Boolean(formSlug);
  const clientQuery = useAdminClient(clientId);
  const formsQuery = useClientForms(clientId);
  const recordQuery = useClientForm(isNew ? undefined : formId);
  const { data: servicesData } = useServices();

  const record = recordQuery.data?.form;
  const form = isNew ? formBySlug(formSlug) : record ? FORMS[record.type] : undefined;

  const [locale, setLocale] = useState<FormLocale>(preferredFormLocale);
  /**
   * The copy of the draft this editor is working from. Captured once and moved
   * on only by our own saves — never by a background refetch — so a colleague's
   * save in the meantime is reported as a conflict instead of overwritten.
   */
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<{ field: string; message: string }[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!record) return;
    // Opened in the language it was filled in.
    setLocale(record.locale);
    setBaseUpdatedAt((current) => current ?? record.updatedAt);
    // Only when a different form is opened, not on every refetch of this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?._id]);

  const save = useMutation({
    mutationFn: async (input: EditorSaveInput) => {
      if (isNew) {
        return adminApi.createClientForm(clientId as string, {
          type: (form as FormDef).type,
          locale,
          answers: input.answers,
          ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
          ...(input.signature ? { signature: input.signature } : {}),
        });
      }
      return adminApi.updateClientForm((record as ClientForm)._id, {
        expectedUpdatedAt: baseUpdatedAt ?? (record as ClientForm).updatedAt,
        locale,
        answers: input.answers,
        appointmentId: input.appointmentId,
        ...(input.signature ? { signature: input.signature } : {}),
      });
    },
  });

  const discard = useMutation({
    mutationFn: () => adminApi.deleteClientForm((record as ClientForm)._id),
    onSuccess: () => {
      notify('Draft discarded.', 'success');
      void queryClient.invalidateQueries({ queryKey: qk.clientForms(clientId as string) });
      navigate(`/admin/clients/${clientId}`, { replace: true });
    },
    onError: (error) =>
      notify(error instanceof ApiRequestError ? error.message : 'That draft could not be discarded.', 'error'),
  });

  const handleSave = async (input: EditorSaveInput): Promise<boolean> => {
    setServerIssues([]);
    try {
      const { form: saved } = await save.mutateAsync(input);
      queryClient.setQueryData(qk.clientForm(saved._id), { form: saved });
      void queryClient.invalidateQueries({ queryKey: qk.clientForms(clientId as string) });
      setBaseUpdatedAt(saved.updatedAt);
      rememberFormLocale(locale);
      notify(saved.status === 'SIGNED' ? 'Form signed and saved.' : 'Draft saved.', 'success');
      if (isNew) navigate(`/admin/clients/${clientId}/forms/${saved._id}`, { replace: true });
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setServerIssues(error.issues);
        notify(error.message, 'error');
      } else {
        notify('The form could not be saved. Please try again.', 'error');
      }
      return false;
    }
  };

  const appointments = useMemo(
    () => (clientQuery.data?.appointments ?? []).filter((appointment) => LINKABLE.has(appointment.status)),
    [clientQuery.data?.appointments],
  );

  if (clientQuery.isPending || formsQuery.isPending || (!isNew && recordQuery.isPending)) {
    return <LoadingState />;
  }
  if (clientQuery.isError) return <ErrorState error={clientQuery.error} onRetry={() => void clientQuery.refetch()} />;
  if (formsQuery.isError) return <ErrorState error={formsQuery.error} onRetry={() => void formsQuery.refetch()} />;
  if (recordQuery.isError) return <ErrorState error={recordQuery.error} onRetry={() => void recordQuery.refetch()} />;

  const client = clientQuery.data.client;
  const forms = formsQuery.data.forms;

  if (!form) return <EmptyState title="That form does not exist" />;
  // A form reached under another client's address is shown under its own.
  if (record && record.client !== client._id) {
    return <Navigate to={`/admin/clients/${record.client}/forms/${record._id}`} replace />;
  }

  const editing = isNew ? can('CLIENTS', 'CREATE') : record?.status === 'DRAFT' && can('CLIENTS', 'EDIT');
  if (isNew && !editing) {
    return <EmptyState title="You cannot start forms" message="Ask the owner for permission to add to client records." />;
  }

  const currentHealthForm = forms.find(
    (candidate) => candidate.type === 'HEALTH_INTAKE' && candidate.status === 'SIGNED',
  );
  const healthDraft = forms.find(
    (candidate) => candidate.type === 'HEALTH_INTAKE' && candidate.status === 'DRAFT',
  );
  // One health form update at a time: a second would leave two drafts
  // disagreeing about the same client.
  if (isNew && form.type === 'HEALTH_INTAKE' && healthDraft) {
    return <Navigate to={`/admin/clients/${client._id}/forms/${healthDraft._id}`} replace />;
  }
  // A signed health form that a later signed version has replaced.
  const isOutdatedVersion =
    record?.type === 'HEALTH_INTAKE' &&
    record.status === 'SIGNED' &&
    currentHealthForm !== undefined &&
    currentHealthForm._id !== record._id;
  const linkedFromUrl = appointments.find((appointment) => appointment._id === searchParams.get('appointment'));

  return (
    <>
      <Seo title={`${form.title.en} — ${client.fullName} — Nurella Admin`} noIndex />

      <div className="nu-cform-toolbar nu-noprint">
        <Link to={`/admin/clients/${client._id}`} className="nu-eyebrow">
          ← {client.fullName}
        </Link>
        <div className="nu-cform-toolbar__actions">
          <LanguageToggle
            value={locale}
            onChange={(next) => {
              setLocale(next);
              if (editing) rememberFormLocale(next);
            }}
            label="Form language"
          />
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          )}
          {!editing &&
            record?.type === 'HEALTH_INTAKE' &&
            record.status === 'SIGNED' &&
            !isOutdatedVersion &&
            can('CLIENTS', 'CREATE') && (
              <ButtonLink to={`/admin/clients/${client._id}/forms/new/health`} size="sm">
                {healthDraft ? 'Continue update' : 'Update — new version'}
              </ButtonLink>
            )}
          {record?.status === 'DRAFT' && can('CLIENTS', 'DELETE') && (
            <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>
              Discard draft
            </Button>
          )}
        </div>
      </div>

      {isOutdatedVersion && currentHealthForm && (
        <div className="nu-notice nu-notice--warn nu-noprint nu-cform-notice" role="status">
          <p>
            This is an earlier version of the health form.{' '}
            <Link className="nu-link" to={`/admin/clients/${client._id}/forms/${currentHealthForm._id}`}>
              Open the current version
            </Link>
          </p>
        </div>
      )}

      {record && !editing && record.locale !== locale && (
        <p className="nu-hint nu-noprint nu-cform-notice">
          Filled in {LOCALE_NAMES[record.locale]}. Questions are shown in {LOCALE_NAMES[locale]}; answers
          appear as they were written.
        </p>
      )}

      {/* The provider sees the client's allergies and conditions right where
          they confirm "health history reviewed". */}
      {form.type === 'SESSION_RECORD' && editing && (
        <div className="nu-noprint nu-cform-notice">
          <HealthAlerts clientId={client._id} forms={forms} showClear />
        </div>
      )}

      {editing ? (
        <FormEditor
          // A fresh editor once a new form has been created and has an id.
          key={record?._id ?? 'new'}
          form={form}
          locale={locale}
          clientName={record?.clientName ?? client.fullName}
          initialAnswers={
            record?.answers ?? startingAnswers(form, client, forms, user?.fullName, linkedFromUrl)
          }
          initialAppointmentId={record?.appointment ?? linkedFromUrl?._id}
          appointments={appointments}
          serviceNames={(servicesData?.services ?? []).map((service) => service.name)}
          saving={save.isPending}
          serverIssues={serverIssues}
          onSave={handleSave}
        />
      ) : (
        record && (
          <FormView
            form={form}
            record={record}
            locale={locale}
            appointment={clientQuery.data.appointments.find((appointment) => appointment._id === record.appointment)}
          />
        )
      )}

      <ConfirmDialog
        open={discardOpen}
        title="Discard this draft?"
        description="Everything filled in on this draft will be deleted. Signed forms are not affected."
        confirmLabel="Discard draft"
        confirmVariant="danger"
        loading={discard.isPending}
        onConfirm={() => discard.mutate()}
        onClose={() => setDiscardOpen(false)}
      />
    </>
  );
}

export default AdminClientFormPage;
