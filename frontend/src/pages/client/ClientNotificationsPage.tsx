import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api/booking.api';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/components/ui/Seo';
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States';
import { qk, useNotifications } from '@/hooks/queries';
import { relativeTime } from '@/utils/format';

export function ClientNotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useNotifications();

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.notifications }),
  });

  const notifications = data?.notifications ?? [];

  return (
    <>
      <Seo title="Updates — Nurella" noIndex />

      <div className="nu-row nu-row--between nu-row--wrap nu-page-head">
        <h1 className="nu-page-head__title">Updates</h1>
        {(data?.unreadCount ?? 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Mark all as read
          </Button>
        )}
      </div>

      {isPending && <SkeletonList rows={4} height={72} />}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && notifications.length === 0 && (
        <EmptyState
          title="No updates yet"
          message="We will let you know when your booking status changes."
        />
      )}

      <div className="nu-stack" style={{ gap: 'var(--nu-space-2)' }}>
        {notifications.map((notification) => {
          const body = (
            <>
              <p className="nu-notification__title">{notification.title}</p>
              <p className="nu-notification__body">{notification.body}</p>
              <p className="nu-hint" style={{ marginTop: 'var(--nu-space-2)' }}>
                {relativeTime(notification.createdAt)}
              </p>
            </>
          );
          const className = `nu-notification${notification.readAt ? '' : ' is-unread'}`;

          // Notifications tied to an appointment deep-link into it and mark
          // themselves read on the way.
          return notification.appointment ? (
            <Link
              key={notification._id}
              to={`/app/appointments/${notification.appointment}`}
              className={className}
              onClick={() => {
                if (!notification.readAt) markRead.mutate(notification._id);
              }}
            >
              {body}
            </Link>
          ) : (
            <div key={notification._id} className={className}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default ClientNotificationsPage;
