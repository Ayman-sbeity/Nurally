import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';

interface SignaturePadProps {
  label: string;
  hint: string;
  clearLabel: string;
  error?: string;
  /** A PNG data URL after each stroke, or null once cleared. */
  onChange: (image: string | null) => void;
}

const INK = '#1f1a17';

/**
 * A box to sign in with a finger, stylus or mouse.
 *
 * Pointer events cover all three with one code path. `touch-action: none` (in
 * the stylesheet) stops a finger stroke from scrolling the page instead of
 * drawing, which is the usual way signature pads fail on a tablet.
 *
 * The canvas is sized once, at the device's pixel density, so the stroke is
 * sharp on a retina screen and in print. Pointer positions are mapped through
 * the canvas's current on-screen size, so the drawing stays under the finger
 * even if the box is resized after it was set up.
 *
 * The background is left transparent: the server refuses a signature with
 * nothing drawn by checking for any variation in the image, which a white
 * fill would defeat.
 */
export function SignaturePad({ label, hint, clearLabel, error, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const hintId = useId();
  const errorId = useId();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const stroke = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const context = canvasRef.current?.getContext('2d');
    const canvas = canvasRef.current;
    if (!context || !canvas) return;
    // Scaled with the canvas so the line looks the same weight at any density.
    const base = canvas.width / 320;
    context.strokeStyle = INK;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    // A stylus reports pressure; a finger or mouse reports 0.5 while pressed.
    context.lineWidth = base * (0.7 + pressure * 0.8);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  const describedBy = [hintId, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="nu-sigpad">
      <div className="nu-sigpad__head">
        <span className="nu-cform__label" id={`${hintId}-label`}>
          {label}
        </span>
        <button type="button" className="nu-sigpad__clear" onClick={clear} disabled={empty}>
          {clearLabel}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="nu-sigpad__canvas"
        role="img"
        aria-labelledby={`${hintId}-label`}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          last.current = point(event);
          // A tap with no movement still leaves a dot.
          stroke(last.current, last.current, event.pressure || 0.5);
        }}
        onPointerMove={(event) => {
          if (!last.current) return;
          const next = point(event);
          stroke(last.current, next, event.pressure || 0.5);
          last.current = next;
        }}
        onPointerUp={() => {
          if (!last.current) return;
          last.current = null;
          setEmpty(false);
          onChange(canvasRef.current?.toDataURL('image/png') ?? null);
        }}
        onPointerCancel={() => {
          last.current = null;
        }}
      />
      <p className="nu-hint" id={hintId}>
        {hint}
      </p>
      {error && (
        <p className="nu-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
