import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { CATEGORY_ORDER } from '@/content/brand';
import { useGallery, useServices } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import type { GalleryImage, ServiceCategorySlug } from '@/types/api';

interface FormState {
  title: string;
  caption: string;
  imageUrl: string;
  beforeImageUrl: string;
  altText: string;
  category: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  title: '',
  caption: '',
  imageUrl: '',
  beforeImageUrl: '',
  altText: '',
  category: '',
  displayOrder: '0',
  isActive: true,
};

export function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { can } = usePermissions();
  const [editing, setEditing] = useState<GalleryImage | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isPending, isError, error, refetch } = useGallery();
  const { data: catalogue } = useServices();

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const onError = (mutationError: unknown) =>
    notify(
      mutationError instanceof ApiRequestError ? mutationError.message : 'That did not work.',
      'error',
    );

  const afterSave = (message: string) => () => {
    close();
    setDeleteId(null);
    notify(message, 'success');
    void queryClient.invalidateQueries({ queryKey: ['gallery'] });
  };

  const payload = () => ({
    title: form.title.trim(),
    imageUrl: form.imageUrl.trim(),
    altText: form.altText.trim(),
    displayOrder: Number(form.displayOrder) || 0,
    isActive: form.isActive,
    ...(form.caption.trim() ? { caption: form.caption.trim() } : {}),
    ...(form.beforeImageUrl.trim() ? { beforeImageUrl: form.beforeImageUrl.trim() } : {}),
    ...(form.category ? { category: form.category as ServiceCategorySlug } : {}),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createGalleryImage(payload()),
    onSuccess: afterSave('Image added.'),
    onError,
  });

  const update = useMutation({
    mutationFn: () => adminApi.updateGalleryImage(editing!._id, payload()),
    onSuccess: afterSave('Image updated.'),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteGalleryImage(id),
    onSuccess: afterSave('Image removed.'),
    onError,
  });

  const openEdit = (image: GalleryImage) => {
    setForm({
      title: image.title,
      caption: image.caption ?? '',
      imageUrl: image.imageUrl,
      beforeImageUrl: image.beforeImageUrl ?? '',
      altText: image.altText,
      category: image.category ?? '',
      displayOrder: String(image.displayOrder),
      isActive: image.isActive,
    });
    setEditing(image);
  };

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <Seo title="Gallery — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Gallery</h1>
          <p className="nu-admin-head__sub">{data.images.length} images</p>
        </div>
        {can('GALLERY', 'CREATE') && (
          <Button
            onClick={() => {
              setForm(emptyForm);
              setCreating(true);
            }}
          >
            Add image
          </Button>
        )}
      </div>

      <div className="nu-notice" style={{ marginBottom: 'var(--nu-space-5)' }}>
        The images shipped with the project are placeholders. Point these entries at real Nurella
        photography — any URL your host serves will work.
      </div>

      {data.images.length === 0 ? (
        <EmptyState title="No gallery images yet" />
      ) : (
        <div className="nu-gallery-grid">
          {data.images.map((image) => (
            <figure key={image._id} className="nu-card nu-card--flush">
              <div style={{ aspectRatio: '3 / 4', background: 'var(--nu-sand)' }}>
                <img
                  src={image.imageUrl}
                  alt={image.altText}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <figcaption style={{ padding: 'var(--nu-space-4)' }}>
                <p style={{ fontWeight: 500 }}>{image.title}</p>
                <p className="nu-hint">
                  {image.isActive ? 'Visible' : 'Hidden'} · order {image.displayOrder}
                </p>
                <div className="nu-row" style={{ marginTop: 'var(--nu-space-3)', gap: 'var(--nu-space-2)' }}>
                  {can('GALLERY', 'EDIT') && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(image)}>
                      Edit
                    </Button>
                  )}
                  {can('GALLERY', 'DELETE') && (
                    <Button size="sm" variant="danger" onClick={() => setDeleteId(image._id)}>
                      Remove
                    </Button>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Dialog
        open={creating || Boolean(editing)}
        onClose={close}
        title={editing ? 'Edit image' : 'Add image'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              disabled={!form.title.trim() || !form.imageUrl.trim() || !form.altText.trim()}
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {editing ? 'Save changes' : 'Add image'}
            </Button>
          </>
        }
      >
        <div className="nu-stack">
          <TextField
            label="Title"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <TextField
            label="Image URL"
            value={form.imageUrl}
            onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
          />
          <TextField
            label="Alt text"
            value={form.altText}
            hint="Describes the image for screen readers and search engines."
            onChange={(event) => setForm({ ...form, altText: event.target.value })}
          />
          <TextAreaField
            label="Caption (optional)"
            value={form.caption}
            maxLength={400}
            onChange={(event) => setForm({ ...form, caption: event.target.value })}
          />
          <TextField
            label="Before image URL (optional)"
            value={form.beforeImageUrl}
            onChange={(event) => setForm({ ...form, beforeImageUrl: event.target.value })}
          />
          <SelectField
            label="Category (optional)"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            <option value="">No category</option>
            {CATEGORY_ORDER.map((slug) => (
              <option key={slug} value={slug}>
                {catalogue?.categories.find((entry) => entry.slug === slug)?.label ?? slug}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Display order"
            type="number"
            value={form.displayOrder}
            onChange={(event) => setForm({ ...form, displayOrder: event.target.value })}
          />
          <label className="nu-checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span>Visible on the website</span>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        title="Remove this image?"
        description="It is deleted from the gallery. This cannot be undone."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </>
  );
}

export default AdminGalleryPage;
