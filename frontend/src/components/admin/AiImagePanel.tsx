import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { sceneFor } from '@/content/serviceImageScenes';
import { mediaSrc } from '@/utils/media';
import type { ServiceCategorySlug } from '@/types/api';

interface AiImagePanelProps {
  /** The treatment the photo is for. */
  service: { name: string; category: ServiceCategorySlug };
  /** Receives the chosen photo's URL, to set on the form like an upload. */
  onUse: (url: string) => void;
  onCancel: () => void;
}

/**
 * Creates a treatment photo with AI, for review before it is used.
 *
 * Opens inside the image field rather than as a second dialog: it is used
 * from the service dialog, and a modal on top of a modal is where Escape and
 * focus go wrong — closing the service form and losing its edits.
 *
 * The admin sees, and may rewrite, the scene the picture will show; the house
 * style is applied by the server and is not theirs to change. The result is
 * previewed as the card and the treatment page will crop it, because a square
 * that looks right on its own can lose the subject in either crop. Nothing
 * reaches the website until "Use this photo" and the service is saved.
 */
export function AiImagePanel({ service, onUse, onCancel }: AiImagePanelProps) {
  const sceneId = useId();
  const [scene, setScene] = useState(() => sceneFor(service));
  const [url, setUrl] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => adminApi.generateImage({ title: service.name.trim(), scene: scene.trim() }),
    onSuccess: ({ url: created }) => setUrl(created),
  });

  const error =
    generate.error instanceof ApiRequestError
      ? generate.error.message
      : generate.error
        ? 'The photo could not be created. Please try again.'
        : null;

  return (
    <div className="nu-ai-panel">
      <div className="nu-field">
        <label className="nu-label" htmlFor={sceneId}>
          What the photo shows
        </label>
        <textarea
          id={sceneId}
          className="nu-textarea"
          rows={4}
          maxLength={1000}
          value={scene}
          onChange={(event) => setScene(event.target.value)}
          aria-describedby={`${sceneId}-hint`}
        />
        <p className="nu-hint" id={`${sceneId}-hint`}>
          Light, colours, setting and the house rules — no before/after, nothing graphic, no text —
          are added automatically. Each photo is billed to the lounge’s OpenAI account.
        </p>
      </div>

      {generate.isPending && (
        <p className="nu-ai-panel__status" role="status">
          <span className="nu-spinner nu-spinner--sm" aria-hidden="true" /> Creating the photo — this
          usually takes 20 to 60 seconds.
        </p>
      )}

      {error && !generate.isPending && (
        <p className="nu-error" role="alert">
          {error}
        </p>
      )}

      {url && !generate.isPending && <CropPreview url={url} name={service.name} />}

      <div className="nu-row" style={{ gap: 'var(--nu-space-2)', flexWrap: 'wrap' }}>
        {url && (
          <Button size="sm" onClick={() => onUse(url)} disabled={generate.isPending}>
            Use this photo
          </Button>
        )}
        <Button
          size="sm"
          variant={url ? 'outline' : 'primary'}
          loading={generate.isPending}
          disabled={scene.trim().length < 10 || service.name.trim().length < 2}
          onClick={() => generate.mutate()}
        >
          {url ? 'Try again' : 'Create photo'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={generate.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The photo as the treatment card (2:1) and the treatment page (4:5) will show it. */
export function CropPreview({ url, name }: { url: string; name: string }) {
  const src = mediaSrc(url);
  return (
    <div className="nu-ai-crops">
      <figure className="nu-ai-crops__card">
        <img src={src} alt={`AI photo for ${name}, as the treatment card shows it`} />
        <figcaption className="nu-hint">Card</figcaption>
      </figure>
      <figure className="nu-ai-crops__page">
        <img src={src} alt="" />
        <figcaption className="nu-hint">Treatment page</figcaption>
      </figure>
    </div>
  );
}
