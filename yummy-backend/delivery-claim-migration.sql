-- Apply once after delivery-migration.sql when deploying rider-claimed deliveries.
-- These indexes keep the available-order lookup and claim-conflict check efficient.
ALTER TABLE orders
  ADD INDEX idx_orders_delivery_status (delivery_type, status);

ALTER TABLE deliveries
  ADD INDEX idx_deliveries_order_status (order_id, delivery_status);
