import { pool } from '../config/database';
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import {
  StockLevel, StockMovement, StockBatch, StockTransfer, Reservation,
  StockAdjustmentInput, CreateTransferInput, CreateReservationInput,
  ReceiveStockInput, SellStockInput, StockMovementType, ReservationStatus, InventoryStrategy
} from '../types';
import { AuditService } from './AuditService';
import { EventService } from './EventService';
import { ProductService } from './ProductService';

type DbClient = PoolClient | typeof pool;

export class InventoryService {
  private auditService = new AuditService();
  private eventService = new EventService();
  private productService = new ProductService();

  async getStockLevel(tenantId: string, productId: string, locationId: string): Promise<StockLevel | null> {
    const result = await pool.query(
      `SELECT * FROM cb4_stock_levels 
       WHERE tenant_id = $1 AND product_id = $2 AND location_id = $3`,
      [tenantId, productId, locationId]
    );
    return result.rows.length > 0 ? this.mapStockLevel(result.rows[0]) : null;
  }

  async getStockLevels(tenantId: string, filters?: { productId?: string; locationId?: string }): Promise<StockLevel[]> {
    let query = 'SELECT * FROM cb4_stock_levels WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }
    if (filters?.locationId) {
      query += ` AND location_id = $${paramIndex++}`;
      params.push(filters.locationId);
    }

    const result = await pool.query(query, params);
    return result.rows.map(this.mapStockLevel);
  }

  async receiveStock(input: ReceiveStockInput): Promise<{ stockLevel: StockLevel; movement: StockMovement; batch?: StockBatch }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const product = await this.productService.getById(input.tenantId, input.productId);
      if (!product) throw new Error('Product not found');

      let batch: StockBatch | undefined;
      if (input.batchNumber) {
        const batchId = uuidv4();
        const batchResult = await client.query(
          `INSERT INTO cb4_stock_batches 
           (id, tenant_id, product_id, location_id, batch_number, quantity, cost_per_unit, expiry_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (tenant_id, product_id, location_id, batch_number) 
           DO UPDATE SET quantity = cb4_stock_batches.quantity + $6
           RETURNING *`,
          [batchId, input.tenantId, input.productId, input.locationId, input.batchNumber,
           input.quantity, input.costPerUnit, input.expiryDate || null]
        );
        batch = this.mapBatch(batchResult.rows[0]);
      }

      const stockLevel = await this.updateStockLevel(
        client, input.tenantId, input.productId, input.locationId,
        input.quantity, 0
      );

