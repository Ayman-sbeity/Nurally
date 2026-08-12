import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AuthImage } from '@/components/admin/AuthImage';
import { useClientPhotoSets } from '@/hooks/queries';
import { useServices } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { formatDate } from '@/utils/format';
import type { ClientAsset, ClientPhotoSet, PhotoPhase } from '@/types/api';

interface Props {
  clientId: string;
  clientName: string;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export function ClientPhotoSets({ clientId, clientName }: Props) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { can } = usePermissions();
  const { data, isPending } = useClientPhotoSets(clientId);
  const { data: servicesData } = useServices();

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ClientPhotoSet | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'client', clientId, 'photo-sets'] });

  const remove = useMutation({
    mutationFn: (setId: string) => adminApi.deletePhotoSet(setId),
    onSuccess: ({ deletedPhotos }) => {
      notify(`Record deleted with ${deletedPhotos} photo${deletedPhotos === 1 ? '' : 's'}.`, 'success');
      setPendingDelete(null);
      void invalidate();
    },
    onError: () => notify('We could not delete that record.', 'error'),
  });

  const sets = data?.photoSets ?? [];

  return (
    <section className="nu-panel" style={{ marginTop: 'var(--nu-space-6)' }}>
      <header className="nu-panel__head">
        <h2 className="nu-panel__title">Before &amp; after</h2>
        {can('CLIENTS', 'CREATE') && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            New record
          </Button>
        )}
      </header>

      <div className="nu-panel__body">
        {isPending && <p className="nu-hint">Loading photos…</p>}

        {!isPending && sets.length === 0 && (
          <EmptyState
            title="No before/after records yet"
            message="Create a record for a treatment, then add the before and after photographs to it."
          />
        )}

        <div className="nu-photoset-list">
          {sets.map((set) => (
            <PhotoSetCard
              key={set._id}
              set={set}
              clientId={clientId}
              clientName={clientName}
              onDeleted={() => setPendingDelete(set)}
              onChanged={invalidate}
            />
          ))}
        </div>
      </div>

      <CreatePhotoSetDialog
        open={createOpen}
        clientId={clientId}
        services={servicesData?.services ?? []}
        onClose={() => setCreateOpen(false)}
        onCreated={invalidate}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this record?"
        description={`“${pendingDelete?.title ?? ''}” and every photograph inside it will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete record"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete._id)}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}

// --- One treatment record ---------------------------------------------------

function PhotoSetCard({
  set,
  clientId,
  clientName,
  onDeleted,
  onChanged,
}: {
  set: ClientPhotoSet;
  clientId: string;
  clientName: string;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const { notify } = useToast();

  /**
   * Mirrored locally so the checkbox responds to the click immediately.
   * A purely controlled box would snap back to the server value until the
   * round-trip finished, which reads as "my click didn't register".
   */
  const [consented, setConsented] = useState(set.consentToPublish);
  useEffect(() => setConsented(set.consentToPublish), [set.consentToPublish]);

  const consent = useMutation({
    mutationFn: (next: boolean) => adminApi.updatePhotoSet(set._id, { consentToPublish: next }),
    onSuccess: ({ photoSet }) => {
      notify(
        photoSet.consentToPublish
          ? 'Marked as consented for publication.'
          : 'Publication consent withdrawn.',
        'success',
      );
      onChanged();
    },
    onError: () => {
      setConsented(set.consentToPublish);
      notify('We could not update consent.', 'error');
    },
  });

  const serviceName = typeof set.service === 'object' && set.service ? set.service.name : null;

  return (
    <article className="nu-photoset">
      <header className="nu-photoset__header">
        <div>
          <h3 className="nu-photoset__title">{set.title}</h3>
          <p className="nu-photoset__meta">
            {formatDate(set.takenAt)}
            {serviceName ? ` · ${serviceName}` : ''}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDeleted}>
          Delete
        </Button>
      </header>

      {set.notes && <p className="nu-photoset__notes">{set.notes}</p>}

      <div className="nu-photoset__grid">
        <PhaseColumn
          phase="BEFORE"
          label="Before"
          photos={set.before}
          clientId={clientId}
          setId={set._id}
          clientName={clientName}
          onChanged={onChanged}
        />
        <PhaseColumn
          phase="AFTER"
          label="After"
          photos={set.after}
          clientId={clientId}
          setId={set._id}
          clientName={clientName}
          onChanged={onChanged}
        />
      </div>

      {/*
        Consent is surfaced on the record itself rather than buried in a menu:
        whether these photographs may leave the client file is the one thing
        staff must be able to see at a glance.
      */}
      <footer className="nu-photoset__consent">
        <label className="nu-checkbox">
          <input
            type="checkbox"
            checked={consented}
            disabled={consent.isPending}
            onChange={(event) => {
              setConsented(event.target.checked);
              consent.mutate(event.target.checked);
            }}
          />
          <span>
            Client consented to these being published
            {set.consentRecordedAt ? ` — recorded ${formatDate(set.consentRecordedAt)}` : ''}
          </span>
        </label>
        {!consented && <p className="nu-hint">Internal use only until consent is recorded.</p>}
      </footer>
    </article>
  );
}

// --- Before / after column --------------------------------------------------

function PhaseColumn({
  phase,
  label,
  photos,
  clientId,
  setId,
  clientName,
  onChanged,
}: {
  phase: PhotoPhase;
  label: string;
  photos: ClientAsset[];
  clientId: string;
  setId: string;
  clientName: string;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadPhoto(clientId, setId, file, { phase }),
    onSuccess: () => {
      notify(`${label} photo added.`, 'success');
      onChanged();
    },
    onError: (error) =>
      notify(error instanceof ApiRequestError ? error.message : 'That photo could not be uploaded.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => adminApi.deleteAsset(assetId),
    onSuccess: () => {
      notify('Photo removed.', 'success');
      onChanged();
    },
    onError: () => notify('We could not remove that photo.', 'error'),
  });

  return (
    <div className="nu-phase">
      <div className="nu-phase__header">
        <span className="nu-eyebrow">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          Add
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset first so re-picking the same file still fires onChange.
          event.target.value = '';
          if (file) upload.mutate(file);
        }}
      />

      {photos.length === 0 ? (
        <div className="nu-phase__empty">No {label.toLowerCase()} photo</div>
      ) : (
        <ul className="nu-phase__photos">
          {photos.map((photo) => (
            <li key={photo._id} className="nu-phase__photo">
              <AuthImage assetId={photo._id} alt={`${label} — ${clientName}`} />
              <button
                type="button"
                className="nu-phase__remove"
                onClick={() => remove.mutate(photo._id)}
                aria-label={`Remove ${label.toLowerCase()} photo`}
              >
                ×
              </button>
              {photo.caption && <p className="nu-phase__caption">{photo.caption}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Create dialog ----------------------------------------------------------

function CreatePhotoSetDialog({
  open,
  clientId,
  services,
  onClose,
  onCreated,
}: {
  open: boolean;
  clientId: string;
  services: { _id: string; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { notify } = useToast();
  const [title, setTitle] = useState('');
  const [takenAt, setTakenAt] = useState(todayKey());
  const [serviceId, setServiceId] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setTitle('');
    setTakenAt(todayKey());
    setServiceId('');
    setNotes('');
  };

  const create = useMutation({
    mutationFn: () =>
      adminApi.createPhotoSet(clientId, {
        title: title.trim(),
        // Sent as a full instant so the server stores an unambiguous moment.
        takenAt: new Date(`${takenAt}T12:00:00`).toISOString(),
        ...(serviceId ? { serviceId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      notify('Record created — now add the photographs.', 'success');
      reset();
      onClose();
      onCreated();
    },
    onError: (error) =>
      notify(error instanceof ApiRequestError ? error.message : 'We could not create that record.', 'error'),
  });

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New before/after record"
      description="Group the photographs for one treatment so the date, service and consent are recorded once for the pair."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={title.trim().length < 2}>
            Create record
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--nu-space-4)' }}>
        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Laser course — session 1"
          required
        />
        <TextField
          label="Date taken"
          type="date"
          value={takenAt}
          onChange={(event) => setTakenAt(event.target.value)}
          required
        />
        <SelectField
          label="Treatment (optional)"
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
        >
          <option value="">Not linked to a treatment</option>
          {services.map((service) => (
            <option key={service._id} value={service._id}>
              {service.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          hint="Area treated, settings used, anything worth recalling next session."
        />
      </div>
    </Dialog>
  );
}
