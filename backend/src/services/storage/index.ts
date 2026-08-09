import { env } from '../../config/env';
import { LocalDiskAdapter } from './localDisk.adapter';
import type { StorageAdapter } from './types';

/**
 * Single place that knows which adapter is in play. Add a case here (and the
 * driver to the `STORAGE_DRIVER` enum in `config/env.ts`) to introduce S3 or
 * Cloudinary; nothing else in the codebase needs to change.
 */
function createAdapter(): StorageAdapter {
  switch (env.STORAGE_DRIVER) {
    case 'local':
    default:
      return new LocalDiskAdapter(env.UPLOAD_DIR);
  }
}

export const storage = createAdapter();

/** Verifies the backing store is usable before the server accepts traffic. */
export async function initStorage(): Promise<void> {
  if (storage instanceof LocalDiskAdapter) await storage.ensureReady();
}

export type { StorageAdapter, StoredObject } from './types';
