/* eslint-disable no-undef */
/**
 * PUSH HANDLERS
 * -------------
 * Imported into the Workbox-generated service worker (see `workbox.importScripts`
 * in vite.config.ts). It lives here, hand-written, rather than in a full custom
 * service worker so the precache and runtime-caching rules stay generated —
 * push is the only behaviour that needs adding.
 *
 * Runs with no access to the app's memory: everything it needs arrives in the
 * pushed payload.
 */

const ICON = '/icons/icon-192.png';

self.addEventListener('push', (event) => {
  // A push with no data, or one this version does not understand, must still
  // show something — a silent push burns the permission and, on some browsers,
  // counts against the "must show a notification" rule.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Nurella Beauty Lounge';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: ICON,
    badge: ICON,
    // Same tag = the newer notification replaces the older one for that
    // appointment instead of stacking.
    tag: payload.tag || 'nurella',
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/app' },
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/app',
    self.location.origin,
  ).href;

  // Prefer an already-open window: reusing the installed app's own window is
  // what makes a tapped notification feel like the app, not a fresh browser.
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          return client.focus().then((focused) => {
            if (focused && 'navigate' in focused) return focused.navigate(target);
            return focused;
          });
        }
        return self.clients.openWindow(target);
      }),
  );
});
