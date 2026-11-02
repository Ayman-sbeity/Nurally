import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin.api';
import { ApiRequestError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { sceneFor } from '@/content/serviceImageScenes';
import { useToast } from '@/context/ToastContext';
import { useImageGenerator } from '@/hooks/queries';
import { mediaSrc } from '@/utils/media';
import type { Service } from '@/types/api';

/**
 * Two at a time: a full catalogue finishes in minutes rather than the better
 * part of an hour, without tripping OpenAI's per-minute limits on a new
 * account.
 */
const CONCURRENCY = 2;

type ItemState =
  | { status: 'waiting' }
  | { status: 'creating' }
  | { status: 'ready'; url: string }
  | { status: 'saving'; url: string }
  | { status: 'saved'; url: string }
  | { status: 'failed'; error: string };

/**
 * Creates a photo for every treatment on the website that still shows its
 * category's artwork, then lets the admin review them side by side.
 *
 * Nothing is published by the run itself. Each photo waits for "Use" — or
 * "Use all" once they have been looked at — because an AI picture can be
 * wrong in ways only a person will notice: an odd hand, the wrong device, a
 * scene that does not match what the lounge actually does.
 *
 * The list is fixed when the run starts, so photos that have just been used
 * stay on screen instead of vanishing as the catalogue refreshes.
 */
export function ServicePhotoBatch({ services }: { services: Service[] }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { data: generator } = useImageGenerator();
  const [batch, setBatch] = useState<Service[] | null>(null);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRef = useRef(false);

  // Only what is on the website: an inactive treatment is not worth paying for.
  const missing = useMemo(() => services.filter((service) => service.isActive && !service.imageUrl), [services]);

  if (!generator?.enabled) return null;

  const setItem = (id: string, state: ItemState) => setItems((current) => ({ ...current, [id]: state }));

  const create = async (service: Service) => {
    setItem(service._id, { status: 'creating' });
    try {
      const { url } = await adminApi.generateImage({ title: service.name, scene: sceneFor(service) });
      setItem(service._id, { status: 'ready', url });
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : null;
      setItem(service._id, { status: 'failed', error: apiError?.message ?? 'The photo could not be created.' });
      // A rejected key, spent credit or the hourly cap fails every request the
      // same way — stop instead of collecting forty identical errors.
      if (apiError && (apiError.status === 429 || apiError.status === 503)) stopRef.current = true;
    }
  };

  const run = async (list: Service[]) => {
    stopRef.current = false;
    setStopping(false);
    setRunning(true);
    list.forEach((service) => setItem(service._id, { status: 'waiting' }));

    const queue = [...list];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (!stopRef.current) {
          const next = queue.shift();
          if (!next) return;
          await create(next);
        }
      }),
    );

    setRunning(false);
    setStopping(false);
  };

  const use = async (service: Service, url: string) => {
    setItem(service._id, { status: 'saving', url });
    try {
      await adminApi.updateService(service._id, { imageUrl: url });
      setItem(service._id, { status: 'saved', url });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
    } catch (error) {
      setItem(service._id, { status: 'ready', url });
      notify(error instanceof ApiRequestError ? error.message : `${service.name} could not be updated.`, 'error');
    }
  };

  const ready = (batch ?? []).flatMap((service) => {
    const state = items[service._id];
    return state?.status === 'ready' ? [{ service, url: state.url }] : [];
  });
  const unfinished = (batch ?? []).filter((service) => {
    const status = items[service._id]?.status;
    return status === 'waiting' || status === 'failed';
  });

  return (
    <section className="nu-panel nu-ai-batch" style={{ marginBottom: 'var(--nu-space-5)' }}>
      <div className="nu-panel__head">
        <div>
          <h2 className="nu-panel__title">AI treatment photos</h2>
          <p className="nu-hint">
            {batch
              ? 'Review each photo and use the ones you like. Nothing changes on the website until you do.'
              : missing.length > 0
                ? `${missing.length} treatment${missing.length === 1 ? '' : 's'} on the website still show${missing.length === 1 ? 's' : ''} the category artwork. Create a photo for each, review them here, and use the ones you like. Each photo is billed to the lounge’s OpenAI account.`
                : 'Every treatment on the website has a photo. To replace one, edit the treatment.'}
          </p>
        </div>
        <div className="nu-row" style={{ gap: 'var(--nu-space-2)', flexWrap: 'wrap' }}>
          {running ? (
            <Button
              variant="outline"
              size="sm"
              disabled={stopping}
              onClick={() => {
                stopRef.current = true;
                setStopping(true);
              }}
            >
              {stopping ? 'Stopping after the current photos…' : 'Stop'}
            </Button>
          ) : batch ? (
            unfinished.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => void run(unfinished)}>
                Continue ({unfinished.length} left)
              </Button>
            )
          ) : (
            missing.length > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setBatch(missing);
                  void run(missing);
                }}
              >
                Create {missing.length} photo{missing.length === 1 ? '' : 's'}
              </Button>
            )
          )}
          {ready.length > 0 && (
            <Button
              size="sm"
              onClick={async () => {
                for (const { service, url } of ready) await use(service, url);
              }}
            >
              Use all {ready.length} ready
            </Button>
          )}
        </div>
      </div>

      {batch && (
        <ul className="nu-panel__body nu-ai-batch__grid">
          {batch.map((service) => {
            const state = items[service._id] ?? { status: 'waiting' };
            const url = 'url' in state ? state.url : null;
            return (
              <li key={service._id} className="nu-ai-batch__item">
                <div className="nu-ai-batch__media">
                  {url ? (
                    // Opens the whole square, to check what the crop leaves out.
                    <a href={mediaSrc(url)} target="_blank" rel="noreferrer">
                      <img src={mediaSrc(url)} alt={`AI photo for ${service.name}`} loading="lazy" />
                    </a>
                  ) : state.status === 'creating' ? (
                    <span className="nu-spinner" aria-hidden="true" />
                  ) : null}
                </div>
                <p className="nu-ai-batch__name">{service.name}</p>
                <p className={state.status === 'failed' ? 'nu-error' : 'nu-hint'} role={state.status === 'failed' ? 'alert' : undefined}>
                  {state.status === 'waiting' && 'Waiting'}
                  {state.status === 'creating' && 'Creating…'}
                  {state.status === 'ready' && 'Ready to review'}
                  {state.status === 'saving' && 'Saving…'}
                  {state.status === 'saved' && 'On the website'}
                  {state.status === 'failed' && state.error}
                </p>
                <div className="nu-row" style={{ gap: 'var(--nu-space-2)', flexWrap: 'wrap' }}>
                  {state.status === 'ready' && (
                    <Button size="sm" onClick={() => void use(service, state.url)}>
                      Use
                    </Button>
                  )}
                  {(state.status === 'ready' || state.status === 'failed' || state.status === 'saved') && (
                    <Button size="sm" variant="ghost" onClick={() => void create(service)}>
                      {state.status === 'failed' ? 'Try again' : 'Another'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
