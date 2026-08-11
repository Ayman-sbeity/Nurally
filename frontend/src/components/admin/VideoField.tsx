import { useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { mediaSrc } from '@/utils/media';

/** Mirrors the formats the API verifies by signature; anything else is refused. */
const ACCEPTED = 'video/mp4,video/webm';
/** Matches `MAX_VIDEO_UPLOAD_MB` on the server — checked here only to fail fast. */
const MAX_MB = 80;

interface VideoFieldProps {
  label: string;
  /** Current video URL; empty string when the reel has none. */
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}

/**
 * Video counterpart to `ImageField`.
 *
 * Uploads run long enough that a plain spinner is not enough feedback, so this
 * one reports real progress — an admin watching a still button for a minute
 * assumes it has hung and starts clicking.
 */
export function VideoField({ label, value, onChange, hint }: VideoFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadVideo(file, setProgress),
    onSuccess: ({ url }) => {
      setError(null);
      onChange(url);
    },
    onError: (uploadError) =>
      setError(
        uploadError instanceof ApiRequestError
          ? uploadError.message
          : 'That video could not be uploaded.',
      ),
    onSettled: () => setProgress(0),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError('Choose an MP4 or WebM video.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Videos must be ${MAX_MB} MB or smaller.`);
      return;
    }
    upload.mutate(file);
  };

  return (
    <div className="nu-field">
      <span className="nu-label" id={`${id}-label`}>
        {label}
      </span>

      <div className="nu-image-field">
        <div className="nu-image-field__preview nu-image-field__preview--portrait">
          {value ? (
            // Muted and controlled: this is a check that the right file landed,
            // not somewhere to watch the reel.
            <video src={mediaSrc(value)} muted controls playsInline preload="metadata" />
          ) : (
            <span className="nu-hint">No video</span>
          )}
        </div>

        <div className="nu-image-field__controls">
          <div className="nu-row" style={{ gap: 'var(--nu-space-2)', flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="outline"
              loading={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Replace video' : 'Upload video'}
            </Button>
            {value && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  onChange('');
                }}
              >
                Remove
              </Button>
            )}
          </div>

          {upload.isPending && (
            <p className="nu-hint" role="status">
              Uploading… {progress}%
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="nu-sr-only"
            aria-labelledby={`${id}-label`}
            onChange={(event) => {
              pick(event.target.files?.[0]);
              // Reset so choosing the same file twice still fires a change.
              event.target.value = '';
            }}
          />

          <label className="nu-hint" htmlFor={`${id}-url`}>
            …or paste a video address
          </label>
          <input
            id={`${id}-url`}
            className="nu-input"
            value={value}
            placeholder="https://…"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>

      {hint && !error && <p className="nu-hint">{hint}</p>}
      {error && (
        <p className="nu-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
