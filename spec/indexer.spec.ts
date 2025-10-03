import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import crypto from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3000';

function calculateBlockId(height: number, txIds: string[]): string {
  const data = `${height}${txIds.join('')}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function cleanDatabase(pool: Pool) {
  await pool.query('DELETE FROM outputs');
  await pool.query('DELETE FROM blocks');
  await pool.query('DELETE FROM balances');
}

describe('Blockchain Indexer API', () => {
  let pool: Pool;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for tests');
    }

    pool = new Pool({
      connectionString: databaseUrl
    });

    // Wait for API to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) break;
      } catch (error) {
        // API not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries--;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await cleanDatabase(pool);
  });

  describe('POST /blocks - Basic Functionality', () => {
    it('should accept the first block with height 1', async () => {
      const block = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{
            address: 'addr1',
            value: 10
          }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should process sequential blocks correctly', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [
            { address: 'addr2', value: 60 },
            { address: 'addr3', value: 40 }
          ]
        }]
      };

      const response1 = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      expect(response1.status).toBe(200);

      const response2 = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      expect(response2.status).toBe(200);
    });

    it('should handle multiple transactions in one block', async () => {
      const block = {
        id: calculateBlockId(1, ['tx1', 'tx2', 'tx3']),
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 10 }]
          },
          {
            id: 'tx2',
            inputs: [],
            outputs: [{ address: 'addr2', value: 20 }]
          },
          {
            id: 'tx3',
            inputs: [],
            outputs: [{ address: 'addr3', value: 30 }]
          }
        ]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /blocks - Validation Tests', () => {
    it('should reject block with invalid height', async () => {
      const block = {
        id: calculateBlockId(5, ['tx1']),
        height: 5,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid height');
      expect(data.error).toContain('Expected 1');
    });

    it('should reject block with incorrect block id', async () => {
      const block = {
        id: 'wrong_hash_value',
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid block id');
    });

    it('should reject transaction where input sum does not equal output sum', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [{ address: 'addr2', value: 150 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('does not equal');
    });

    it('should reject spending non-existent output', async () => {
      const block = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [{ txId: 'nonexistent', index: 0 }],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('non-existent or already spent');
    });

    it('should reject double spending', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 50 }]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [{ address: 'addr2', value: 50 }]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      const block3 = {
        id: calculateBlockId(3, ['tx3']),
        height: 3,
        transactions: [{
          id: 'tx3',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [{ address: 'addr3', value: 50 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block3)
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('already spent');
    });
  });

  describe('GET /balance/:address', () => {
    it('should return 0 for address with no transactions', async () => {
      const response = await fetch(`${API_URL}/balance/unknownaddr`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.address).toBe('unknownaddr');
      expect(data.balance).toBe(0);
    });

    it('should return correct balance after receiving funds', async () => {
      const block = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      const response = await fetch(`${API_URL}/balance/addr1`);
      const data = await response.json();
      
      expect(data.address).toBe('addr1');
      expect(data.balance).toBe(100);
    });

    it('should track balance through multiple transactions', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [
            { address: 'addr2', value: 4 },
            { address: 'addr3', value: 6 }
          ]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      const addr1Response = await fetch(`${API_URL}/balance/addr1`);
      const addr1Data = await addr1Response.json();
      expect(addr1Data.balance).toBe(0);

      const addr2Response = await fetch(`${API_URL}/balance/addr2`);
      const addr2Data = await addr2Response.json();
      expect(addr2Data.balance).toBe(4);

      const addr3Response = await fetch(`${API_URL}/balance/addr3`);
      const addr3Data = await addr3Response.json();
      expect(addr3Data.balance).toBe(6);
    });

    it('should handle multiple outputs to same address', async () => {
      const block = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [
            { address: 'addr1', value: 10 },
            { address: 'addr1', value: 20 },
            { address: 'addr1', value: 30 }
          ]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      const response = await fetch(`${API_URL}/balance/addr1`);
      const data = await response.json();
      expect(data.balance).toBe(60);
    });
  });

  describe('POST /rollback', () => {
    beforeEach(async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 10 }]
        }]
      };

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [
            { address: 'addr2', value: 4 },
            { address: 'addr3', value: 6 }
          ]
        }]
      };

      const block3 = {
        id: calculateBlockId(3, ['tx3']),
        height: 3,
        transactions: [{
          id: 'tx3',
          inputs: [{ txId: 'tx2', index: 1 }],
          outputs: [
            { address: 'addr4', value: 2 },
            { address: 'addr5', value: 2 },
            { address: 'addr6', value: 2 }
          ]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block3)
      });
    });

    it('should rollback to height 2 correctly', async () => {
      const response = await fetch(`${API_URL}/rollback?height=2`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.height).toBe(2);

      const addr1Res = await fetch(`${API_URL}/balance/addr1`);
      const addr1Data = await addr1Res.json();
      expect(addr1Data.balance).toBe(0);

      const addr2Res = await fetch(`${API_URL}/balance/addr2`);
      const addr2Data = await addr2Res.json();
      expect(addr2Data.balance).toBe(4);

      const addr3Res = await fetch(`${API_URL}/balance/addr3`);
      const addr3Data = await addr3Res.json();
      expect(addr3Data.balance).toBe(6);

      const addr4Res = await fetch(`${API_URL}/balance/addr4`);
      const addr4Data = await addr4Res.json();
      expect(addr4Data.balance).toBe(0);
    });

    it('should allow adding new block after rollback', async () => {
      await fetch(`${API_URL}/rollback?height=2`, { method: 'POST' });

      const newBlock3 = {
        id: calculateBlockId(3, ['tx3_new']),
        height: 3,
        transactions: [{
          id: 'tx3_new',
          inputs: [{ txId: 'tx2', index: 0 }],
          outputs: [{ address: 'addr7', value: 4 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlock3)
      });

      expect(response.status).toBe(200);

      const addr7Res = await fetch(`${API_URL}/balance/addr7`);
      const addr7Data = await addr7Res.json();
      expect(addr7Data.balance).toBe(4);
    });

    it('should rollback to height 0', async () => {
      const response = await fetch(`${API_URL}/rollback?height=0`, {
        method: 'POST'
      });

      expect(response.status).toBe(200);

      const addr1Res = await fetch(`${API_URL}/balance/addr1`);
      const addr1Data = await addr1Res.json();
      expect(addr1Data.balance).toBe(0);

      const addr2Res = await fetch(`${API_URL}/balance/addr2`);
      const addr2Data = await addr2Res.json();
      expect(addr2Data.balance).toBe(0);
    });

    it('should reject rollback to height greater than current', async () => {
      const response = await fetch(`${API_URL}/rollback?height=100`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('greater than current height');
    });

    it('should reject rollback with invalid height parameter', async () => {
      const response = await fetch(`${API_URL}/rollback?height=invalid`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid height');
    });

    it('should reject rollback without height parameter', async () => {
      const response = await fetch(`${API_URL}/rollback`, {
        method: 'POST'
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle transaction with multiple inputs from different sources', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1', 'tx2']),
        height: 1,
        transactions: [
          {
            id: 'tx1',
            inputs: [],
            outputs: [{ address: 'addr1', value: 30 }]
          },
          {
            id: 'tx2',
            inputs: [],
            outputs: [{ address: 'addr2', value: 20 }]
          }
        ]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = {
        id: calculateBlockId(2, ['tx3']),
        height: 2,
        transactions: [{
          id: 'tx3',
          inputs: [
            { txId: 'tx1', index: 0 },
            { txId: 'tx2', index: 0 }
          ],
          outputs: [{ address: 'addr3', value: 50 }]
        }]
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      expect(response.status).toBe(200);

      const addr3Res = await fetch(`${API_URL}/balance/addr3`);
      const addr3Data = await addr3Res.json();
      expect(addr3Data.balance).toBe(50);
    });

    it('should handle empty transaction list', async () => {
      const block = {
        id: calculateBlockId(1, []),
        height: 1,
        transactions: []
      };

      const response = await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block)
      });

      expect(response.status).toBe(200);
    });

    it('should handle long chain of transactions', async () => {
      let prevTxId = '';
      
      for (let i = 1; i <= 5; i++) {
        const tx = {
          id: `tx${i}`,
          inputs: prevTxId ? [{ txId: prevTxId, index: 0 }] : [],
          outputs: [{ address: `addr${i}`, value: 100 }]
        };

        const block = {
          id: calculateBlockId(i, [tx.id]),
          height: i,
          transactions: [tx]
        };

        const response = await fetch(`${API_URL}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(block)
        });

        expect(response.status).toBe(200);
        prevTxId = tx.id;
      }

      const addr5Res = await fetch(`${API_URL}/balance/addr5`);
      const addr5Data = await addr5Res.json();
      expect(addr5Data.balance).toBe(100);
    });

    it('should correctly handle change addresses', async () => {
      const block1 = {
        id: calculateBlockId(1, ['tx1']),
        height: 1,
        transactions: [{
          id: 'tx1',
          inputs: [],
          outputs: [{ address: 'addr1', value: 100 }]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block1)
      });

      const block2 = {
        id: calculateBlockId(2, ['tx2']),
        height: 2,
        transactions: [{
          id: 'tx2',
          inputs: [{ txId: 'tx1', index: 0 }],
          outputs: [
            { address: 'addr2', value: 30 },
            { address: 'addr1', value: 70 }
          ]
        }]
      };

      await fetch(`${API_URL}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(block2)
      });

      const addr1Res = await fetch(`${API_URL}/balance/addr1`);
      const addr1Data = await addr1Res.json();
      expect(addr1Data.balance).toBe(70);

      const addr2Res = await fetch(`${API_URL}/balance/addr2`);
      const addr2Data = await addr2Res.json();
      expect(addr2Data.balance).toBe(30);
    });
  });
});