import type { Pool } from 'pg';

export async function createTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INTEGER UNIQUE NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS outputs (
      tx_id TEXT NOT NULL,
      output_index INTEGER NOT NULL,
      address TEXT NOT NULL,
      value NUMERIC NOT NULL,
      block_height INTEGER NOT NULL,
      spent BOOLEAN DEFAULT false,
      spent_by_tx TEXT,
      spent_at_height INTEGER,
      PRIMARY KEY (tx_id, output_index),
      FOREIGN KEY (block_height) REFERENCES blocks(height) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_block_height 
    ON outputs(block_height);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_spent 
    ON outputs(spent);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_address 
    ON outputs(address);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_outputs_spent_at_height 
    ON outputs(spent_at_height);
  `);
}