-- Apply once to create storage for customer catering and event requests.
CREATE TABLE IF NOT EXISTS catering_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  event_type ENUM(
    'wedding',
    'birthday_party',
    'graduation_party',
    'corporate_meeting',
    'conference',
    'school_event',
    'religious_event',
    'custom_event'
  ) NOT NULL,
  event_date DATE NOT NULL,
  guest_count INT UNSIGNED NOT NULL,
  venue VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  budget DECIMAL(12, 2) NULL,
  special_requests TEXT NULL,
  status ENUM('pending', 'approved', 'rejected', 'completed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_catering_requests_customer_created (customer_id, created_at),
  INDEX idx_catering_requests_status_created (status, created_at),
  INDEX idx_catering_requests_event_date (event_date)
) ENGINE=InnoDB;
