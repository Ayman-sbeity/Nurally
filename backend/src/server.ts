import type { Server } from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { expireStaleOffers } from './services/appointment.service';
import { logger } from './utils/logger';
import { loungeTimezone } from './utils/time';

/** How often unanswered time offers are swept up and released. */
const OFFER_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(`Nurella API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (loungeTimezone === 'UTC') {
      logger.warn(
        'LOUNGE_TIMEZONE is still UTC — set it to the lounge\'s IANA timezone before going live.',
      );
    }
  });

  const sweep = setInterval(() => {
    expireStaleOffers()
      .then((count) => {
        if (count > 0) logger.info(`Released ${count} expired time offer(s).`);
      })
      .catch((error) => logger.error('Failed to expire stale time offers', error));
  }, OFFER_SWEEP_INTERVAL_MS);
  sweep.unref();

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down.`);
    clearInterval(sweep);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Don't let a hung connection block the shutdown indefinitely.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error('Failed to start the server', error);
  process.exit(1);
});
