require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function main() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('Connecting to Neon host:', connStr.split('@')[1]?.split('/')[0]);
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('Connected to Neon successfully!');

    // Read and run schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('Schema tables applied to Neon.');

    // Reset transactions & goals
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM goal_jars');
    await client.query("DELETE FROM users WHERE email = 'demo@dongbank.vn' OR id = 'u_dangquangdung_01'");

    const pwHash = bcrypt.hashSync('password123', 10);
    await client.query(`
      INSERT INTO users (id, email, password_hash, full_name, account_number, balance, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      'u_dangquangdung_01',
      'demo@dongbank.vn',
      pwHash,
      'Đặng Quang Dũng',
      '8888 6868 9999',
      0,
      '0908889999',
      'user'
    ]);
    console.log('User Đặng Quang Dũng initialized with 0 balance.');

    const uRes = await client.query('SELECT id, email, full_name, balance, account_number FROM users');
    console.log('Neon users:', uRes.rows);

    const txRes = await client.query('SELECT count(*) FROM transactions');
    console.log('Neon transactions count:', txRes.rows[0].count);

    client.release();
    await pool.end();
    console.log('Neon database initialization completed successfully.');
  } catch (err) {
    console.error('Neon setup error:', err);
    process.exit(1);
  }
}

main();
