-- Phase 2: durable idempotency. Additive; never reset carts/orders/payments.
CREATE TABLE IF NOT EXISTS checkout_records (
  id VARCHAR(36) NOT NULL,
  user_id BIGINT NOT NULL,
  snapshot JSON NOT NULL,
  hash CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'ready',
  order_id BIGINT NULL,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_checkout_order (order_id),
  KEY IDX_checkout_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Payment columns/index are added idempotently by backend/scripts/setup-checkout.cjs.
