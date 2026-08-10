import { useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { mediaSrc } from '@/utils/media';

/** Mirrors the formats the API verifies by signature; anything else is refused. */
const ACCEPTED = 'image/jpeg,image/png,image/webp';
/** Matches `MAX_UPLOAD_MB` on the server — checked here only to fail fast. */
const MAX_MB = 15;

interface ImageFieldProps {
  label: string;
  /** Current image URL; empty string when the record has none. */
  value: string;
  onChange: (url: string) => void;
  /**
   * Shown in the preview when no image is set, so the admin sees exactly what
   * the website falls back to rather than an empty box.
   */
  fallbackSrc?: string;
  fallbackNote?: string;
  hint?: string;
}

/**
 * Picture control for admin forms: upload a file, or paste the address of an
 * image hosted elsewhere. Both routes end at the same thing — a URL stored on
 * the record — so the rest of the form stays a plain string field.
 */
export function ImageField({
  label,
  value,
  onChange,
  fallbackSrc,
  fallbackNote,
  hint,
}: ImageFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadImage(file),
    onSuccess: ({ url }) => {
      setError(null);
      onChange(url);
    },
    onError: (uploadError) =>
      setError(
        uploadError instanceof ApiRequestError
          ? uploadError.message
          : 'That image could not be uploaded.',
      ),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.split(',').includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Images must be ${MAX_MB} MB or smaller.`);
      return;
    }
    upload.mutate(file);
  };

  const preview = value || fallbackSrc;

  return (
    <div className="nu-field">
      <span className="nu-label" id={`${id}-label`}>
        {label}
      </span>

      <div className="nu-image-field">
        <div className="nu-image-field__preview">
          {preview ? (
            <img src={mediaSrc(preview)} alt="" />
          ) : (
            <span className="nu-hint">No image</span>
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
              {value ? 'Replace image' : 'Upload image'}
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

          {!value && fallbackNote && <p className="nu-hint">{fallbackNote}</p>}

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
            …or paste an image address
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
