-- New installations. Existing installations must run backend/scripts/setup-chatbot.cjs for the additive upgrade.
CREATE TABLE IF NOT EXISTS chatbot_knowledge (
  id BIGINT NOT NULL AUTO_INCREMENT,
  question VARCHAR(1000) NOT NULL,
  normalized_question VARCHAR(1000) NOT NULL DEFAULT '',
  answer TEXT NOT NULL,
  intent VARCHAR(40) NOT NULL DEFAULT 'unknown',
  confidence_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  risk_level ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'HIGH',
  source ENUM('gemini','admin','system') NOT NULL DEFAULT 'system',
  should_store TINYINT NOT NULL DEFAULT 1,
  reviewed_by BIGINT NULL,
  reviewed_at DATETIME(6) NULL,
  keywords VARCHAR(1000) NOT NULL DEFAULT '',
  question_key CHAR(64) NOT NULL,
  context_hash VARCHAR(64) NOT NULL DEFAULT '',
  status ENUM('pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
  usage_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chatbot_question_context (question_key, context_hash),
  KEY idx_chatbot_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
