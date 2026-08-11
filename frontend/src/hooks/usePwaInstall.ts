import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'nurella:install-dismissed';

/** Apps whose in-app browser announces itself by name. */
const IN_APP_UA =
  /instagram|fban|fbav|fb_iab|linkedinapp|snapchat|twitter|micromessenger|bytedancewebview|musical_ly|\bline\//i;

/** Third-party iOS browsers, which have gained "Add to Home Screen" of their own. */
const IOS_BROWSER_UA = /crios|fxios|edgios|opt\//i;

/**
 * Most of the lounge's traffic arrives from the Instagram bio link, and an
 * in-app browser has no "Add to Home Screen" anywhere in its share sheet — the
 * Safari instructions are a dead end there. Those visitors have to reopen the
 * page in a real browser first.
 */
function isInAppBrowser(ua: string) {
  if (IN_APP_UA.test(ua)) return true;
  if (IOS_BROWSER_UA.test(ua)) return false;
  // Safari always advertises a `Version/` token; an embedded WKWebView does not.
  return !/version\/\d/i.test(ua);
}

/**
 * Wraps the install flow.
 *
 * Chromium fires `beforeinstallprompt`, which we hold onto so the app can offer
 * installation at a sensible moment instead of the browser's default. iOS
 * Safari has no such event, so `isIos` lets the UI show manual instructions.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true',
  );

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }, []);

  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const inAppBrowser = isIos && isInAppBrowser(ua);
  const canPitch = isIos && !isInstalled && !dismissed;

  return {
    /** True when the app can be installed right now via the browser prompt. */
    canInstall: Boolean(deferredPrompt) && !isInstalled && !dismissed,
    /** iOS needs the manual "Add to Home Screen" hint instead. */
    showIosHint: canPitch && !inAppBrowser,
    /** …unless the page is inside an app's browser, which cannot install at all. */
    showOpenInSafariHint: canPitch && inAppBrowser,
    isInstalled,
    promptInstall,
    dismiss,
  };
}
