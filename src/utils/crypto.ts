import crypto from 'crypto';
import type { Transaction } from '../interfaces';

export function calculateBlockId(
  height: number,
  transactions: Transaction[]
): string {
  const txIds = transactions.map(tx => tx.id).join('');
  const data = `${height}${txIds}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}