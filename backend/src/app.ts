import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import routes from './routes';
import assetRoutes from './routes/asset.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import { ApiError } from './utils/ApiError';

export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy in production so rate limiting and secure cookies
  // see the real client IP and protocol.
  if (env.isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / server-to-server requests carry no Origin header.
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(ApiError.forbidden('Origin not allowed by CORS policy.'));
      },
      credentials: true,
    }),
  );

  /**
   * Meta's webhook, mounted ahead of the global JSON parser and the API rate
   * limiter. It has to verify a signature over the raw bytes, and it must not
   * be throttled — Meta retries what it cannot deliver, and a retried message
   * is a message answered twice. See `routes/whatsapp.routes.ts`.
   */
  app.use('/api/whatsapp', whatsappRoutes);

  /**
   * Gzip for JSON. Lists of appointments and clients shrink several times
   * over, which is most of their transfer time on a phone. The default filter
   * skips images and video, which are already compressed.
   */
  app.use(compression());

  /**
   * Client photographs by signed URL, also ahead of the API rate limiter. One
   * client file is a few dozen image requests, and everyone on the lounge's
   * Wi-Fi shares one limiter bucket — counting thumbnails against it would
   * throttle the desk. The signature is checked before the database is
   * touched, so leaving the route unthrottled makes it no cheaper to abuse.
   */
  app.use('/api/assets', assetRoutes);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!env.isProduction) app.use(morgan('dev'));

  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