      const movementId = uuidv4();
      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, batch_id, cost_per_unit, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [movementId, input.tenantId, input.productId, input.locationId, 'receipt',
         input.quantity, input.referenceType || null, input.referenceId || null,
         batch?.id || null, input.costPerUnit, input.performedBy]
      );

      await client.query('COMMIT');

      const movement = await this.getMovementById(input.tenantId, movementId);

      await this.auditService.log(
        input.tenantId, 'stock_level', `${input.productId}:${input.locationId}`,
        'receive', input.performedBy, undefined,
        { quantity: input.quantity, newLevel: stockLevel.quantityOnHand }
      );

      await this.eventService.emit(input.tenantId, 'stock_updated', {
        productId: input.productId,
        locationId: input.locationId,
        quantityOnHand: stockLevel.quantityOnHand,
        quantityAvailable: stockLevel.quantityAvailable,
      });

      await this.checkReorderPoint(input.tenantId, input.productId, input.locationId, stockLevel);

      return { stockLevel, movement: movement!, batch };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async sellStock(input: SellStockInput): Promise<{ stockLevel: StockLevel; movement: StockMovement }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const product = await this.productService.getById(input.tenantId, input.productId);
      if (!product) throw new Error('Product not found');

      const currentLevel = await this.getStockLevel(input.tenantId, input.productId, input.locationId);
      if (!currentLevel && !product.allowNegativeStock) {
        throw new Error('No stock available at this location');
      }
      if (currentLevel && !product.allowNegativeStock && currentLevel.quantityAvailable < input.quantity) {
        throw new Error('Insufficient stock available');
      }

      let batchId: string | undefined;
      let costPerUnit: number | undefined;

      if (product.inventoryStrategy === 'FIFO' || product.inventoryStrategy === 'LIFO') {
        const batchResult = await this.consumeBatch(
          client, input.tenantId, input.productId, input.locationId,
          input.quantity, product.inventoryStrategy
        );
        batchId = batchResult?.batchId;
        costPerUnit = batchResult?.costPerUnit;
      }

      const stockLevel = await this.updateStockLevel(
        client, input.tenantId, input.productId, input.locationId,
        -input.quantity, 0
      );

      const movementId = uuidv4();
      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, batch_id, cost_per_unit, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [movementId, input.tenantId, input.productId, input.locationId, 'sale',
         input.quantity, input.referenceType || 'sale', input.referenceId || null,
         batchId || null, costPerUnit || null, input.performedBy]
      );

      await client.query('COMMIT');

      const movement = await this.getMovementById(input.tenantId, movementId);

      await this.eventService.emit(input.tenantId, 'stock_updated', {
        productId: input.productId,
        locationId: input.locationId,
        quantityOnHand: stockLevel.quantityOnHand,
        quantityAvailable: stockLevel.quantityAvailable,
        channelId: input.channelId,
      });

      await this.checkReorderPoint(input.tenantId, input.productId, input.locationId, stockLevel);

      return { stockLevel, movement: movement! };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async adjustStock(input: StockAdjustmentInput): Promise<{ stockLevel: StockLevel; movement: StockMovement }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const previousLevel = await this.getStockLevel(input.tenantId, input.productId, input.locationId);
      const movementType: StockMovementType = input.quantityChange >= 0 ? 'adjustment_increase' : 'adjustment_decrease';

      const stockLevel = await this.updateStockLevel(
        client, input.tenantId, input.productId, input.locationId,
        input.quantityChange, 0
      );

      const movementId = uuidv4();
      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reason, cost_per_unit, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [movementId, input.tenantId, input.productId, input.locationId, movementType,
         Math.abs(input.quantityChange), input.reason, input.costPerUnit || null, input.performedBy]
      );

      await client.query('COMMIT');

      const movement = await this.getMovementById(input.tenantId, movementId);

      await this.auditService.log(
        input.tenantId, 'stock_level', `${input.productId}:${input.locationId}`,
        'adjust', input.performedBy,
        { quantityOnHand: previousLevel?.quantityOnHand || 0 },
        { quantityOnHand: stockLevel.quantityOnHand },
        input.reason
      );

      await this.eventService.emit(input.tenantId, 'stock_updated', {
        productId: input.productId,
        locationId: input.locationId,
        quantityOnHand: stockLevel.quantityOnHand,
        quantityAvailable: stockLevel.quantityAvailable,
      });

      return { stockLevel, movement: movement! };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createTransfer(input: CreateTransferInput): Promise<StockTransfer> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentLevel = await this.getStockLevel(input.tenantId, input.productId, input.fromLocationId);
      if (!currentLevel || currentLevel.quantityAvailable < input.quantity) {
        throw new Error('Insufficient stock for transfer');
      }

      const transferId = uuidv4();
      const result = await client.query(
        `INSERT INTO cb4_stock_transfers 
         (id, tenant_id, product_id, from_location_id, to_location_id, quantity, initiated_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [transferId, input.tenantId, input.productId, input.fromLocationId,
         input.toLocationId, input.quantity, input.initiatedBy, input.notes || null]
      );

      await this.updateStockLevel(
        client, input.tenantId, input.productId, input.fromLocationId,
        -input.quantity, 0
      );

      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), input.tenantId, input.productId, input.fromLocationId, 'transfer_out',
         input.quantity, 'transfer', transferId, input.initiatedBy]
      );

      await this.updateInTransit(
        client, input.tenantId, input.productId, input.toLocationId, input.quantity
      );

      await client.query('COMMIT');

      await this.eventService.emit(input.tenantId, 'transfer_initiated', {
        transferId,
        productId: input.productId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        quantity: input.quantity,
      });

      return this.mapTransfer(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeTransfer(tenantId: string, transferId: string, performedBy: string): Promise<StockTransfer> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const transferResult = await client.query(
        `SELECT * FROM cb4_stock_transfers WHERE id = $1 AND tenant_id = $2`,
        [transferId, tenantId]
      );
      if (transferResult.rows.length === 0) throw new Error('Transfer not found');
      const transfer = this.mapTransfer(transferResult.rows[0]);
      if (transfer.status !== 'pending' && transfer.status !== 'in_transit') {
        throw new Error('Transfer cannot be completed');
      }

      await client.query(
        `UPDATE cb4_stock_transfers SET status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [transferId]
      );

      await this.updateStockLevel(
        client, tenantId, transfer.productId, transfer.toLocationId,
        transfer.quantity, 0
      );

      await this.updateInTransit(
        client, tenantId, transfer.productId, transfer.toLocationId, -transfer.quantity
      );

      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), tenantId, transfer.productId, transfer.toLocationId, 'transfer_in',
         transfer.quantity, 'transfer', transferId, performedBy]
      );

      await client.query('COMMIT');

      await this.eventService.emit(tenantId, 'transfer_completed', {
        transferId,
        productId: transfer.productId,
        toLocationId: transfer.toLocationId,
        quantity: transfer.quantity,
      });

      const updatedResult = await pool.query(
        'SELECT * FROM cb4_stock_transfers WHERE id = $1',
        [transferId]
      );
      return this.mapTransfer(updatedResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createReservation(input: CreateReservationInput): Promise<Reservation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentLevel = await this.getStockLevel(input.tenantId, input.productId, input.locationId);
      if (!currentLevel || currentLevel.quantityAvailable < input.quantity) {
        throw new Error('Insufficient stock for reservation');
      }

      const reservationId = uuidv4();
      const result = await client.query(
        `INSERT INTO cb4_reservations 
         (id, tenant_id, product_id, location_id, channel_id, quantity, 
          reference_type, reference_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [reservationId, input.tenantId, input.productId, input.locationId,
         input.channelId, input.quantity, input.referenceType, input.referenceId,
         input.expiresAt || null]
      );

      await this.updateStockLevel(
        client, input.tenantId, input.productId, input.locationId,
        0, input.quantity
      );

      await client.query('COMMIT');

      await this.eventService.emit(input.tenantId, 'reservation_created', {
        reservationId,
        productId: input.productId,
        locationId: input.locationId,
        channelId: input.channelId,
        quantity: input.quantity,
      });

      return this.mapReservation(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async fulfillReservation(tenantId: string, reservationId: string, performedBy: string): Promise<Reservation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM cb4_reservations WHERE id = $1 AND tenant_id = $2`,
        [reservationId, tenantId]
      );
      if (result.rows.length === 0) throw new Error('Reservation not found');
      const reservation = this.mapReservation(result.rows[0]);
      if (reservation.status !== 'active') throw new Error('Reservation is not active');

      await client.query(
        `UPDATE cb4_reservations SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [reservationId]
      );

      await this.updateStockLevel(
        client, tenantId, reservation.productId, reservation.locationId,
        -reservation.quantity, -reservation.quantity
      );

      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [uuidv4(), tenantId, reservation.productId, reservation.locationId, 'sale',
         reservation.quantity, 'reservation', reservationId, performedBy]
      );

      await client.query('COMMIT');

      await this.eventService.emit(tenantId, 'reservation_fulfilled', {
        reservationId,
        productId: reservation.productId,
        quantity: reservation.quantity,
      });

      const updated = await pool.query(
        'SELECT * FROM cb4_reservations WHERE id = $1',
        [reservationId]
      );
      return this.mapReservation(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelReservation(tenantId: string, reservationId: string, performedBy: string): Promise<Reservation> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT * FROM cb4_reservations WHERE id = $1 AND tenant_id = $2`,
        [reservationId, tenantId]
      );
      if (result.rows.length === 0) throw new Error('Reservation not found');
      const reservation = this.mapReservation(result.rows[0]);
      if (reservation.status !== 'active') throw new Error('Reservation is not active');

      await client.query(
        `UPDATE cb4_reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [reservationId]
      );

      await this.updateStockLevel(
        client, tenantId, reservation.productId, reservation.locationId,
        0, -reservation.quantity
      );

      await client.query(
        `INSERT INTO cb4_stock_movements 
         (id, tenant_id, product_id, location_id, movement_type, quantity, 
          reference_type, reference_id, reason, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [uuidv4(), tenantId, reservation.productId, reservation.locationId, 'reservation_release',
         reservation.quantity, 'reservation', reservationId, 'Reservation cancelled', performedBy]
      );

      await client.query('COMMIT');

      await this.eventService.emit(tenantId, 'reservation_cancelled', {
        reservationId,
        productId: reservation.productId,
        quantity: reservation.quantity,
      });

      const updated = await pool.query(
        'SELECT * FROM cb4_reservations WHERE id = $1',
        [reservationId]
      );
      return this.mapReservation(updated.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getMovements(
    tenantId: string,
    filters?: { productId?: string; locationId?: string; movementType?: string; fromDate?: Date; toDate?: Date }
  ): Promise<StockMovement[]> {
    let query = 'SELECT * FROM cb4_stock_movements WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }
    if (filters?.locationId) {
      query += ` AND location_id = $${paramIndex++}`;
      params.push(filters.locationId);
    }
    if (filters?.movementType) {
      query += ` AND movement_type = $${paramIndex++}`;
      params.push(filters.movementType);
    }
    if (filters?.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(filters.fromDate);
    }
    if (filters?.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(filters.toDate);
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapMovement);
  }

  async getTransfers(tenantId: string, filters?: { status?: string; productId?: string }): Promise<StockTransfer[]> {
    let query = 'SELECT * FROM cb4_stock_transfers WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }

    query += ' ORDER BY initiated_at DESC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapTransfer);
  }

  async getReservations(tenantId: string, filters?: { status?: string; productId?: string; channelId?: string }): Promise<Reservation[]> {
    let query = 'SELECT * FROM cb4_reservations WHERE tenant_id = $1';
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (filters?.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters?.productId) {
      query += ` AND product_id = $${paramIndex++}`;
      params.push(filters.productId);
    }
    if (filters?.channelId) {
      query += ` AND channel_id = $${paramIndex++}`;
      params.push(filters.channelId);
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows.map(this.mapReservation);
  }

  private async updateStockLevel(
    client: DbClient, 
    tenantId: string, 
    productId: string, 
    locationId: string,
    quantityChange: number,
    reservedChange: number
  ): Promise<StockLevel> {
    const result = await client.query(
      `INSERT INTO cb4_stock_levels 
       (id, tenant_id, product_id, location_id, quantity_on_hand, quantity_reserved, quantity_available)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, product_id, location_id) 
       DO UPDATE SET 
         quantity_on_hand = cb4_stock_levels.quantity_on_hand + $5,
         quantity_reserved = cb4_stock_levels.quantity_reserved + $6,
         quantity_available = cb4_stock_levels.quantity_on_hand + $5 - (cb4_stock_levels.quantity_reserved + $6),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [uuidv4(), tenantId, productId, locationId, quantityChange, reservedChange,
       quantityChange - reservedChange]
    );
    return this.mapStockLevel(result.rows[0]);
  }

  private async updateInTransit(
    client: DbClient,
    tenantId: string,
    productId: string,
    locationId: string,
    quantity: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO cb4_stock_levels 
       (id, tenant_id, product_id, location_id, quantity_in_transit)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, product_id, location_id) 
       DO UPDATE SET 
         quantity_in_transit = cb4_stock_levels.quantity_in_transit + $5,
         updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), tenantId, productId, locationId, quantity]
    );
  }

  private async consumeBatch(
    client: DbClient,
    tenantId: string,
    productId: string,
    locationId: string,
    quantity: number,
    strategy: InventoryStrategy
  ): Promise<{ batchId: string; costPerUnit: number } | undefined> {
    const orderBy = strategy === 'FIFO' ? 'received_at ASC' : 'received_at DESC';
    const batches = await client.query(
      `SELECT * FROM cb4_stock_batches 
       WHERE tenant_id = $1 AND product_id = $2 AND location_id = $3 AND quantity > 0
       ORDER BY ${orderBy}`,
      [tenantId, productId, locationId]
    );

    if (batches.rows.length === 0) return undefined;

    let remaining = quantity;
    let totalCost = new Decimal(0);
    let firstBatchId = batches.rows[0].id;

    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const consume = Math.min(remaining, Number(batch.quantity));
      totalCost = totalCost.plus(new Decimal(consume).times(batch.cost_per_unit || 0));
      remaining -= consume;

      await client.query(
        `UPDATE cb4_stock_batches SET quantity = quantity - $1 WHERE id = $2`,
        [consume, batch.id]
      );
    }

    return {
      batchId: firstBatchId,
      costPerUnit: totalCost.dividedBy(quantity).toNumber(),
    };
  }

  private async checkReorderPoint(
    tenantId: string,
    productId: string,
    locationId: string,
    stockLevel: StockLevel
  ): Promise<void> {
    const product = await this.productService.getById(tenantId, productId);
    if (!product?.reorderPoint) return;

    if (stockLevel.quantityAvailable <= 0) {
      await this.eventService.emit(tenantId, 'stock_out', {
        productId,
        locationId,
        sku: product.sku,
        productName: product.name,
      });
    } else if (stockLevel.quantityAvailable <= product.reorderPoint) {
      await this.eventService.emit(tenantId, 'stock_low', {
        productId,
        locationId,
        sku: product.sku,
        productName: product.name,
        currentStock: stockLevel.quantityAvailable,
        reorderPoint: product.reorderPoint,
        reorderQuantity: product.reorderQuantity,
      });
    }
  }

  private async getMovementById(tenantId: string, id: string): Promise<StockMovement | null> {
    const result = await pool.query(
      'SELECT * FROM cb4_stock_movements WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0 ? this.mapMovement(result.rows[0]) : null;
  }

  private mapStockLevel(row: Record<string, unknown>): StockLevel {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      productId: row.product_id as string,
      locationId: row.location_id as string,
      quantityOnHand: Number(row.quantity_on_hand),
      quantityReserved: Number(row.quantity_reserved),
      quantityAvailable: Number(row.quantity_available),
      quantityInTransit: Number(row.quantity_in_transit),
      lastCountedAt: row.last_counted_at ? new Date(row.last_counted_at as string) : undefined,
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapMovement(row: Record<string, unknown>): StockMovement {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      productId: row.product_id as string,
      locationId: row.location_id as string,
      movementType: row.movement_type as StockMovementType,
      quantity: Number(row.quantity),
      referenceType: row.reference_type as string | undefined,
      referenceId: row.reference_id as string | undefined,
      batchId: row.batch_id as string | undefined,
      costPerUnit: row.cost_per_unit ? Number(row.cost_per_unit) : undefined,
      reason: row.reason as string | undefined,
      performedBy: row.performed_by as string,
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapTransfer(row: Record<string, unknown>): StockTransfer {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      productId: row.product_id as string,
      fromLocationId: row.from_location_id as string,
      toLocationId: row.to_location_id as string,
      quantity: Number(row.quantity),
      status: row.status as 'pending' | 'in_transit' | 'completed' | 'cancelled',
      initiatedBy: row.initiated_by as string,
      initiatedAt: new Date(row.initiated_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      notes: row.notes as string | undefined,
    };
  }

  private mapReservation(row: Record<string, unknown>): Reservation {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      productId: row.product_id as string,
      locationId: row.location_id as string,
      channelId: row.channel_id as string,
      quantity: Number(row.quantity),
      status: row.status as ReservationStatus,
      referenceType: row.reference_type as string,
      referenceId: row.reference_id as string,
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapBatch(row: Record<string, unknown>): StockBatch {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      productId: row.product_id as string,
      locationId: row.location_id as string,
      batchNumber: row.batch_number as string,
      quantity: Number(row.quantity),
      costPerUnit: Number(row.cost_per_unit),
      expiryDate: row.expiry_date ? new Date(row.expiry_date as string) : undefined,
      receivedAt: new Date(row.received_at as string),
      createdAt: new Date(row.created_at as string),
    };
  }
}
