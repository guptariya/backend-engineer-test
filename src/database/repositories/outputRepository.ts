import type { PoolClient } from 'pg';
import { getPool } from '../connection';
import type { OutputRecord } from '../../interfaces';

export class OutputRepository {
    async getOutput(
        txId: string,
        index: number
    ): Promise<OutputRecord | null> {
        const pool = getPool();
        const result = await pool.query<OutputRecord>(
            `SELECT tx_id, output_index, address, value, block_height, spent 
       FROM outputs 
       WHERE tx_id = $1 AND output_index = $2`,
            [txId, index]
        );
        return result.rows[0] || null;
    }

    async getUnspentOutput(
        txId: string,
        index: number
    ): Promise<OutputRecord | null> {
        const pool = getPool();
        const result = await pool.query<OutputRecord>(
            `SELECT tx_id, output_index, address, value, block_height, spent 
       FROM outputs 
       WHERE tx_id = $1 AND output_index = $2 AND spent = false`,
            [txId, index]
        );
        return result.rows[0] || null;
    }

    async insertOutput(
        client: PoolClient,
        txId: string,
        outputIndex: number,
        address: string,
        value: number,
        blockHeight: number
    ): Promise<void> {
        await client.query(
            `INSERT INTO outputs (tx_id, output_index, address, value, block_height, spent) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [txId, outputIndex, address, value, blockHeight, false]
        );
    }

    async markOutputAsSpent(
        client: PoolClient,
        txId: string,
        index: number,
        spentByTx: string,
        spentAtHeight: number
    ): Promise<void> {
        await client.query(
            'UPDATE outputs SET spent = true, spent_by_tx = $3, spent_at_height = $4 WHERE tx_id = $1 AND output_index = $2',
            [txId, index, spentByTx, spentAtHeight]
        );
    }

    async getOutputsAboveHeight(
        client: PoolClient,
        height: number
    ): Promise<OutputRecord[]> {
        const result = await client.query<OutputRecord>(
            `SELECT tx_id, output_index, address, value, block_height, spent 
       FROM outputs 
       WHERE block_height > $1 
       ORDER BY block_height DESC`,
            [height]
        );
        return result.rows;
    }

    async deleteOutputsAboveHeight(
        client: PoolClient,
        height: number
    ): Promise<void> {
        await client.query(
            'DELETE FROM outputs WHERE block_height > $1',
            [height]
        );
    }

    async getOutputsByTxId(txId: string): Promise<OutputRecord[]> {
        const pool = getPool();
        const result = await pool.query<OutputRecord>(
            `SELECT tx_id, output_index, address, value, block_height, spent 
       FROM outputs 
       WHERE tx_id = $1 
       ORDER BY output_index ASC`,
            [txId]
        );
        return result.rows;
    }

    async unmarkOutputsAsSpentByTxIds(
        client: PoolClient,
        txIds: string[]
    ): Promise<void> {
        if (txIds.length === 0) return;

        await client.query(
            'UPDATE outputs SET spent = false WHERE tx_id = ANY($1::text[])',
            [txIds]
        );
    }
}