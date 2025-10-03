import type { PoolClient } from 'pg';
import { getPool } from '../database/connection';
import { BlockRepository } from '../database/repositories/blockRepository';
import { OutputRepository } from '../database/repositories/outputRepository';
import { BalanceRepository } from '../database/repositories/balanceRepository';
import type { Block, ValidationError, Input } from '../interfaces';
import { calculateBlockId } from '../utils/crypto';

export class BlockService {
    private blockRepo: BlockRepository;
    private outputRepo: OutputRepository;
    private balanceRepo: BalanceRepository;

    constructor() {
        this.blockRepo = new BlockRepository();
        this.outputRepo = new OutputRepository();
        this.balanceRepo = new BalanceRepository();
    }

    async addBlock(block: Block): Promise<ValidationError | null> {
        const pool = getPool();
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Validation 1: Check height
            const currentHeight = await this.blockRepo.getCurrentHeight();
            if (block.height !== currentHeight + 1) {
                return {
                    error: `Invalid height. Expected ${currentHeight + 1}, got ${block.height}`
                };
            }

            // Validation 2: Check block ID
            const expectedId = calculateBlockId(block.height, block.transactions);
            if (block.id !== expectedId) {
                return {
                    error: `Invalid block id. Expected ${expectedId}, got ${block.id}`
                };
            }

            // Insert block
            await this.blockRepo.insertBlock(client, block.id, block.height);

            // Process transactions
            for (const tx of block.transactions) {
                const validationError = await this.processTransaction(
                    client,
                    tx,
                    block.height
                );
                if (validationError) {
                    await client.query('ROLLBACK');
                    return validationError;
                }
            }

            await client.query('COMMIT');
            return null;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async processTransaction(
        client: PoolClient,
        tx: any,
        blockHeight: number
    ): Promise<ValidationError | null> {
        let inputSum = 0;
        let outputSum = 0;

        // Process inputs
        for (const input of tx.inputs) {
            const output = await this.outputRepo.getUnspentOutput(
                input.txId,
                input.index
            );

            if (!output) {
                return {
                    error: `Input references non-existent or already spent output: ${input.txId}:${input.index}`
                };
            }

            inputSum += Number(output.value);

            // Mark output as spent
            await this.outputRepo.markOutputAsSpent(
                client,
                input.txId,
                input.index,
                tx.id,
                blockHeight
            );

            // Update balance (subtract)
            await this.balanceRepo.updateBalance(
                client,
                output.address,
                -Number(output.value)
            );
        }

        // Process outputs
        for (let i = 0; i < tx.outputs.length; i++) {
            const output = tx.outputs[i];
            outputSum += output.value;

            // Insert output
            await this.outputRepo.insertOutput(
                client,
                tx.id,
                i,
                output.address,
                output.value,
                blockHeight
            );

            // Update balance (add)
            await this.balanceRepo.updateBalance(
                client,
                output.address,
                output.value
            );
        }

        // Validation: input sum must equal output sum (unless coinbase - no inputs)
        if (tx.inputs.length > 0 && inputSum !== outputSum) {
            return {
                error: `Input sum (${inputSum}) does not equal output sum (${outputSum}) for transaction ${tx.id}`
            };
        }

        return null;
    }

    async getBalance(address: string): Promise<number> {
        return await this.balanceRepo.getBalance(address);
    }

    async rollback(targetHeight: number): Promise<ValidationError | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const currentHeight = await this.blockRepo.getCurrentHeight();

    if (targetHeight > currentHeight) {
      return {
        error: 'Target height is greater than current height'
      };
    }

    await client.query('BEGIN');

    // Mark outputs as unspent if they were spent by transactions in deleted blocks
    await client.query(
      'UPDATE outputs SET spent = false, spent_by_tx = NULL, spent_at_height = NULL WHERE spent_at_height > $1',
      [targetHeight]
    );

    // Delete outputs from rolled-back blocks
    await this.outputRepo.deleteOutputsAboveHeight(client, targetHeight);

    // Delete rolled-back blocks
    await this.blockRepo.deleteBlocksAboveHeight(client, targetHeight);

    // Recalculate balances from unspent outputs
    await client.query('TRUNCATE balances');
    
    await client.query(`
      INSERT INTO balances (address, balance)
      SELECT address, SUM(value)::numeric as balance
      FROM outputs
      WHERE block_height <= $1 AND spent = false
      GROUP BY address
    `, [targetHeight]);

    await client.query('COMMIT');
    return null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
}