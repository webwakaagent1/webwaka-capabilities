export type InventoryStrategy = 'FIFO' | 'LIFO' | 'AVERAGE' | 'SPECIFIC';

export type StockMovementType = 
  | 'receipt'
  | 'sale'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment_increase'
  | 'adjustment_decrease'
  | 'reservation'
  | 'reservation_release'
  | 'return'
  | 'write_off';

export type ReservationStatus = 'active' | 'fulfilled' | 'cancelled' | 'expired';

export type ChannelType = 'ecommerce' | 'pos' | 'marketplace' | 'wholesale' | 'api';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export type EventType = 
  | 'stock_updated'
  | 'stock_low'
  | 'stock_out'
  | 'reservation_created'
  | 'reservation_fulfilled'
  | 'reservation_cancelled'
  | 'transfer_initiated'
  | 'transfer_completed'
  | 'product_created'
  | 'product_updated';

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  inventoryStrategy: InventoryStrategy;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  locationType: 'warehouse' | 'store' | 'distribution_center' | 'virtual';
  address?: string;
  isActive: boolean;
  parentLocationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockLevel {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityInTransit: number;
  lastCountedAt?: Date;
  updatedAt: Date;
}

export interface StockBatch {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  batchNumber: string;
  quantity: number;
  costPerUnit: number;
  expiryDate?: Date;
  receivedAt: Date;
  createdAt: Date;
}

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  movementType: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  batchId?: string;
  costPerUnit?: number;
  reason?: string;
  performedBy: string;
  createdAt: Date;
}

export interface StockTransfer {
  id: string;
  tenantId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  initiatedBy: string;
  initiatedAt: Date;
  completedAt?: Date;
  notes?: string;
}

export interface Reservation {
  id: string;
  tenantId: string;
  productId: string;
  locationId: string;
  channelId: string;
  quantity: number;
  status: ReservationStatus;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  channelType: ChannelType;
  webhookUrl?: string;
  apiKey?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelSubscription {
  id: string;
  tenantId: string;
  channelId: string;
  productId?: string;
  locationId?: string;
  eventTypes: EventType[];
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryEvent {
  id: string;
  tenantId: string;
  eventType: EventType;
  productId?: string;
  locationId?: string;
  channelId?: string;
  payload: Record<string, unknown>;
  processedAt?: Date;
  createdAt: Date;
}

export interface InventoryAuditLog {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  performedBy: string;
  reason?: string;
  createdAt: Date;
}

export interface CreateProductInput {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  trackInventory?: boolean;
  allowNegativeStock?: boolean;
  reorderPoint?: number;
  reorderQuantity?: number;
  inventoryStrategy?: InventoryStrategy;
  metadata?: Record<string, unknown>;
}

export interface CreateLocationInput {
  tenantId: string;
  code: string;
  name: string;
  locationType: 'warehouse' | 'store' | 'distribution_center' | 'virtual';
  address?: string;
  parentLocationId?: string;
}

export interface StockAdjustmentInput {
  tenantId: string;
  productId: string;
  locationId: string;
  quantityChange: number;
  reason: string;
  performedBy: string;
  costPerUnit?: number;
  batchNumber?: string;
}

export interface CreateTransferInput {
  tenantId: string;
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  initiatedBy: string;
  notes?: string;
}

export interface CreateReservationInput {
  tenantId: string;
  productId: string;
  locationId: string;
  channelId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  expiresAt?: Date;
}

export interface CreateChannelInput {
  tenantId: string;
  code: string;
  name: string;
  channelType: ChannelType;
  webhookUrl?: string;
  apiKey?: string;
}

export interface CreateSubscriptionInput {
  tenantId: string;
  channelId: string;
  productId?: string;
  locationId?: string;
  eventTypes: EventType[];
}

export interface ReceiveStockInput {
  tenantId: string;
  productId: string;
  locationId: string;
  quantity: number;
  costPerUnit: number;
  batchNumber?: string;
  expiryDate?: Date;
  performedBy: string;
  referenceType?: string;
  referenceId?: string;
}

export interface SellStockInput {
  tenantId: string;
  productId: string;
  locationId: string;
  channelId: string;
  quantity: number;
  performedBy: string;
  referenceType?: string;
  referenceId?: string;
}
