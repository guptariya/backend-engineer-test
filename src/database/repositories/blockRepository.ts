import type { PoolClient } from 'pg';
import { getPool } from '../connection';
import type { BlockRecord } from '../../interfaces';

export class BlockRepository {
  async getCurrentHeight(): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT MAX(height) as height FROM blocks'
    );
    return result.rows[0].height || 0;
  }

  async insertBlock(
    client: PoolClient,
    id: string,
    height: number
  ): Promise<void> {
    await client.query(
      'INSERT INTO blocks (id, height) VALUES ($1, $2)',
      [id, height]
    );
  }

  async deleteBlocksAboveHeight(
    client: PoolClient,
    height: number
  ): Promise<void> {
    await client.query(
      'DELETE FROM blocks WHERE height > $1',
      [height]
    );
  }

  async getBlockByHeight(height: number): Promise<BlockRecord | null> {
    const pool = getPool();
    const result = await pool.query<BlockRecord>(
      'SELECT id, height FROM blocks WHERE height = $1',
      [height]
    );
    return result.rows[0] || null;
  }

  async getAllBlocks(): Promise<BlockRecord[]> {
    const pool = getPool();
    const result = await pool.query<BlockRecord>(
      'SELECT id, height FROM blocks ORDER BY height ASC'
    );
    return result.rows;
  }
}