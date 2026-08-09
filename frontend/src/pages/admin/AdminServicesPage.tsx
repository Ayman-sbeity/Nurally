import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Seo } from '@/components/ui/Seo';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { CATEGORY_ORDER } from '@/content/brand';
import { useServices } from '@/hooks/queries';
import { useToast } from '@/context/ToastContext';
import type { Service, ServiceCategorySlug } from '@/types/api';
import { formatDuration } from '@/utils/format';

interface FormState {
  name: string;
  category: ServiceCategorySlug;
  description: string;
  durationMinutes: string;
  price: string;
  currency: string;
  imageUrl: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: '',
  category: 'facial-aesthetics',
  description: '',
  durationMinutes: '60',
  price: '',
  currency: '',
  imageUrl: '',
  displayOrder: '0',
  isActive: true,
};

export function AdminServicesPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isPending, isError, error, refetch } = useServices({ includeInactive: true });

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const afterSave = (message: string) => () => {
    close();
    notify(message, 'success');
    void queryClient.invalidateQueries({ queryKey: ['services'] });
  };

  const onError = (mutationError: unknown) =>
    notify(
      mutationError instanceof ApiRequestError ? mutationError.message : 'That did not work.',
      'error',
    );

  /** Empty optional fields are omitted rather than sent as blanks. */
  const payloadFrom = (values: FormState) => ({
    name: values.name.trim(),
    category: values.category,
    durationMinutes: Number(values.durationMinutes),
    displayOrder: Number(values.displayOrder) || 0,
    isActive: values.isActive,
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(values.price.trim() ? { price: Number(values.price) } : {}),
    ...(values.currency.trim() ? { currency: values.currency.trim() } : {}),
    ...(values.imageUrl.trim() ? { imageUrl: values.imageUrl.trim() } : {}),
  });

  const create = useMutation({
    mutationFn: () => adminApi.createService(payloadFrom(form)),
    onSuccess: afterSave('Service created.'),
    onError,
  });

  const update = useMutation({
    mutationFn: () => adminApi.updateService(editing!._id, payloadFrom(form)),
    onSuccess: afterSave('Service updated.'),
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (service: Service) =>
      adminApi.updateService(service._id, { isActive: !service.isActive }),
    onSuccess: afterSave('Service updated.'),
    onError,
  });

  const openEdit = (service: Service) => {
    setForm({
      name: service.name,
      category: service.category,
      description: service.description ?? '',
      durationMinutes: String(service.durationMinutes),
      price: service.price === undefined ? '' : String(service.price),
      currency: service.currency ?? '',
      imageUrl: service.imageUrl ?? '',
      displayOrder: String(service.displayOrder),
      isActive: service.isActive,
    });
    setEditing(service);
  };

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const dialogOpen = creating || Boolean(editing);

  return (
    <>
      <Seo title="Services — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <div>
          <h1 className="nu-admin-head__title">Services</h1>
          <p className="nu-admin-head__sub">
            {data.services.length} treatments · only active services can be booked
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setCreating(true);
          }}
        >
          New service
        </Button>
      </div>

      <div className="nu-notice" style={{ marginBottom: 'var(--nu-space-5)' }}>
        Durations were seeded with a placeholder value. Set the real duration for each treatment —
        the booking engine uses it to work out available slots.
      </div>

      {data.categories.map((category) => (
        <section key={category.slug} className="nu-panel" style={{ marginBottom: 'var(--nu-space-5)' }}>
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">{category.label}</h2>
            <span className="nu-hint">{category.services.length}</span>
          </div>
          <div className="nu-table-wrap" style={{ border: 0, borderRadius: 0 }}>
            <table className="nu-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Price</th>
                  <th scope="col">Order</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="nu-sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {category.services.map((service) => (
                  <tr key={service._id}>
                    <td>{service.name}</td>
                    <td>{formatDuration(service.durationMinutes)}</td>
                    <td>{service.price === undefined ? '—' : `${service.currency ?? ''} ${service.price}`}</td>
                    <td>{service.displayOrder}</td>
                    <td>
                      <span className="nu-badge nu-badge--plain">
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="nu-row" style={{ gap: 'var(--nu-space-2)' }}>
                        <Button size="sm" variant="outline" onClick={() => openEdit(service)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleActive.mutate(service)}
                        >
                          {service.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <Dialog
        open={dialogOpen}
        onClose={close}
        title={editing ? 'Edit service' : 'New service'}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              loading={create.isPending || update.isPending}
              disabled={!form.name.trim() || !form.durationMinutes}
              onClick={() => (editing ? update.mutate() : create.mutate())}
            >
              {editing ? 'Save changes' : 'Create service'}
            </Button>
          </>
        }
      >
        <div className="nu-stack">
          <TextField
            label="Name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value as ServiceCategorySlug })
            }
          >
            {CATEGORY_ORDER.map((slug) => (
              <option key={slug} value={slug}>
                {data.categories.find((entry) => entry.slug === slug)?.label ?? slug}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label="Description"
            value={form.description}
            maxLength={1200}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            min={5}
            max={600}
            step={5}
            value={form.durationMinutes}
            onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })}
          />
          <TextField
            label="Price (optional)"
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            hint="Leave empty to hide pricing on the website."
            onChange={(event) => setForm({ ...form, price: event.target.value })}
          />
          <TextField
            label="Currency (optional)"
            value={form.currency}
            onChange={(event) => setForm({ ...form, currency: event.target.value })}
          />
          <TextField
            label="Image URL (optional)"
            value={form.imageUrl}
            onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
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
            <span>Active — available for booking</span>
          </label>
        </div>
      </Dialog>
    </>
  );
}

export default AdminServicesPage;
