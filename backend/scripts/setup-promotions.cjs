const { mysqlSsl } = require('./db-ssl.cjs');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

async function upgradePromotions(connection) {
  // Older installations predate the order totals used by both checkout flows.
  const [orderColumns] = await connection.query('SHOW COLUMNS FROM orders');
  const orderAdditions = { subtotal_amount: 'DECIMAL(15,0) NOT NULL DEFAULT 0', discount_amount: 'DECIMAL(15,0) NOT NULL DEFAULT 0', coupon_code: 'VARCHAR(50) NULL' };
  const missing = Object.entries(orderAdditions).filter(([name]) => !orderColumns.some(column => column.Field === name));
  if (missing.length) await connection.query('ALTER TABLE orders ' + missing.map(([name, definition]) => `ADD COLUMN ${name} ${definition}`).join(', '));
  for (const sql of readFileSync(resolve(__dirname, '../../database/promotions.sql'), 'utf8').split(';').map(sql => sql.trim()).filter(Boolean)) await connection.query(sql);
  const [bannerColumns] = await connection.query('SHOW COLUMNS FROM promotions');
  if (!bannerColumns.some(column => column.Field === 'banner_discount_percent')) await connection.query('ALTER TABLE promotions ADD COLUMN banner_discount_percent TINYINT UNSIGNED NULL');
  for (const [table, required] of [['promotions', ['id', 'title', 'description', 'status', 'starts_at', 'ends_at']], ['promotion_items', ['id', 'promotion_id', 'product_id', 'discount_percent']], ['promotion_lock', ['id']]]) {
    const [columns] = await connection.query(`SHOW COLUMNS FROM ${table}`);
    if (required.some(name => !columns.some(column => column.Field === name))) throw { code: 'INCOMPATIBLE_PROMOTION_SCHEMA' };
  }
  const [indexes] = await connection.query('SHOW INDEX FROM promotion_items');
  const unique = indexes.filter(index => index.Key_name === 'UQ_promotion_product');
  if (unique.length !== 2 || unique.some(index => Number(index.Non_unique) !== 0)) throw { code: 'MISSING_PROMOTION_UNIQUE' };
}

async function setup() {
  process.loadEnvFile(resolve(__dirname, '../.env'));
  const connection = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: mysqlSsl(), connectTimeout: 10000, charset: 'utf8mb4' });
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('giadung_promotions_upgrade', 10) AS acquired");
    if (Number(lock.acquired) !== 1) throw { code: 'MIGRATION_BUSY' };
    await upgradePromotions(connection);
    console.log('Promotion schema ready. Existing products, orders and payments preserved.');
  } finally {
    await connection.query("SELECT RELEASE_LOCK('giadung_promotions_upgrade')").catch(() => {});
    await connection.end();
  }
}
module.exports = { upgradePromotions };
if (require.main === module) setup().catch(error => { console.error('Promotion migration failed: ' + (error.code || 'UNKNOWN')); process.exitCode = 1; });
