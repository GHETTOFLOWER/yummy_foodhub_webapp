ALTER TABLE orders
  ADD COLUMN order_type ENUM('instant', 'scheduled') NOT NULL DEFAULT 'instant',
  ADD COLUMN scheduled_for DATETIME NULL,
  ADD INDEX idx_orders_scheduled_for (order_type, scheduled_for);
