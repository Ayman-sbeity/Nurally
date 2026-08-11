import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The behaviour every modal layer owes the keyboard: focus moves in on open, is
 * trapped while open, and returns to whatever opened it on close. Escape
 * dismisses, and the page behind stops scrolling.
 *
 * Shared by the form dialog and the reel viewer. They look nothing alike — one
 * is a card of fields, the other a full-bleed video — but getting this part
 * subtly different between them is exactly how a modal ends up leaking focus to
 * the page underneath.
 *
 * Returns the ref to put on the panel element.
 */
export function useModalLayer<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panelRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /**
   * `onClose` is read through a ref rather than closed over.
   *
   * Callers pass an inline function, so its identity changes on every render.
   * If the effect below depended on it, the effect would re-run on every
   * render — and its first act is to move focus to the top of the panel. That
   * makes a form unusable: each keystroke re-renders the page, and focus jumps
   * out of the field being typed into and back to the first one. The effect
   * must run when the layer opens and closes, and at no other time.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusable?.[0] ?? panelRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Stops a nested layer from also closing its parent.
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableNow = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusableNow.length === 0) return;

      const first = focusableNow[0];
      const last = focusableNow[focusableNow.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  return panelRef;
}
