import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ImageField } from '@/components/admin/ImageField';
import { VideoField } from '@/components/admin/VideoField';
import { BRAND, instagramUrl } from '@/content/brand';
import { qk, useInstagramReels } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import { mediaSrc } from '@/utils/media';
import type { InstagramReel } from '@/types/api';

interface FormState {
  permalink: string;
  caption: string;
  coverImageUrl: string;
  altText: string;
  videoUrl: string;
  postedAt: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  permalink: '',
  caption: '',
  coverImageUrl: '',
  altText: '',
  videoUrl: '',
  postedAt: '',
  displayOrder: '0',
  isActive: true,
};

export function AdminInstagramPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [editing, setEditing] = useState<InstagramReel | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isPending, isError, error, refetch } = useInstagramReels('admin');

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
    // Both scopes: the public rail reads its own cached copy.
    void queryClient.invalidateQueries({ queryKey: qk.reels('admin') });
    void queryClient.invalidateQueries({ queryKey: qk.reels('public') });
  };

  const payload = () => ({
    permalink: form.permalink.trim(),
    coverImageUrl: form.coverImageUrl.trim(),
    altText: form.altText.trim(),
    displayOrder: Number(form.displayOrder) || 0,
    isActive: form.isActive,
    caption: form.caption.trim(),
    // Always sent, empty included: an empty string is how the server is told to
    // drop a video and send the reel back to Instagram's embed.
    videoUrl: form.videoUrl.trim(),
    ...(form.postedAt ? { postedAt: form.postedAt } : {}),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createReel(payload()),
    onSuccess: afterSave('Reel added.'),
    onError,
  });

  const update = useMutation({
    mutationFn: () => adminApi.updateReel(editing!._id, payload()),
    onSuccess: afterSave('Reel updated.'),
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteReel(id),
    onSuccess: afterSave('Reel removed.'),
    onError,
  });

  const openEdit = (reel: InstagramReel) => {
    setForm({
      permalink: reel.permalink,
      caption: reel.caption ?? '',
      coverImageUrl: reel.coverImageUrl,
      altText: reel.altText,
      videoUrl: reel.videoUrl ?? '',
      // `<input type="date">` wants yyyy-mm-dd, not an ISO timestamp.
      postedAt: reel.postedAt ? reel.postedAt.slice(0, 10) : '',
      displayOrder: String(reel.displayOrder),
      isActive: reel.isActive,
    });
    setEditing(reel);
  };

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const complete = form.permalink.trim() && form.coverImageUrl.trim() && form.altText.trim();

  return (
    <>
      <Seo title="Instagram — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Instagram reels</h1>
          <p className="nu-admin-head__sub">{data.reels.length} featured</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setCreating(true);
          }}
        >
          Feature a reel
        </Button>
      </div>

      <div className="nu-notice" style={{ marginBottom: 'var(--nu-space-5)' }}>
        These reels appear on the home page. Paste a reel's address from{' '}
        <a href={instagramUrl} target="_blank" rel="noreferrer noopener" className="nu-link">
          @{BRAND.instagramHandle}
        </a>{' '}
        and add a cover image. Upload the video too and it plays on the website itself — without
        one, visitors get Instagram's embedded player instead, which is slower and needs their
        cookies.
      </div>

      {data.reels.length === 0 ? (
        <EmptyState
          title="No reels featured yet"
          message="The Instagram section stays hidden on the home page until you add one."
        />
      ) : (
        <div className="nu-reel-admin-grid">
          {data.reels.map((reel) => (
            <figure key={reel._id} className="nu-card nu-card--flush">
              <div className="nu-reel-admin__preview">
                <img src={mediaSrc(reel.coverImageUrl)} alt={reel.altText} loading="lazy" />
              </div>
              <figcaption style={{ padding: 'var(--nu-space-4)' }}>
                <p style={{ fontWeight: 500, wordBreak: 'break-all' }}>{reel.shortcode}</p>
                <p className="nu-hint">
                  {reel.isActive ? 'Visible' : 'Hidden'} · order {reel.displayOrder} ·{' '}
                  {reel.videoUrl ? 'Plays on site' : 'Instagram embed'}
                </p>
                <div
                  className="nu-row"
                  style={{ marginTop: 'var(--nu-space-3)', gap: 'var(--nu-space-2)', flexWrap: 'wrap' }}
                >
                  <Button size="sm" variant="outline" onClick={() => openEdit(reel)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteId(reel._id)}>
                    Remove
                  </Button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Dialog
        open={creating || Boolean(editing)}
        onClose={close}
        title={editing ? 'Edit reel' : 'Feature a reel'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              disabled={!complete}
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {editing ? 'Save changes' : 'Feature reel'}
            </Button>
          </>
        }
      >
        <div className="nu-stack">
          <TextField
            label="Reel address"
            value={form.permalink}
            placeholder="https://www.instagram.com/reel/…"
            hint="Open the reel on Instagram, tap Share, then Copy link."
            onChange={(event) => setForm({ ...form, permalink: event.target.value })}
          />
          <ImageField
            label="Cover image"
            value={form.coverImageUrl}
            onChange={(url) => setForm({ ...form, coverImageUrl: url })}
            hint="The frame shown before the reel plays. A portrait (9:16) still works best."
          />
          <VideoField
            label="Video (optional)"
            value={form.videoUrl}
            onChange={(url) => setForm({ ...form, videoUrl: url })}
            hint="Upload the reel's MP4 to play it on the website. Leave empty to use Instagram's embedded player."
          />
          <TextField
            label="Alt text"
            value={form.altText}
            hint="Describes the reel for screen readers and search engines."
            onChange={(event) => setForm({ ...form, altText: event.target.value })}
          />
          <TextAreaField
            label="Caption (optional)"
            value={form.caption}
            maxLength={600}
            onChange={(event) => setForm({ ...form, caption: event.target.value })}
          />
          <TextField
            label="Posted on (optional)"
            type="date"
            value={form.postedAt}
            onChange={(event) => setForm({ ...form, postedAt: event.target.value })}
          />
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
        title="Remove this reel?"
        description="It stops appearing on the home page. The post itself stays on Instagram."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </>
  );
}

export default AdminInstagramPage;
