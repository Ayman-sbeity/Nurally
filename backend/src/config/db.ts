import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', true);

/**
 * NoSQL-injection defence note.
 *
 * Mongoose's global `sanitizeFilter` is deliberately NOT enabled: it wraps every
 * operator object in `$eq`, which would break the legitimate `$gt`/`$lt` range
 * queries the calendar and availability engine depend on.
 *
 * Protection comes from the layer above instead — every request body, query and
 * param is parsed by a Zod schema (see `middleware/validate.ts`), which replaces
 * the request data with validated primitives. A payload such as
 * `{ email: { $ne: null } }` fails validation before it can reach a filter, so
 * no user-supplied object ever becomes a query operator.
 */

export async function connectDatabase(): Promise<typeof mongoose> {
  const connection = await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !env.isProduction,
  });

  logger.info(`MongoDB connected: ${connection.connection.name}`);

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', error);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
}
