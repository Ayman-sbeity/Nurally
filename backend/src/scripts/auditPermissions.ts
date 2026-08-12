/* eslint-disable no-console */
import adminRoutes from '../routes/admin.routes';
import type { PermissionHandler } from '../middleware/auth';

/**
 * PERMISSION AUDIT
 * ----------------
 * Walks the admin router and reports the guard on every route.
 *
 * The failure this exists to catch is a route added later without a
 * `requirePermission`, which would be reachable by any employee regardless of
 * what they were granted. Type-checking cannot see that, and it is silent at
 * runtime until someone exploits it — so it is asserted here instead.
 *
 * Exits non-zero when a route is ungated, so it can gate a deploy.
 */

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: PermissionHandler; name: string }[];
  };
}

// Cast away Express's own router typings: its `stack` is internal and typed
// loosely, and we need to read the permission tag we attached to each handler.
const stack = (adminRoutes as unknown as { stack: RouteLayer[] }).stack;

const rows: { method: string; path: string; guard: string }[] = [];
const ungated: string[] = [];

for (const layer of stack) {
  if (!layer.route) continue;

  const method = Object.keys(layer.route.methods)[0]?.toUpperCase() ?? '?';
  const path = layer.route.path;

  const guard = layer.route.stack
    .map((entry) => entry.handle.permission)
    .find(Boolean);

  if (guard) {
    const label =
      guard.resource === ('OWNER_ONLY' as string)
        ? 'OWNER ONLY'
        : `${guard.resource}:${guard.action}`;
    rows.push({ method, path, guard: label });
  } else {
    rows.push({ method, path, guard: '— UNGATED —' });
    ungated.push(`${method} ${path}`);
  }
}

const width = Math.max(...rows.map((row) => row.path.length)) + 2;
console.log(`\nAdmin routes (${rows.length}):\n`);
for (const row of rows) {
  console.log(`  ${row.method.padEnd(7)} ${row.path.padEnd(width)} ${row.guard}`);
}

/**
 * The uploader is the one deliberate exception: it writes to the public media
 * area and returns a URL, and the record that URL is saved onto enforces its
 * own permission. See the comment on the route.
 */
const ALLOWED_UNGATED = new Set(['POST /media/images', 'POST /media/videos']);
const unexpected = ungated.filter((entry) => !ALLOWED_UNGATED.has(entry));

console.log('');
if (unexpected.length > 0) {
  console.error(`FAIL: ${unexpected.length} admin route(s) have no permission guard:`);
  unexpected.forEach((entry) => console.error(`  - ${entry}`));
  console.error('\nAdd `may(AdminResource.X, ACTION)` or `requireOwner` to each.\n');
  process.exit(1);
}

console.log(`OK: every admin route is gated (${ALLOWED_UNGATED.size} documented exceptions).\n`);
