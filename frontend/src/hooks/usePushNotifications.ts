import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pushApi } from '@/api/booking.api';
import { useAuth } from '@/context/AuthContext';

/**
 * WEB PUSH SUBSCRIPTION
 * ---------------------
 * Turns a browser into a device the server can reach when the app is closed.
 *
 * Platform notes that shape this hook:
 *  - iOS only supports Web Push in an **installed** PWA (Add to Home Screen).
 *    In Safari's normal tab `PushManager` is absent, so `isSupported` is false
 *    and the UI must say why rather than showing a switch that cannot work.
 *  - The permission prompt has one chance: once denied, it can only be undone
 *    in browser settings, so it is never requested on page load — only from a
 *    deliberate tap.
 *  - The service worker is only built for production, so this is inert in
 *    `npm run dev` (see `devOptions` in vite.config.ts).
 */

/** VAPID keys travel as base64url; `applicationServerKey` wants raw bytes. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalised = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);

  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
}

const isSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export type PushStatus =
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'enabled'
  | 'disabled'
  | 'loading';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    isSupported ? Notification.permission : 'denied',
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: config, isPending: configPending } = useQuery({
    queryKey: ['push-config'],
    queryFn: () => pushApi.config(),
    enabled: isSupported && Boolean(user),
    staleTime: 5 * 60_000,
  });

  const publicKey = config?.publicKey ?? null;

  /**
   * Reads the live subscription and re-registers it with the server.
   *
   * The re-register is the point: a browser may rotate an endpoint on its own
   * (`pushsubscriptionchange`), which the service worker cannot report because
   * it holds no access token. Re-sending on each authenticated load repairs
   * that, and the server upserts by endpoint so it costs nothing when unchanged.
   */
  useEffect(() => {
    if (!isSupported || !user || !config?.enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;

        setSubscribed(Boolean(subscription));
        if (subscription && Notification.permission === 'granted') {
          await pushApi.subscribe(subscription.toJSON());
        }
      } catch {
        if (!cancelled) setSubscribed(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, config?.enabled]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !publicKey) return false;
    setBusy(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setError(
          result === 'denied'
            ? 'Notifications are blocked for this site. Allow them in your browser settings, then try again.'
            : 'Notification permission was not granted.',
        );
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      // An existing subscription may have been minted from a previous VAPID
      // key, which the push service would reject. Replacing it is cheaper than
      // discovering that at the first real booking.
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that shows no notification is
        // not permitted, and this app always shows one.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      });

      await pushApi.subscribe(subscription.toJSON());
      setSubscribed(true);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'This device could not be registered for notifications.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [publicKey]);

  const disable = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setBusy(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Server first: if the browser-side unsubscribe succeeded but the API
        // call failed, we would keep pushing to a dead endpoint until it 410s.
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not turn notifications off.');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async (): Promise<string> => {
    const { message } = await pushApi.sendTest();
    return message;
  }, []);

  const status: PushStatus = !isSupported
    ? 'unsupported'
    : configPending || subscribed === null
      ? 'loading'
      : !config?.enabled
        ? 'unconfigured'
        : permission === 'denied'
          ? 'denied'
          : subscribed
            ? 'enabled'
            : 'disabled';

  return {
    status,
    isSupported,
    /** True on iOS outside an installed PWA, where push cannot work at all. */
    needsInstall:
      !isSupported &&
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !window.matchMedia('(display-mode: standalone)').matches,
    deviceCount: config?.devices ?? 0,
    busy,
    error,
    enable,
    disable,
    sendTest,
  };
}
