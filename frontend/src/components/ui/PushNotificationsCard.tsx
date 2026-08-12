import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationsCardProps {
  /** Wording differs: the lounge is told about bookings, clients about their own. */
  audience: 'admin' | 'client';
}

/**
 * The on/off switch for device notifications, shown to both sides of the app.
 *
 * Each state explains itself rather than presenting a dead control — a blocked
 * permission or an uninstalled iOS PWA cannot be fixed from this page, and
 * saying so is more use than a switch that silently does nothing.
 */
export function PushNotificationsCard({ audience }: PushNotificationsCardProps) {
  const { notify } = useToast();
  const { status, needsInstall, deviceCount, busy, error, enable, disable, sendTest } =
    usePushNotifications();
  const [testing, setTesting] = useState(false);

  const blurb =
    audience === 'admin'
      ? 'Get an alert on this device the moment a client requests an appointment, even when the app is closed.'
      : 'Get an alert on this device when the lounge confirms, moves, or updates your appointment.';

  const handleEnable = async () => {
    if (await enable()) {
      notify('Notifications are on for this device.', 'success');
    }
  };

  const handleDisable = async () => {
    await disable();
    notify('Notifications are off for this device.');
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      notify(await sendTest(), 'success');
    } catch {
      notify('The test notification could not be sent.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const isAdmin = audience === 'admin';

  const body = (
    <>
      <p className="nu-hint" style={{ marginBottom: 'var(--nu-space-4)' }}>
        {blurb}
      </p>

      {status === 'loading' && <p className="nu-hint">Checking this device…</p>}

      {status === 'unsupported' && (
        <div className="nu-notice">
          <div>
            <p style={{ fontWeight: 500 }}>Not available in this browser</p>
            <p>
              {needsInstall
                ? 'On iPhone and iPad, notifications work once the app is added to your Home Screen. Tap Share, then “Add to Home Screen”, and open it from there.'
                : 'This browser does not support push notifications. Try Chrome, Edge, Firefox, or Safari 16.4 and later.'}
            </p>
          </div>
        </div>
      )}

      {status === 'unconfigured' && (
        <div className="nu-notice nu-notice--warn">
          <div>
            <p style={{ fontWeight: 500 }}>Not configured on the server</p>
            <p>
              {isAdmin
                ? 'Push keys have not been set up yet. Run `npm run push:keys` in the backend, add the pair to .env, and restart the server.'
                : 'Notifications are not switched on for this site yet. You will still see every update here in the app.'}
            </p>
          </div>
        </div>
      )}

      {status === 'denied' && (
        <div className="nu-notice nu-notice--warn">
          <div>
            <p style={{ fontWeight: 500 }}>Blocked in your browser</p>
            <p>
              Notifications are blocked for this site, so we cannot ask again from here. Allow
              them in your browser's site settings, then reload this page.
            </p>
          </div>
        </div>
      )}

      {status === 'disabled' && (
        <Button onClick={() => void handleEnable()} loading={busy}>
          Turn on notifications
        </Button>
      )}

      {status === 'enabled' && (
        <div className="nu-stack" style={{ gap: 'var(--nu-space-3)' }}>
          <p className="nu-row" style={{ gap: 'var(--nu-space-2)', fontWeight: 500 }}>
            <span aria-hidden="true">✓</span>
            <span>
              On for this device
              {deviceCount > 1 && ` — ${deviceCount} devices registered`}
            </span>
          </p>
          <div className="nu-row nu-row--wrap" style={{ gap: 'var(--nu-space-2)' }}>
            <Button variant="outline" size="sm" onClick={() => void handleTest()} loading={testing}>
              Send a test
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void handleDisable()} loading={busy}>
              Turn off
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p
          className="nu-hint"
          style={{ marginTop: 'var(--nu-space-3)', color: 'var(--nu-danger)' }}
        >
          {error}
        </p>
      )}
    </>
  );

  // The two apps have their own card language — panels in the admin, cards in
  // the client app — so the control looks native wherever it is dropped in.
  return isAdmin ? (
    <section className="nu-panel">
      <div className="nu-panel__head">
        <h2 className="nu-panel__title">Push notifications</h2>
      </div>
      <div className="nu-panel__body">{body}</div>
    </section>
  ) : (
    <section className="nu-card">
      <h2 className="nu-label" style={{ marginBottom: 'var(--nu-space-3)' }}>
        Notifications
      </h2>
      {body}
    </section>
  );
}
