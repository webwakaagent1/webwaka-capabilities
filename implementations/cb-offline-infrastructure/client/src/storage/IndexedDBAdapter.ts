/**
 * IndexedDB Storage Adapter - Web Platform Implementation
 * 
 * Implements offline transaction storage using IndexedDB
 * as specified in FD-2026-002 Section 2.1 for web platforms.
 * 
 * Provides durability guarantees:
 * - Crash resistance
 * - Power loss resistance  
 * - Atomic writes
 */

import { IStorageAdapter, StorageConfig } from './StorageInterface';
import { Transaction, TransactionStatus } from '../queue/TransactionTypes';

const STORE_NAME = 'transactions';
const STATUS_INDEX = 'status_idx';
const CREATED_AT_INDEX = 'created_at_idx';

export class IndexedDBAdapter implements IStorageAdapter {
  private db: IDBDatabase | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.databaseName, this.config.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        if (this.config.debug) {
          console.log('[IndexedDBAdapter] Database initialized successfully');
        }
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'transaction_id' });
          
          // Create indexes for efficient querying
          store.createIndex(STATUS_INDEX, 'status', { unique: false });
          store.createIndex(CREATED_AT_INDEX, 'created_at', { unique: false });
          
          if (this.config.debug) {
            console.log('[IndexedDBAdapter] Object store and indexes created');
          }
        }
      };
    });
  }

  async addTransaction(transaction: Transaction): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(transaction);

      request.onsuccess = () => {
        if (this.config.debug) {
          console.log(`[IndexedDBAdapter] Transaction added: ${transaction.transaction_id}`);
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to add transaction: ${request.error?.message}`));
      };
    });
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(transactionId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get transaction: ${request.error?.message}`));
      };
    });
  }

  async getTransactionsByStatus(status: TransactionStatus, limit?: number): Promise<Transaction[]> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(STATUS_INDEX);
      const request = index.getAll(status, limit);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get transactions by status: ${request.error?.message}`));
      };
    });
  }

  async updateTransaction(transactionId: string, updates: Partial<Transaction>): Promise<void> {
    this.ensureInitialized();
    
    // First get the existing transaction
    const existing = await this.getTransaction(transactionId);
    if (!existing) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    // Merge updates with existing data
    const updated = { ...existing, ...updates };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(updated);

      request.onsuccess = () => {
        if (this.config.debug) {
          console.log(`[IndexedDBAdapter] Transaction updated: ${transactionId}`);
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to update transaction: ${request.error?.message}`));
      };
    });
  }

  async deleteTransaction(transactionId: string): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(transactionId);

      request.onsuccess = () => {
        if (this.config.debug) {
          console.log(`[IndexedDBAdapter] Transaction deleted: ${transactionId}`);
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete transaction: ${request.error?.message}`));
      };
    });
  }

  async getTransactionCount(): Promise<number> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get transaction count: ${request.error?.message}`));
      };
    });
  }

  async getTransactionCountByStatus(status: TransactionStatus): Promise<number> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(STATUS_INDEX);
      const request = index.count(status);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get count by status: ${request.error?.message}`));
      };
    });
  }

  async getAllTransactions(limit?: number, offset?: number): Promise<Transaction[]> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let results = request.result;
        
        // Apply offset and limit if specified
        if (offset !== undefined) {
          results = results.slice(offset);
        }
        if (limit !== undefined) {
          results = results.slice(0, limit);
        }
        
        resolve(results);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all transactions: ${request.error?.message}`));
      };
    });
  }

  async clearAll(): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        if (this.config.debug) {
          console.log('[IndexedDBAdapter] All transactions cleared');
        }
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear transactions: ${request.error?.message}`));
      };
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      if (this.config.debug) {
        console.log('[IndexedDBAdapter] Database connection closed');
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('IndexedDB adapter not initialized. Call initialize() first.');
    }
  }
}
