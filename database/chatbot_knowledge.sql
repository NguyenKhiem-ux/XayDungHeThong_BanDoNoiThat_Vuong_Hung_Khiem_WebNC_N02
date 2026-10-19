-- Additive setup only. Run against the existing shop database; no existing table is altered.
CREATE TABLE IF NOT EXISTS chatbot_knowledge (
  id BIGINT NOT NULL AUTO_INCREMENT,
  question VARCHAR(1000) NOT NULL,
  answer TEXT NOT NULL,
  keywords VARCHAR(1000) NOT NULL DEFAULT '',
  question_key CHAR(64) NOT NULL,
  context_hash VARCHAR(64) NOT NULL DEFAULT '',
  status ENUM('pending', 'approved', 'rejected', 'pending_review') NOT NULL DEFAULT 'pending',
  usage_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chatbot_question_context (question_key, context_hash),
  KEY idx_chatbot_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
