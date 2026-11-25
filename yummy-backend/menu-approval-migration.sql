-- menu_items.is_active already exists in this database; no ALTER is needed.

CREATE TABLE IF NOT EXISTS menu_change_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_item_id INT UNSIGNED NULL,
  requested_by INT UNSIGNED NOT NULL,
  reviewed_by INT UNSIGNED NULL,
  action_type VARCHAR(16) NOT NULL,
  proposed_data LONGTEXT NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_menu_change_requests_status_created (status, created_at),
  KEY idx_menu_change_requests_item_status (menu_item_id, status),
  CONSTRAINT fk_menu_change_requests_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE SET NULL,
  CONSTRAINT fk_menu_change_requests_requester
    FOREIGN KEY (requested_by) REFERENCES users (id),
  CONSTRAINT fk_menu_change_requests_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_change_request_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  previous_status VARCHAR(24) NULL,
  new_status VARCHAR(24) NOT NULL,
  changed_by INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_change_request_history_request (request_id, created_at),
  CONSTRAINT fk_menu_change_history_request
    FOREIGN KEY (request_id) REFERENCES menu_change_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_menu_change_history_user
    FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;
