import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { StaffDialog } from '@/components/admin/StaffDialog';
import { summarisePermissions } from '@/components/admin/PermissionGrid';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import type { StaffMember } from '@/types/api';
import { relativeTime } from '@/utils/format';

/**
 * The team and what each member may reach.
 *
 * Owner-only — the server refuses these routes for anyone else. Delegating this
 * page would defeat the whole permission system, since an employee who can edit
 * staff can grant themselves every other section.
 */
export function AdminStaffPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { user } = useAuth();

  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: () => staffApi.list(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'staff'] });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      staffApi.update(id, { isActive }),
    onSuccess: ({ message }) => {
      notify(message, 'success');
      void invalidate();
    },
    onError: (cause) =>
      notify(
        cause instanceof ApiRequestError ? cause.message : 'That change could not be saved.',
        'error',
      ),
  });

  const remove = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: ({ message }) => {
      notify(message, 'success');
      setRemoving(null);
      void invalidate();
    },
    onError: (cause) =>
      notify(
        cause instanceof ApiRequestError ? cause.message : 'That team member could not be removed.',
        'error',
      ),
  });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { staff, permissionSchema } = data;

  return (
    <>
      <Seo title="Staff — Nurella Admin" noIndex />

      <div className="nu-admin-head">
        <h1 className="nu-admin-head__title">Staff</h1>
        <Button onClick={() => setCreating(true)}>Add team member</Button>
      </div>

      <div className="nu-detail" style={{ display: 'block' }}>
        <section className="nu-panel">
          <div className="nu-panel__head">
            <h2 className="nu-panel__title">Team</h2>
          </div>
          <div className="nu-panel__body">
            <p className="nu-hint" style={{ marginBottom: 'var(--nu-space-4)' }}>
              Employees sign in with their phone number and see only the sections you grant. Your
              own account always has full access and cannot be limited or deactivated.
            </p>

            {staff.length === 0 && (
              <EmptyState
                title="No team members yet"
                message="Add an employee to give them their own sign-in."
              />
            )}

            {staff.map((member) => {
              const isSelf = member._id === user?._id;
              const isOwnerAccount = member.role === 'ADMIN';

              return (
                <div key={member._id} className="nu-staff-row">
                  <div>
                    <p style={{ fontWeight: 500 }}>
                      {member.fullName}
                      {isOwnerAccount && <span className="nu-hint"> · Owner</span>}
                      {!member.isActive && <span className="nu-hint"> · Deactivated</span>}
                    </p>
                    <p className="nu-hint">
                      {/* Phone leads: it is what they sign in with. */}
                      {[member.jobTitle, member.phone, member.email].filter(Boolean).join(' · ')}
                    </p>
                    <p className="nu-hint">
                      {isOwnerAccount
                        ? 'Full access to everything'
                        : summarisePermissions(member.staffPermissions)}
                    </p>
                    <p className="nu-hint">
                      {member.lastLoginAt
                        ? `Last signed in ${relativeTime(member.lastLoginAt)}`
                        : 'Has not signed in yet'}
                    </p>
                  </div>

                  {/* The owner account is not editable from here: its access is
                      fixed, and it must stay able to sign in. */}
                  {!isOwnerAccount && (
                    <div className="nu-staff-row__actions">
                      <Button variant="outline" size="sm" onClick={() => setEditing(member)}>
                        Edit access
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf}
                        loading={setActive.isPending && setActive.variables?.id === member._id}
                        onClick={() =>
                          setActive.mutate({ id: member._id, isActive: !member.isActive })
                        }
                      >
                        {member.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => setRemoving(member)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {creating && (
        <StaffDialog
          schema={permissionSchema}
          onClose={() => setCreating(false)}
          onSaved={() => void invalidate()}
        />
      )}

      {editing && (
        <StaffDialog
          schema={permissionSchema}
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void invalidate()}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.fullName ?? 'this team member'}?`}
        description="Their sign-in stops working immediately. Appointments they handled keep their name in the history."
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing._id)}
      />
    </>
  );
}

export default AdminStaffPage;
