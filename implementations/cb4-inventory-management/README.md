# CB-4 Inventory Management Capability

Channel-agnostic inventory management service serving as the single source of truth for inventory across all sales channels.

## Features

- **Product Management**: Full CRUD with SKU handling, categories, and inventory settings
- **Multi-Location Support**: Warehouses, stores, distribution centers, virtual locations
- **4 Inventory Strategies**: FIFO, LIFO, Average Cost, Specific Identification
- **Stock Operations**: Receive, Sell, Adjust, Transfer (inter-location), Reserve
- **Channel Subscription**: Real-time webhook synchronization to all sales channels
- **Full Auditability**: Complete audit trail for all inventory movements

## Quick Start

```bash
npm install
npm run dev   # Runs on port 5000
npm test      # 67 tests
```

## API Endpoints

| Resource | Base Path |
|----------|-----------|
| Products | `/api/v1/products` |
| Locations | `/api/v1/locations` |
| Stock Levels | `/api/v1/inventory/stock` |
| Receive Stock | `POST /api/v1/inventory/receive` |
| Record Sale | `POST /api/v1/inventory/sell` |
| Adjust Stock | `POST /api/v1/inventory/adjust` |
| Transfers | `/api/v1/inventory/transfers` |
| Reservations | `/api/v1/inventory/reservations` |
| Channels | `/api/v1/channels` |
| Subscriptions | `/api/v1/channels/:id/subscriptions` |
| Events | `/api/v1/channels/events` |
| Audit | `/api/v1/audit` |

## Database Schema

11 tables: `cb4_products`, `cb4_locations`, `cb4_stock_levels`, `cb4_stock_batches`, `cb4_stock_movements`, `cb4_stock_transfers`, `cb4_reservations`, `cb4_channels`, `cb4_channel_subscriptions`, `cb4_inventory_events`, `cb4_inventory_audit_log`

## Inventory Strategies

| Strategy | Description |
|----------|-------------|
| FIFO | First In, First Out - oldest batch consumed first |
| LIFO | Last In, First Out - newest batch consumed first |
| AVERAGE | Weighted average cost across all batches |
| SPECIFIC | Consume specific batch by lot/batch number |

## Channel Types

- `ecommerce` - Online stores (Shopify, WooCommerce)
- `pos` - Point of sale systems
- `marketplace` - Third-party marketplaces (Amazon, Jumia)
- `wholesale` - B2B wholesale channels
- `api` - Direct API integrations

## Event Types

`stock_updated`, `stock_low`, `stock_out`, `reservation_created`, `reservation_fulfilled`, `reservation_cancelled`, `transfer_initiated`, `transfer_completed`, `product_created`, `product_updated`

## Documentation

- [Architecture](/docs/architecture/ARCH_CB4_INVENTORY_MANAGEMENT.md)
- [API Reference](/docs/api/CB4_INVENTORY_API.md)
- [Operations Runbook](/docs/runbooks/CB4_INVENTORY_OPERATIONS.md)

## Platform Invariants

- **INV-002**: Tenant Isolation - all operations scoped by tenant_id
