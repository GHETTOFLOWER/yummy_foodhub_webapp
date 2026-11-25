CREATE TABLE IF NOT EXISTS food_reviews (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_food_reviews_user_item (user_id, menu_item_id),
  KEY idx_food_reviews_menu_item (menu_item_id),
  CONSTRAINT fk_food_reviews_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_food_reviews_menu_item
    FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE,
  CONSTRAINT chk_food_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
