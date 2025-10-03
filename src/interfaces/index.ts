// Types and Interfaces

export interface Output {
  address: string;
  value: number;
}

export interface Input {
  txId: string;
  index: number;
}

export interface Transaction {
  id: string;
  inputs: Input[];
  outputs: Output[];
}

export interface Block {
  id: string;
  height: number;
  transactions: Transaction[];
}

export interface OutputRecord {
  tx_id: string;
  output_index: number;
  address: string;
  value: number;
  block_height: number;
  spent: boolean;
}

export interface BalanceRecord {
  address: string;
  balance: number;
}

export interface BlockRecord {
  id: string;
  height: number;
}

export interface ValidationError {
  error: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface BalanceResponse {
  address: string;
  balance: number;
}

export interface RollbackResponse {
  success: boolean;
  height: number;
}