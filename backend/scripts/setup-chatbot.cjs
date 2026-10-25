const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const mysql = require('mysql2/promise');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

async function contentFingerprint(connection) {
  const digest = createHash('sha256');
  let lastId = 0;
  let count = 0;
  for (;;) {
    const [rows] = await connection.query('SELECT id, question, answer, keywords, question_key, context_hash, usage_count, created_at, updated_at FROM chatbot_knowledge WHERE id > ? ORDER BY id LIMIT 500', [lastId]);
    if (!rows.length) break;
    for (const row of rows) digest.update(JSON.stringify(row));
    count += rows.length;
    lastId = rows.at(-1).id;
  }
  return { count, digest: digest.digest('hex') };
}

// Idempotent, additive upgrade of the existing table. Never delete/replace questions or answers.
async function upgradeKnowledge(connection, intents, normalizeQuestion) {
  const [columns] = await connection.query('SHOW COLUMNS FROM chatbot_knowledge');
  const additions = {
    normalized_question: "VARCHAR(1000) NOT NULL DEFAULT ''",
    intent: "VARCHAR(40) NOT NULL DEFAULT 'unknown'",
    confidence_score: 'TINYINT UNSIGNED NOT NULL DEFAULT 0',
    risk_level: "ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'HIGH'",
    source: "ENUM('gemini','admin','system') NOT NULL DEFAULT 'system'",
    should_store: 'TINYINT NOT NULL DEFAULT 1',
    reviewed_by: 'BIGINT NULL', reviewed_at: 'DATETIME(6) NULL',
  };
  const missing = Object.entries(additions).filter(([name]) => !columns.some(column => column.Field === name));
  if (missing.length) await connection.query('ALTER TABLE chatbot_knowledge ' + missing.map(([name, definition]) => `ADD COLUMN ${name} ${definition}`).join(', '));
  const statusType = columns.find(column => column.Field === 'status')?.Type ?? '';
  if (statusType.includes("'pending'")) {
    await connection.query("ALTER TABLE chatbot_knowledge MODIFY status ENUM('pending','pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review'");
    await connection.query("UPDATE chatbot_knowledge SET status = 'pending_review', updated_at = updated_at WHERE status = 'pending'");
    await connection.query("ALTER TABLE chatbot_knowledge MODIFY status ENUM('pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review'");
  }
  let backfilled = 0;
  let hidden = 0;
  let lastId = 0;
  for (;;) {
    const [rows] = await connection.query("SELECT id, question FROM chatbot_knowledge WHERE normalized_question = '' AND intent = 'unknown' AND id > ? ORDER BY id LIMIT 500", [lastId]);
    if (!rows.length) break;
    for (const row of rows) {
      const classification = intents.classify(row.question);
      await connection.execute('UPDATE chatbot_knowledge SET normalized_question = ?, intent = ?, risk_level = ?, should_store = ?, updated_at = updated_at WHERE id = ?',
        [normalizeQuestion(row.question), classification.intent, classification.riskLevel, classification.shouldStore ? 1 : 0, row.id]);
      lastId = row.id;
      backfilled++;
      if (!classification.shouldStore) hidden++;
    }
  }
  return { backfilled, hidden };
}

async function setup() {
  // Build first so the migration uses exactly the same classifier as the deployed backend.
  const { IntentService } = require('../dist/chat/intent.service');
  const { SmallTalkService } = require('../dist/chat/small-talk.service');
  const { normalizeQuestion } = require('../dist/chat/chat-matching');
  process.loadEnvFile(resolve(__dirname, '../.env'));
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
    connectTimeout: 10000, charset: 'utf8mb4',
  });
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('giadung_chatbot_upgrade', 10) AS acquired");
    if (lock.acquired !== 1) throw { code: 'MIGRATION_BUSY' };
    await connection.query(readFileSync(resolve(__dirname, '../../database/chatbot_knowledge.sql'), 'utf8'));
    const before = await contentFingerprint(connection);
    const result = await upgradeKnowledge(connection, new IntentService(new SmallTalkService()), normalizeQuestion);
    assert.deepEqual(await contentFingerprint(connection), before, 'Existing knowledge content changed during migration. Stop application writes and investigate.');
    const [columns] = await connection.query('SHOW COLUMNS FROM chatbot_knowledge');
    console.log('chatbot_knowledge ready: ' + columns.map(column => column.Field).join(', '));
    console.log(`Metadata backfilled: ${result.backfilled}; legacy low-value entries hidden (not deleted): ${result.hidden}.`);
    console.log(`Preservation check PASS: ${before.count} existing rows; questions, answers, keys, usage counts and timestamps unchanged.`);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('giadung_chatbot_upgrade')").catch(() => {});
    await connection.end();
  }
}

module.exports = { upgradeKnowledge };
if (require.main === module) setup().catch(error => {
  // Connection errors can include infrastructure details; print only the error code.
  console.error('Chatbot migration failed: ' + (error.code || 'UNKNOWN') + '. Build backend first; stop old backend processes before migrating.');
  process.exitCode = 1;
});
