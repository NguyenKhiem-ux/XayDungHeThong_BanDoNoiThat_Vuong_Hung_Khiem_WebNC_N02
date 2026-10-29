const { mysqlSsl } = require('./db-ssl.cjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

async function upgradeCheckout(connection) {
  await connection.query(readFileSync(resolve(__dirname, '../../database/chatbot_checkout.sql'), 'utf8'));
  const [columns] = await connection.query('SHOW COLUMNS FROM payments');
  const additions = { payos_link_id: 'VARCHAR(64) NULL', payos_checkout_url: 'VARCHAR(500) NULL', payos_lease_until: 'DATETIME(6) NULL' };
  for (const [name, definition] of Object.entries(additions)) {
    if (!columns.some(column => column.Field === name)) await connection.query(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`);
  }
  const [indexes] = await connection.query('SHOW INDEX FROM payments');
  if (!indexes.some(index => index.Key_name === 'UQ_payment_payos_link')) await connection.query('ALTER TABLE payments ADD UNIQUE INDEX UQ_payment_payos_link (payos_link_id)');
  // Fail closed on an incompatible pre-existing table/index; do not silently claim idempotency.
  const [checkoutColumns] = await connection.query('SHOW COLUMNS FROM checkout_records');
  for (const name of ['id', 'user_id', 'snapshot', 'hash', 'state', 'order_id', 'expires_at', 'created_at']) {
    if (!checkoutColumns.some(column => column.Field === name)) throw { code: 'INCOMPATIBLE_CHECKOUT_SCHEMA' };
  }
  for (const [table, index, column] of [['checkout_records', 'PRIMARY', 'id'], ['checkout_records', 'UQ_checkout_order', 'order_id'], ['payments', 'UQ_payment_payos_link', 'payos_link_id']]) {
    const [rows] = await connection.query(`SHOW INDEX FROM ${table}`);
    const matches = rows.filter(row => row.Key_name === index);
    if (matches.length !== 1 || Number(matches[0].Non_unique) !== 0 || matches[0].Column_name !== column) throw { code: 'MISSING_UNIQUE_CONSTRAINT' };
  }
}

async function setup() {
  process.loadEnvFile(resolve(__dirname, '../.env'));
  const connection = await require('mysql2/promise').createConnection({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: mysqlSsl(),
    connectTimeout: 10000, charset: 'utf8mb4',
  });
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('giadung_checkout_upgrade', 10) AS acquired");
    if (Number(lock.acquired) !== 1) throw { code: 'MIGRATION_BUSY' };
    await upgradeCheckout(connection);
    console.log('Checkout schema ready; primary/unique constraints verified. Existing orders/payments preserved.');
  } finally {
    await connection.query("SELECT RELEASE_LOCK('giadung_checkout_upgrade')").catch(() => {});
    await connection.end();
  }
}
module.exports = { upgradeCheckout };
if (require.main === module) setup().catch(error => {
  console.error('Checkout migration failed: ' + (error.code || 'UNKNOWN') + '. Stop backend writes and inspect the schema; no automatic reset is performed.');
  process.exitCode = 1;
});
