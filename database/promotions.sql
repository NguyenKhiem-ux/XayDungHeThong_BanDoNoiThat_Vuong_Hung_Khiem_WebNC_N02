CREATE TABLE IF NOT EXISTS promotions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  banner_discount_percent TINYINT UNSIGNED NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX IX_promotion_schedule (status, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  product_id BIGINT NOT NULL,
  discount_percent INT NOT NULL,
  CONSTRAINT UQ_promotion_product UNIQUE (promotion_id, product_id),
  CONSTRAINT FK_promotion_item_event FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT FK_promotion_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT CK_promotion_percent CHECK (discount_percent BETWEEN 1 AND 99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_lock (id INT NOT NULL PRIMARY KEY) ENGINE=InnoDB;
INSERT IGNORE INTO promotion_lock (id) VALUES (1);
