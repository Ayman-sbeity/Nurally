import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Appointment } from '@/types/api';

export interface DragPoint {
  x: number;
  y: number;
}

export interface DropProposal {
  /** Where the appointment would start if it were released now. */
  start: Date;
  /** Set when the drop is not allowed — shown on the ghost and on release. */
  issue?: string | null;
}

export interface DragSession {
  appointment: Appointment;
  proposal: DropProposal | null;
  point: DragPoint;
}

interface Options {
  /** Turns a pointer position into a proposed new start time. */
  resolve: (
    point: DragPoint,
    context: { appointment: Appointment; grabMinutes: number },
  ) => DropProposal | null;
  /** A completed drop the rules allow. */
  onDrop: (appointment: Appointment, proposal: DropProposal) => void;
  /** A drop the rules rejected, so the reason can be surfaced. */
  onReject?: (appointment: Appointment, issue: string) => void;
  disabled?: boolean;
}

/** Movement, in px, before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/**
 * Pointer-driven dragging for calendar appointments.
 *
 * Mouse and pen only, deliberately: a touch drag has to claim the vertical
 * gesture from the page scroller, which makes a dense calendar unusable on a
 * phone. Touch users tap an appointment and move it from its panel — the same
 * path keyboard users take.
 */
export function useCalendarDrag({ resolve, onDrop, onReject, disabled }: Options) {
  const [session, setSession] = useState<DragSession | null>(null);

  // Listeners are bound once per drag and must see the current callbacks
  // rather than the ones captured when the drag began.
  const handlers = useRef({ resolve, onDrop, onReject });
  handlers.current = { resolve, onDrop, onReject };

  const cleanup = useRef<(() => void) | null>(null);
  const justDragged = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);

  const startDrag = useCallback(
    (event: ReactPointerEvent, appointment: Appointment, grabMinutes: number) => {
      if (disabled || event.pointerType === 'touch' || event.button !== 0) return;

      const origin = { x: event.clientX, y: event.clientY };
      const context = { appointment, grabMinutes };
      let moved = false;

      const finish = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', finish);
        window.removeEventListener('keydown', handleKey, true);
        document.body.classList.remove('is-dragging-appointment');
        cleanup.current = null;
        setSession(null);
      };

      function handleMove(moveEvent: PointerEvent) {
        if (!moved) {
          const travelled = Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
          if (travelled < DRAG_THRESHOLD) return;
          moved = true;
          document.body.classList.add('is-dragging-appointment');
        }
        moveEvent.preventDefault();
        const point = { x: moveEvent.clientX, y: moveEvent.clientY };
        setSession({ appointment, proposal: handlers.current.resolve(point, context), point });
      }

      function handleUp(upEvent: PointerEvent) {
        const proposal = moved
          ? handlers.current.resolve({ x: upEvent.clientX, y: upEvent.clientY }, context)
          : null;
        finish();
        if (!moved) return;

        // The click that follows this pointerup belongs to the drag, not to the
        // appointment — swallow it before the flag clears on the next tick.
        justDragged.current = true;
        window.setTimeout(() => {
          justDragged.current = false;
        }, 0);

        if (!proposal) return;
        if (proposal.issue) {
          handlers.current.onReject?.(appointment, proposal.issue);
          return;
        }
        if (proposal.start.getTime() === new Date(appointment.startAt).getTime()) return;
        handlers.current.onDrop(appointment, proposal);
      }

      // Escape abandons the move, as it does for every other dismissable UI.
      function handleKey(keyEvent: KeyboardEvent) {
        if (keyEvent.key !== 'Escape') return;
        keyEvent.stopPropagation();
        finish();
      }

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', finish);
      window.addEventListener('keydown', handleKey, true);
      cleanup.current = finish;
    },
    [disabled],
  );

  /** `true` when the click being handled was the tail of a drag. */
  const consumedByDrag = useCallback(() => justDragged.current, []);

  return { session, startDrag, consumedByDrag };
}
