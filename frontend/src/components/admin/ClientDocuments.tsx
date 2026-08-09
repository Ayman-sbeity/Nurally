import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useClientDocuments } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { formatShortDateTime } from '@/utils/format';
import type { ClientAsset } from '@/types/api';

interface Props {
  clientId: string;
}

/** Bytes → a size a human reads at a glance. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocuments({ clientId }: Props) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { data, isPending } = useClientDocuments(clientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientAsset | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'client', clientId, 'documents'] });

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadDocument(clientId, file),
    onSuccess: () => {
      notify('File added.', 'success');
      void invalidate();
    },
    onError: (error) =>
      notify(error instanceof ApiRequestError ? error.message : 'That file could not be uploaded.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => adminApi.deleteAsset(assetId),
    onSuccess: () => {
      notify('File deleted.', 'success');
      setPendingDelete(null);
      void invalidate();
    },
    onError: () => notify('We could not delete that file.', 'error'),
  });

  /**
   * Downloads through the API client so the request carries the access token,
   * then hands the blob to a temporary link. A plain href would 401.
   */
  const download = async (asset: ClientAsset) => {
    try {
      const blob = await adminApi.fetchAssetBlob(asset._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('We could not open that file.', 'error');
    }
  };

  const documents = data?.documents ?? [];

  return (
    <section className="nu-panel" style={{ marginTop: 'var(--nu-space-6)' }}>
      <header className="nu-panel__head">
        <h2 className="nu-panel__title">Files</h2>
        <Button size="sm" variant="outline" loading={upload.isPending} onClick={() => inputRef.current?.click()}>
          Upload file
        </Button>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) upload.mutate(file);
        }}
      />

      <div className="nu-panel__body">
        {isPending && <p className="nu-hint">Loading files…</p>}

        {!isPending && documents.length === 0 && (
          <EmptyState
            title="No files yet"
            message="Consent forms, patch-test records or scans — PDF, JPEG, PNG and WebP up to 15 MB."
          />
        )}

        {documents.length > 0 && (
          <ul className="nu-filelist">
            {documents.map((doc) => (
              <li key={doc._id} className="nu-filelist__row">
                <div className="nu-filelist__main">
                  <button type="button" className="nu-filelist__name" onClick={() => void download(doc)}>
                    {doc.originalName}
                  </button>
                  <p className="nu-filelist__meta">
                    {humanSize(doc.sizeBytes)} · {formatShortDateTime(doc.createdAt)}
                    {doc.caption ? ` · ${doc.caption}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete(doc)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this file?"
        description={`“${pendingDelete?.originalName ?? ''}” will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete file"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete._id)}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
