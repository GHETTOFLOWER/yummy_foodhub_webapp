-- Apply once to the existing database before deploying the delivery routes.
-- Expand role/order status without deleting existing user or order values.
ALTER TABLE users
  MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'customer';

ALTER TABLE orders
  MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending';

-- Link a rider profile to a login account. Existing rider records are retained.
ALTER TABLE delivery_riders
  ADD COLUMN user_id INT NULL,
  ADD UNIQUE KEY uq_delivery_riders_user_id (user_id);

-- Backfill profiles for all existing rider accounts. New rider roles are
-- provisioned by the triggers below; existing profiles keep their phone/status.
INSERT INTO delivery_riders (user_id, rider_name, status)
SELECT u.id, u.name, 'available'
FROM users u
LEFT JOIN delivery_riders r ON r.user_id = u.id
WHERE u.role = 'rider' AND r.id IS NULL;

-- Keep rider profiles in sync when accounts are created or promoted to rider.
DROP TRIGGER IF EXISTS users_sync_delivery_rider_after_insert;
DROP TRIGGER IF EXISTS users_sync_delivery_rider_after_update;

DELIMITER $$
CREATE TRIGGER users_sync_delivery_rider_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'rider' THEN
    INSERT INTO delivery_riders (user_id, rider_name, status)
    VALUES (NEW.id, NEW.name, 'available')
    ON DUPLICATE KEY UPDATE rider_name = VALUES(rider_name);
  END IF;
END$$

CREATE TRIGGER users_sync_delivery_rider_after_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  IF NEW.role = 'rider' THEN
    INSERT INTO delivery_riders (user_id, rider_name, status)
    VALUES (NEW.id, NEW.name, 'available')
    ON DUPLICATE KEY UPDATE rider_name = VALUES(rider_name);
  END IF;
END$$
DELIMITER ;

-- Keep the existing delivery rows and add timestamps for each rider milestone.
ALTER TABLE deliveries
  MODIFY COLUMN delivery_status ENUM('assigned', 'picked_up', 'out_for_delivery', 'delivered')
    NOT NULL DEFAULT 'assigned',
  ADD COLUMN assigned_at DATETIME NULL,
  ADD COLUMN picked_up_at DATETIME NULL,
  ADD COLUMN out_for_delivery_at DATETIME NULL,
  ADD INDEX idx_deliveries_rider_status (rider_id, delivery_status),
  ADD INDEX idx_deliveries_order_id (order_id);

-- Normalize availability to the existing active delivery assignments.
UPDATE delivery_riders r
SET r.status = CASE
  WHEN EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.rider_id = r.id AND d.delivery_status IN ('assigned', 'picked_up', 'out_for_delivery')
  ) THEN 'busy'
  ELSE 'available'
END;

-- Record order and delivery stage transitions for customer/admin history views.
CREATE TABLE IF NOT EXISTS order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  changed_by INT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_status_history_order (order_id, changed_at)
);

-- Set an existing account's role to rider. The trigger creates its profile.
-- UPDATE users SET role = 'rider' WHERE email = 'rider@example.com';
