import type { PoolClient } from 'pg';
import { getPool } from '../connection';
import type { BalanceRecord } from '../../interfaces';

export class BalanceRepository {
  async getBalance(address: string): Promise<number> {
    const pool = getPool();
    const result = await pool.query<BalanceRecord>(
      'SELECT balance FROM balances WHERE address = $1',
      [address]
    );
    return result.rows[0]?.balance || 0;
  }

  async updateBalance(
    client: PoolClient,
    address: string,
    delta: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO balances (address, balance) 
       VALUES ($1, $2) 
       ON CONFLICT (address) 
       DO UPDATE SET balance = balances.balance + $2`,
      [address, delta]
    );
  }

  async getAllBalances(): Promise<BalanceRecord[]> {
    const pool = getPool();
    const result = await pool.query<BalanceRecord>(
      'SELECT address, balance FROM balances ORDER BY address ASC'
    );
    return result.rows;
  }

  async deleteBalance(client: PoolClient, address: string): Promise<void> {
    await client.query(
      'DELETE FROM balances WHERE address = $1',
      [address]
    );
  }

  async setBalance(
    client: PoolClient,
    address: string,
    balance: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO balances (address, balance) 
       VALUES ($1, $2) 
       ON CONFLICT (address) 
       DO UPDATE SET balance = $2`,
      [address, balance]
    );
  }
}