import 'dotenv/config';
import Fastify from 'fastify';
import { initializePool } from './database/connection';
import { createTables } from './database/schema';
import { registerRoutes } from './routes';

const fastify = Fastify({
  logger: true
});

async function bootstrap() {
  try {
    console.log('Bootstrapping application...');

    // Initialize database connection
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const pool = initializePool(databaseUrl);
    console.log('Database connection pool initialized');

    // Create database tables
    await createTables(pool);
    console.log('Database tables created successfully');

    // Register API routes
    await registerRoutes(fastify);
    console.log('API routes registered');

    // Start server
    await fastify.listen({
      port: 3000,
      host: '0.0.0.0'
    });

    console.log('Server is running on http://0.0.0.0:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

bootstrap();

export { fastify };