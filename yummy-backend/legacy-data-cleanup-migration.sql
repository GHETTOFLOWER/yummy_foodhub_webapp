-- Back up the database before applying this migration. It permanently removes
-- legacy fields and a retired table; order and menu records are retained.

DROP PROCEDURE IF EXISTS drop_legacy_feature_column;

DELIMITER $$
CREATE PROCEDURE drop_legacy_feature_column(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64)
)
BEGIN
  DECLARE finished INT DEFAULT 0;
  DECLARE foreign_key_name VARCHAR(64);
  DECLARE foreign_keys CURSOR FOR
    SELECT constraint_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE table_schema = DATABASE()
      AND table_name = target_table
      AND column_name = target_column
      AND referenced_table_name IS NOT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = 1;

  IF EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE table_schema = DATABASE()
      AND table_name = target_table
      AND column_name = target_column
  ) THEN
    OPEN foreign_keys;
    drop_foreign_keys: LOOP
      FETCH foreign_keys INTO foreign_key_name;
      IF finished = 1 THEN
        LEAVE drop_foreign_keys;
      END IF;
      SET @drop_foreign_key_sql = CONCAT(
        'ALTER TABLE `', REPLACE(target_table, '`', '``'),
        '` DROP FOREIGN KEY `', REPLACE(foreign_key_name, '`', '``'), '`'
      );
      PREPARE drop_foreign_key_statement FROM @drop_foreign_key_sql;
      EXECUTE drop_foreign_key_statement;
      DEALLOCATE PREPARE drop_foreign_key_statement;
    END LOOP;
    CLOSE foreign_keys;

    SET @drop_column_sql = CONCAT(
      'ALTER TABLE `', REPLACE(target_table, '`', '``'),
      '` DROP COLUMN `', REPLACE(target_column, '`', '``'), '`'
    );
    PREPARE drop_column_statement FROM @drop_column_sql;
    EXECUTE drop_column_statement;
    DEALLOCATE PREPARE drop_column_statement;
  END IF;
END$$
DELIMITER ;

CALL drop_legacy_feature_column('menu_items', 'seller_user_id');
CALL drop_legacy_feature_column('menu_items', 'creator_user_id');
CALL drop_legacy_feature_column('menu_items', 'listing_type');
CALL drop_legacy_feature_column('menu_items', 'preparation_steps');
CALL drop_legacy_feature_column('order_items', 'seller_user_id');
CALL drop_legacy_feature_column('order_items', 'commission_amount');
CALL drop_legacy_feature_column('order_items', 'seller_amount');

DROP PROCEDURE drop_legacy_feature_column;
DROP TABLE IF EXISTS recipe_ingredients;
