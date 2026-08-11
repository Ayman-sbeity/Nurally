import { useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer } from '@/hooks/useModalLayer';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Accessible modal: focus moves in on open, is trapped while open, and returns
 * to the trigger on close. Escape and backdrop click both dismiss.
 */
export function Dialog({ open, onClose, title, description, children, footer }: DialogProps) {
  const panelRef = useModalLayer<HTMLDivElement>(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  return createPortal(
    <div
      className="nu-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="nu-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <h2 className="nu-dialog__title" id={titleId}>
          {title}
        </h2>
        {description && (
          <p className="nu-lede" id={descriptionId} style={{ fontSize: 'var(--nu-text-sm)' }}>
            {description}
          </p>
        )}
        {children && <div style={{ marginTop: 'var(--nu-space-5)' }}>{children}</div>}
        {footer && <div className="nu-dialog__actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
