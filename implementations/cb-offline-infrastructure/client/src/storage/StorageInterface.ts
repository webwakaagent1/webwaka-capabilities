/**
 * Storage Interface - Platform Abstraction Layer
 * 
 * Provides a unified interface for different storage mechanisms
 * (IndexedDB for web, SQLite for mobile) as per FD-2026-002 Section 2.1
 */

import { Transaction, TransactionStatus } from '../queue/TransactionTypes';

/**
 * Abstract storage interface that must be implemented by platform-specific adapters
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage mechanism
   * Creates necessary databases, tables, and indexes
   */
  initialize(): Promise<void>;

  /**
   * Add a new transaction to the queue
   * @param transaction - Transaction to add
   * @returns Promise that resolves when transaction is persisted
   */
  addTransaction(transaction: Transaction): Promise<void>;

  /**
   * Retrieve a transaction by ID
   * @param transactionId - UUID of the transaction
   * @returns Transaction or null if not found
   */
  getTransaction(transactionId: string): Promise<Transaction | null>;

  /**
   * Get all transactions with a specific status
   * @param status - Transaction status to filter by
   * @param limit - Maximum number of transactions to return
   * @returns Array of transactions
   */
  getTransactionsByStatus(status: TransactionStatus, limit?: number): Promise<Transaction[]>;

  /**
   * Update an existing transaction
   * @param transactionId - UUID of the transaction to update
   * @param updates - Partial transaction object with fields to update
   * @returns Promise that resolves when update is complete
   */
  updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void>;

  /**
   * Delete a transaction from storage
   * @param transactionId - UUID of the transaction to delete
   * @returns Promise that resolves when deletion is complete
   */
  deleteTransaction(transactionId: string): Promise<void>;

  /**
   * Get the total count of transactions
   * @returns Total number of transactions in storage
   */
  getTransactionCount(): Promise<number>;

  /**
   * Get count of transactions by status
   * @param status - Status to count
   * @returns Number of transactions with the given status
   */
  getTransactionCountByStatus(status: TransactionStatus): Promise<number>;

  /**
   * Get all transactions (for batch operations)
   * @param limit - Maximum number to return
   * @param offset - Number to skip
   * @returns Array of transactions
   */
  getAllTransactions(limit?: number, offset?: number): Promise<Transaction[]>;

  /**
   * Clear all transactions (use with caution)
   * @returns Promise that resolves when all transactions are deleted
   */
  clearAll(): Promise<void>;

  /**
   * Close the storage connection
   * @returns Promise that resolves when connection is closed
   */
  close(): Promise<void>;
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Database name */
  databaseName: string;
  
  /** Database version */
  version: number;
  
  /** Enable debug logging */
  debug?: boolean;
}
