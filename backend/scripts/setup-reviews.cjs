const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

async function upgradeReviews(connection) {
  await connection.query(readFileSync(resolve(__dirname, '../../database/product_reviews.sql'), 'utf8'));
  const [columns] = await connection.query('SHOW COLUMNS FROM product_reviews');
  if (['id', 'product_id', 'user_id', 'order_id', 'rating', 'comment', 'created_at', 'updated_at'].some(name => !columns.some(column => column.Field === name))) throw { code: 'INCOMPATIBLE_REVIEW_SCHEMA' };
  const [indexes] = await connection.query('SHOW INDEX FROM product_reviews');
  const unique = indexes.filter(index => index.Key_name === 'UQ_review_buyer_product');
  if (unique.length !== 2 || unique.some(index => Number(index.Non_unique) !== 0) || unique.map(index => index.Column_name).join(',') !== 'user_id,product_id') throw { code: 'MISSING_REVIEW_UNIQUE' };
}

async function setup() {
  process.loadEnvFile(resolve(__dirname, '../.env'));
  const connection = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }, connectTimeout: 10000, charset: 'utf8mb4' });
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('giadung_reviews_upgrade', 10) AS acquired");
    if (Number(lock.acquired) !== 1) throw { code: 'MIGRATION_BUSY' };
    await upgradeReviews(connection); console.log('Product review schema ready. Existing orders, products and accounts preserved.');
  } finally { await connection.query("SELECT RELEASE_LOCK('giadung_reviews_upgrade')").catch(() => {}); await connection.end(); }
}
module.exports = { upgradeReviews };
if (require.main === module) setup().catch(error => { console.error('Review migration failed: ' + (error.code || 'UNKNOWN')); process.exitCode = 1; });
