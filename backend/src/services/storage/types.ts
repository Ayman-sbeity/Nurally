import type { Readable } from 'node:stream';

/**
 * The seam between "we accepted a file" and "the bytes live somewhere".
 *
 * Everything above this interface deals in opaque storage keys, so moving to
 * S3 or Cloudinary later is a new implementation of this one interface plus a
 * line in `storage/index.ts` — no controller, model or route changes.
 */
export interface StoredObject {
  /** Opaque handle. Never a client-supplied path, never rendered as a URL. */
  key: string;
  sizeBytes: number;
}

export interface SaveOptions {
  extension: string;
  /**
   * Optional top-level folder. Public website media is filed under its own
   * prefix so the route that serves it can never reach a client's photographs,
   * which stay in the unprefixed area behind admin auth.
   */
  prefix?: string;
}

export interface StorageAdapter {
  readonly name: string;
  /** Persists bytes and returns the key needed to read them back. */
  save(buffer: Buffer, options: SaveOptions): Promise<StoredObject>;
  createReadStream(key: string): Readable;
  exists(key: string): Promise<boolean>;
  /** Must resolve even when the object is already gone — deletes are idempotent. */
  remove(key: string): Promise<void>;
}
