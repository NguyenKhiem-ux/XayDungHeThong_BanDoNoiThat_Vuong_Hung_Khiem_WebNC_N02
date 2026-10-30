const { mysqlSsl } = require('./db-ssl.cjs');
const { resolve } = require('node:path');

// Chỉ thêm index (không đổi dữ liệu) cho bộ lọc danh mục của trang danh sách sản phẩm.
async function upgradeProductIndexes(connection) {
  const [indexes] = await connection.query('SHOW INDEX FROM products');
  if (!indexes.some(index => index.Key_name === 'IX_products_category')) await connection.query('ALTER TABLE products ADD INDEX IX_products_category (category)');
  const [after] = await connection.query('SHOW INDEX FROM products');
  const category = after.filter(index => index.Key_name === 'IX_products_category');
  if (category.length !== 1 || category[0].Column_name !== 'category') throw { code: 'INCOMPATIBLE_PRODUCT_INDEX' };
}

async function setup() {
  process.loadEnvFile(resolve(__dirname, '../.env'));
  const connection = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    ssl: mysqlSsl(), connectTimeout: 10000, charset: 'utf8mb4' });
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('giadung_products_index_upgrade', 10) AS acquired");
    if (Number(lock.acquired) !== 1) throw { code: 'MIGRATION_BUSY' };
    await upgradeProductIndexes(connection); console.log('Product indexes ready. Existing products preserved.');
  } finally { await connection.query("SELECT RELEASE_LOCK('giadung_products_index_upgrade')").catch(() => {}); await connection.end(); }
}
module.exports = { upgradeProductIndexes };
if (require.main === module) setup().catch(error => { console.error('Product index migration failed: ' + (error.code || 'UNKNOWN')); process.exitCode = 1; });
