import { Pool } from 'pg';

let pool: Pool | null = null;

export function initializePool(connectionString: string): Pool {
  if (!pool) {
    // For Unix socket connections, parse manually
    pool = new Pool({
      user: 'postgres',
      database: 'blockchain_indexer',
      host: '/var/run/postgresql',
      port: 5433,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}