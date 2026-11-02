const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

let pgPool = null;
let currentDbConfig = {
  mode: 'local',
  connectionString: process.env.DATABASE_URL || '',
  lastConnectedAt: null
};

// Initial default seed data
// Initial default seed data
const isVercel = Boolean(process.env.VERCEL);
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = process.env.DB_STORAGE_PATH || (isVercel ? path.join('/tmp', 'db.json') : path.join(DATA_DIR, 'db.json'));

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Read-only filesystem warning
  }
}

// Default seed password: "password123"
const defaultHashedPassword = bcrypt.hashSync("password123", 10);

const defaultDbState = {
  users: [
    {
      id: "u_dangquangdung_01",
      email: "demo@dongbank.vn",
      password_hash: defaultHashedPassword,
      full_name: "Đặng Quang Dũng",
      account_number: "8888 6868 9999",
      balance: 0,
      phone: "0908889999",
      role: "user",
      created_at: new Date("2026-01-01").toISOString()
    }
  ],
  transactions: [],
  goalJars: []
};

// 7 Sample Demo Transactions for manual on-demand seeding
const sampleDemoTransactions = [
  {
    name: "Lương tháng 10 (Công ty Công nghệ Tech)",
    amount: 18500000,
    type: "income",
    category: "Lương",
    date: "2026-10-22",
    note: "Nhận lương kỳ 2 chuyển khoản Techcombank",
    reference_code: "FT261022001"
  },
  {
    name: "Highlands Coffee - Cà phê sáng & đối tác",
    amount: 65000,
    type: "expense",
    category: "Ăn uống",
    date: "2026-10-22",
    note: "Thanh toán quẹt thẻ tại quầy",
    reference_code: "FT261022002"
  },
  {
    name: "Grab Car di chuyển gặp khách hàng",
    amount: 85000,
    type: "expense",
    category: "Di chuyển",
    date: "2026-10-22",
    note: "Đặt xe từ Cầu Giấy về Hoàn Kiếm",
    reference_code: "FT261022003"
  },
  {
    name: "Bách Hóa Xanh - Thực phẩm gia đình",
    amount: 342000,
    type: "expense",
    category: "Mua sắm",
    date: "2026-10-21",
    note: "Mua rau củ, trái cây và gia vị",
    reference_code: "FT261021004"
  },
  {
    name: "EVN Tiền điện tháng 10",
    amount: 750000,
    type: "expense",
    category: "Hóa đơn",
    date: "2026-10-20",
    note: "Thanh toán tự động hóa đơn sinh hoạt",
    reference_code: "FT261020005"
  },
  {
    name: "Thưởng dự án quý 3",
    amount: 8000000,
    type: "income",
    category: "Thu nhập",
    date: "2026-10-18",
    note: "Thưởng KPI xuất sắc quý",
    reference_code: "FT261018006"
  },
  {
    name: "Shopee Mall - Đồ gia dụng",
    amount: 890000,
    type: "expense",
    category: "Mua sắm",
    date: "2026-10-17",
    note: "Mua sắm thiết bị bàn làm việc",
    reference_code: "FT261017007"
  }
];

// JSON Store File Operations
function readLocalDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDbState, null, 2), 'utf8');
    return defaultDbState;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Lỗi đọc file db.json, khởi tạo lại từ default state:", err);
    return defaultDbState;
  }
}

function writeLocalDb(data) {
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn("Không thể ghi file DB cục bộ:", err.message);
  }
}

// Helpers for data normalization
function normalizeTx(t) {
  if (!t) return null;
  let d = t.date;
  if (d instanceof Date) {
    d = d.toISOString().slice(0, 10);
  } else if (typeof d === 'string' && d.includes('T')) {
    d = d.slice(0, 10);
  }
  return {
    ...t,
    amount: Number(t.amount),
    date: String(d)
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    ...u,
    balance: Number(u.balance)
  };
}

// Update .env file helper
function updateEnvFile(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
    process.env[key] = value;
  } catch (err) {
    console.warn("Không thể ghi vào file .env:", err.message);
  }
}

// ==================== DYNAMIC DATABASE CONNECTION & MIGRATION ====================

// Test connection without saving
async function testConnection(connectionString) {
  if (!connectionString || !connectionString.trim()) {
    throw new Error("Chuỗi kết nối (DATABASE_URL) không được để trống!");
  }

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const tempPool = new Pool({
    connectionString: connectionString.trim(),
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 7000
  });

  const startMs = Date.now();
  let client;
  try {
    client = await tempPool.connect();
    const pingRes = await client.query('SELECT NOW() as now, current_database() as db_name, version() as version');
    const latencyMs = Date.now() - startMs;

    // Check table existence
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'transactions', 'goal_jars')
    `);
    const tables = tableRes.rows.map(r => r.table_name);

    client.release();
    await tempPool.end();

    return {
      success: true,
      latencyMs,
      database: pingRes.rows[0].db_name,
      version: pingRes.rows[0].version.split(' on ')[0],
      tables,
      hasFullSchema: tables.includes('users') && tables.includes('transactions')
    };
  } catch (err) {
    if (client) {
      try { client.release(); } catch (_) {}
    }
    try { await tempPool.end(); } catch (_) {}
    throw new Error(`Kết nối thất bại: ${err.message}`);
  }
}

// Initialize user upon connection with balance 0
async function seedPostgresIfEmpty(client) {
  const countRes = await client.query('SELECT count(*) as count FROM users');
  const userCount = parseInt(countRes.rows[0].count, 10);
  if (userCount === 0) {
    console.log("🌱 Khởi tạo tài khoản Đặng Quang Dũng bắt đầu từ con số 0...");
    const u = defaultDbState.users[0];
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, account_number, balance, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET full_name = $4, balance = 0`,
      [u.id, u.email, u.password_hash, u.full_name, u.account_number, 0, u.phone, u.role]
    );
    console.log("✅ Đã khởi tạo người dùng Đặng Quang Dũng thành công (Số dư: 0₫, 0 giao dịch)!");
  } else {
    // Sync existing users to Đặng Quang Dũng
    await client.query(
      `UPDATE users SET full_name = 'Đặng Quang Dũng' WHERE email = 'demo@dongbank.vn' OR id = 'u_minhanh_01' OR id = 'u_dangquangdung_01'`
    );
  }
}

// Initialize PostgreSQL Pool
async function initPg(customConnStr = null) {
  const connStr = (customConnStr !== null ? customConnStr : (process.env.DATABASE_URL || '')).trim();

  // If empty, revert to local
  if (!connStr || connStr.toLowerCase() === 'local') {
    if (pgPool) {
      try { await pgPool.end(); } catch (_) {}
      pgPool = null;
    }
    currentDbConfig = {
      mode: 'local',
      connectionString: '',
      lastConnectedAt: new Date().toISOString()
    };
    console.log("📁 Đang sử dụng Local JSON Database (data/db.json).");
    return { success: true, mode: 'local' };
  }

  try {
    const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
    const newPool = new Pool({
      connectionString: connStr,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    newPool.on('error', (err) => {
      console.warn('⚠️ Neon PostgreSQL connection pool event:', err.message);
    });

    const client = await newPool.connect();
    console.log("✅ Đã kết nối thành công tới máy chủ PostgreSQL Database!");

    // Execute schema to ensure tables exist
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log("📋 Đã đồng bộ Schema (users, transactions, goal_jars, indexes).");
    }

    // Seed if empty
    await seedPostgresIfEmpty(client);
    client.release();

    // Close previous pool if switching
    if (pgPool && pgPool !== newPool) {
      try { await pgPool.end(); } catch (_) {}
    }

    pgPool = newPool;
    currentDbConfig = {
      mode: 'postgres',
      connectionString: connStr,
      lastConnectedAt: new Date().toISOString()
    };

    return { success: true, mode: 'postgres' };
  } catch (err) {
    console.warn("⚠️ Kết nối PostgreSQL thất bại, chuyển về Local Database:", err.message);
    if (pgPool) {
      try { await pgPool.end(); } catch (_) {}
      pgPool = null;
    }
    currentDbConfig = {
      mode: 'local',
      connectionString: '',
      lastConnectedAt: new Date().toISOString(),
      error: err.message
    };
    return { success: false, mode: 'local', error: err.message };
  }
}

// Connect / Switch database live and optionally persist to .env
async function connectDatabase(connectionString, { persist = true } = {}) {
  const trimmed = (connectionString || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'local') {
    await initPg('');
    if (persist) updateEnvFile('DATABASE_URL', '');
    return {
      success: true,
      mode: 'local',
      message: 'Đã chuyển về Local Database (data/db.json) an toàn.'
    };
  }

  // Test first
  const testInfo = await testConnection(trimmed);
  // Then init
  const initRes = await initPg(trimmed);
  if (!initRes.success) {
    throw new Error(initRes.error || "Không thể khởi tạo kết nối cơ sở dữ liệu");
  }

  if (persist) {
    updateEnvFile('DATABASE_URL', trimmed);
  }

  return {
    success: true,
    mode: 'postgres',
    database: testInfo.database,
    version: testInfo.version,
    latencyMs: testInfo.latencyMs,
    message: `Đã kết nối thành công tới Database [${testInfo.database}] (${testInfo.latencyMs}ms)`
  };
}

// Get comprehensive live DB status
async function getDbStatus() {
  if (pgPool) {
    try {
      const client = await pgPool.connect();
      const meta = await client.query(`
        SELECT 
          current_database() as db_name, 
          current_user as db_user,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port
      `);
      const uCount = await client.query('SELECT count(*) as count FROM users');
      const txCount = await client.query('SELECT count(*) as count FROM transactions');
      client.release();

      let safeHost = meta.rows[0].server_ip || 'PostgreSQL Server';
      const conn = currentDbConfig.connectionString || '';
      if (conn.includes('neon.tech')) {
        safeHost = 'Neon Cloud PostgreSQL (AWS Serverless)';
      }

      return {
        mode: 'postgres',
        connected: true,
        provider: conn.includes('neon.tech') ? 'Neon Serverless Cloud' : 'PostgreSQL Dedicated',
        database: meta.rows[0].db_name,
        user: meta.rows[0].db_user,
        host: safeHost,
        port: meta.rows[0].server_port || 5432,
        ssl: true,
        userCount: parseInt(uCount.rows[0].count, 10),
        transactionCount: parseInt(txCount.rows[0].count, 10),
        message: '🟢 Đang hoạt động trên máy chủ PostgreSQL đám mây (Neon Cloud)',
        lastConnectedAt: currentDbConfig.lastConnectedAt
      };
    } catch (err) {
      return {
        mode: 'postgres',
        connected: false,
        error: err.message,
        message: '🔴 Mất kết nối tới PostgreSQL: ' + err.message
      };
    }
  }

  const local = readLocalDb();
  return {
    mode: 'local',
    connected: true,
    database: 'Local Persistent File (data/db.json)',
    host: 'localhost',
    userCount: local.users ? local.users.length : 0,
    transactionCount: local.transactions ? local.transactions.length : 0,
    message: '🟡 Local Database (Sẵn sàng kết nối PostgreSQL từ xa)',
    lastConnectedAt: currentDbConfig.lastConnectedAt
  };
}

// Reset database to default empty state (Balance 0, 0 transactions)
async function resetDatabase(userId = null) {
  if (pgPool) {
    if (userId) {
      await pgPool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      await pgPool.query('UPDATE users SET balance = 0 WHERE id = $1', [userId]);
      await pgPool.query('DELETE FROM goal_jars WHERE user_id = $1', [userId]);
    } else {
      await pgPool.query('DELETE FROM transactions');
      await pgPool.query('UPDATE users SET balance = 0');
      await pgPool.query('DELETE FROM goal_jars');
    }
    return {
      success: true,
      message: 'Đã reset cơ sở dữ liệu PostgreSQL về mặc định không dữ liệu, bắt đầu từ con số 0!',
      balance: 0,
      count: 0
    };
  }

  const db = readLocalDb();
  if (userId) {
    db.transactions = (db.transactions || []).filter(t => t.user_id !== userId);
    const u = (db.users || []).find(x => x.id === userId);
    if (u) {
      u.balance = 0;
    }
    db.goalJars = (db.goalJars || []).filter(j => j.user_id !== userId);
  } else {
    db.transactions = [];
    (db.users || []).forEach(u => {
      u.balance = 0;
    });
    db.goalJars = [];
  }
  writeLocalDb(db);
  return {
    success: true,
    message: 'Đã reset cơ sở dữ liệu Local về mặc định không dữ liệu, bắt đầu từ con số 0!',
    balance: 0,
    count: 0
  };
}

// Re-seed demo transactions for testing
async function seedSampleData(userId) {
  const seedTxs = sampleDemoTransactions.map(t => ({
    ...t,
    id: "TX_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    user_id: userId,
    created_at: new Date().toISOString()
  }));

  if (pgPool) {
    for (const tx of seedTxs) {
      await pgPool.query(
        `INSERT INTO transactions (id, user_id, name, amount, type, category, date, note, reference_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tx.id, tx.user_id, tx.name, tx.amount, tx.type, tx.category, tx.date, tx.note, tx.reference_code]
      );
    }
    return { count: seedTxs.length };
  }

  const db = readLocalDb();
  seedTxs.forEach(t => db.transactions.unshift(t));
  writeLocalDb(db);
  return { count: seedTxs.length };
}

// ==================== REPOSITORY FUNCTIONS ====================

// --- USER OPERATIONS ---
async function findUserByEmail(email) {
  const normEmail = (email || '').toLowerCase().trim();
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normEmail]);
    return normalizeUser(res.rows[0]) || null;
  }
  const db = readLocalDb();
  const u = db.users.find(x => x.email.toLowerCase() === normEmail);
  return normalizeUser(u) || null;
}

async function findUserById(id) {
  if (pgPool) {
    const res = await pgPool.query(
      'SELECT id, email, full_name, account_number, balance, phone, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return normalizeUser(res.rows[0]) || null;
  }
  const db = readLocalDb();
  const u = db.users.find(x => x.id === id);
  if (!u) return null;
  const { password_hash, ...safeUser } = u;
  return normalizeUser(safeUser);
}

async function savePasswordResetToken(userId, token) {
  if (pgPool) {
    const id = "pr_" + Date.now();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await pgPool.query(
      `INSERT INTO password_resets (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [id, userId, token, expiresAt]
    );
    return { id, user_id: userId, token, expires_at: expiresAt };
  }
  const db = readLocalDb();
  if (!db.passwordResets) db.passwordResets = [];
  const id = "pr_" + Date.now();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const record = { id, user_id: userId, token, expires_at: expiresAt, used: false, created_at: new Date().toISOString() };
  db.passwordResets.push(record);
  writeLocalDb(db);
  return record;
}

async function createUser({ email, password, fullName, phone }) {
  const normEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);
  const id = "u_" + Date.now();
  const accountNumber = "8888 " + Math.floor(1000 + Math.random() * 9000) + " " + Math.floor(1000 + Math.random() * 9000);
  const initialBalance = 0; // Tài khoản đăng ký mới luôn bắt đầu từ con số 0!

  if (pgPool) {
    const res = await pgPool.query(
      `INSERT INTO users (id, email, password_hash, full_name, account_number, balance, phone) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, full_name, account_number, balance, phone, role, created_at`,
      [id, normEmail, passwordHash, fullName, accountNumber, initialBalance, phone || null]
    );
    return normalizeUser(res.rows[0]);
  }

  const db = readLocalDb();
  const newUser = {
    id,
    email: normEmail,
    password_hash: passwordHash,
    full_name: fullName,
    account_number: accountNumber,
    balance: initialBalance,
    phone: phone || "",
    role: "user",
    created_at: new Date().toISOString()
  };
  db.users.push(newUser);
  writeLocalDb(db);

  const { password_hash, ...safeUser } = newUser;
  return normalizeUser(safeUser);
}

async function updateUserBalance(userId, deltaAmount) {
  if (pgPool) {
    const res = await pgPool.query(
      'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
      [deltaAmount, userId]
    );
    return res.rows[0] ? Number(res.rows[0].balance) : null;
  }
  const db = readLocalDb();
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.balance = Math.max(0, Number(user.balance) + Number(deltaAmount));
    writeLocalDb(db);
    return user.balance;
  }
  return null;
}

// --- TRANSACTIONS OPERATIONS ---
async function getTransactions(userId, { startDate, endDate, type, category, search, limit = 100 }) {
  if (pgPool) {
    let query = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [userId];
    let idx = 2;

    if (startDate) { query += ` AND date >= $${idx++}`; params.push(startDate); }
    if (endDate) { query += ` AND date <= $${idx++}`; params.push(endDate); }
    if (type && type !== 'all') { query += ` AND type = $${idx++}`; params.push(type); }
    if (category && category !== 'all') { query += ` AND category = $${idx++}`; params.push(category); }
    if (search) {
      query += ` AND (LOWER(name) LIKE $${idx} OR LOWER(note) LIKE $${idx})`;
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }
    query += ` ORDER BY date DESC, created_at DESC LIMIT $${idx}`;
    params.push(limit);

    const res = await pgPool.query(query, params);
    return res.rows.map(normalizeTx);
  }

  const db = readLocalDb();
  let list = db.transactions.filter(t => t.user_id === userId);

  if (startDate) list = list.filter(t => t.date >= startDate);
  if (endDate) list = list.filter(t => t.date <= endDate);
  if (type && type !== 'all') list = list.filter(t => t.type === type);
  if (category && category !== 'all') list = list.filter(t => t.category === category);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(t => (t.name && t.name.toLowerCase().includes(s)) || (t.note && t.note.toLowerCase().includes(s)));
  }

  list.sort((a, b) => new Date(b.date + 'T23:59:59') - new Date(a.date + 'T23:59:59'));
  return list.slice(0, limit).map(normalizeTx);
}

async function addTransaction(userId, { name, amount, type, category, date, note }) {
  const numAmount = Math.abs(Number(amount));
  const txDate = date || new Date().toISOString().slice(0, 10);
  const id = "TX_" + Date.now();
  const refCode = "FT" + Date.now().toString().slice(-8);

  // Normalize type
  const normalizedType = (type === 'income' || type === 'in') ? 'income' : 'expense';

  if (pgPool) {
    const res = await pgPool.query(
      `INSERT INTO transactions (id, user_id, name, amount, type, category, date, note, reference_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, userId, name, numAmount, normalizedType, category, txDate, note || null, refCode]
    );
    // Update balance
    const delta = normalizedType === 'income' ? numAmount : -numAmount;
    await updateUserBalance(userId, delta);
    return normalizeTx(res.rows[0]);
  }

  const db = readLocalDb();
  const newTx = {
    id,
    user_id: userId,
    name,
    amount: numAmount,
    type: normalizedType,
    category,
    date: txDate,
    note: note || "",
    reference_code: refCode,
    created_at: new Date().toISOString()
  };

  db.transactions.unshift(newTx);
  
  // Adjust balance
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.balance = normalizedType === 'income' 
      ? Number(user.balance) + numAmount 
      : Math.max(0, Number(user.balance) - numAmount);
  }
  
  writeLocalDb(db);
  return normalizeTx(newTx);
}

async function deleteTransaction(userId, txId) {
  if (pgPool) {
    const txRes = await pgPool.query('SELECT * FROM transactions WHERE id = $1 AND user_id = $2', [txId, userId]);
    if (!txRes.rows[0]) return false;
    const tx = txRes.rows[0];
    await pgPool.query('DELETE FROM transactions WHERE id = $1', [txId]);
    // Revert balance
    const delta = tx.type === 'income' ? -Number(tx.amount) : Number(tx.amount);
    await updateUserBalance(userId, delta);
    return true;
  }

  const db = readLocalDb();
  const idx = db.transactions.findIndex(t => t.id === txId && t.user_id === userId);
  if (idx === -1) return false;

  const tx = db.transactions[idx];
  db.transactions.splice(idx, 1);

  // Revert balance
  const user = db.users.find(u => u.id === userId);
  if (user) {
    user.balance = tx.type === 'income' 
      ? Math.max(0, Number(user.balance) - Number(tx.amount))
      : Number(user.balance) + Number(tx.amount);
  }

  writeLocalDb(db);
  return true;
}

// --- ANALYTICS & SUMMARY ---
async function getSummary(userId, { startDate, endDate } = {}) {
  const txs = await getTransactions(userId, { startDate, endDate, limit: 10000 });
  const user = await findUserById(userId);

  let totalIncome = 0;
  let totalExpense = 0;

  txs.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'income' || t.type === 'in') totalIncome += amt;
    else totalExpense += amt;
  });

  return {
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    currentBalance: user ? Number(user.balance) : 0,
    totalTransactions: txs.length
  };
}

async function getCategoryBreakdown(userId, { startDate, endDate } = {}) {
  const txs = await getTransactions(userId, { startDate, endDate, type: 'expense', limit: 10000 });
  const catMap = {};
  let totalExpense = 0;

  txs.forEach(t => {
    const cat = t.category || "Khác";
    const amt = Number(t.amount);
    catMap[cat] = (catMap[cat] || 0) + amt;
    totalExpense += amt;
  });

  const categories = Object.keys(catMap).map(name => {
    const amount = catMap[name];
    const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
    return { name, amount, percentage };
  });

  categories.sort((a, b) => b.amount - a.amount);
  return { totalExpense, categories };
}

async function getCashflowTrend(userId) {
  // 7 days trend
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const txs = await getTransactions(userId, { startDate: days[0], endDate: days[days.length - 1], limit: 1000 });
  
  const trend = days.map(dayStr => {
    const dayTxs = txs.filter(t => t.date === dayStr);
    let income = 0;
    let expense = 0;
    dayTxs.forEach(t => {
      if (t.type === 'income' || t.type === 'in') income += Number(t.amount);
      else expense += Number(t.amount);
    });
    const dObj = new Date(dayStr);
    const dayName = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dObj.getDay()];
    return {
      date: dayStr,
      dayName,
      income,
      expense
    };
  });

  return trend;
}

// Smart Wealth Allocation Engine (Phân bổ Động theo Phân khúc Thu nhập & Private Banking)
async function getWealthAllocation(userId, {
  strategy = null,
  customIncome = null,
  customNeeds = null,
  customWants = null,
  customSavings = null,
  emergencyBufferState = 'overflow'
} = {}) {
  const summary = await getSummary(userId);
  const income = (customIncome !== null && customIncome !== undefined)
    ? Number(customIncome)
    : (summary.totalIncome > 0 ? summary.totalIncome : 106300000);

  // Danh mục 4 Chiến lược Chuẩn thị trường & Private Banking (Định luật Engel)
  const strategies = {
    starter_safety: {
      id: 'starter_safety',
      name: 'Chiến lược Nền tảng An toàn (60 / 20 / 20)',
      shortName: 'Nền tảng An toàn (60 / 20 / 20)',
      description: 'Ưu tiên bảo vệ dòng tiền thiết yếu và xây dựng quỹ dự phòng khẩn cấp cho mức thu nhập khởi điểm.',
      needsPct: 60,
      wantsPct: 20,
      savingsPct: 20,
      recommendedRange: 'Thu nhập 15 Triệu - 25 Triệu',
      minIncome: 0,
      maxIncome: 25000000
    },
    urban_realistic: {
      id: 'urban_realistic',
      name: 'Chiến lược Cân bằng Đô thị (50 / 25 / 25)',
      shortName: 'Cân bằng Đô thị (50 / 25 / 25)',
      description: 'Mô hình cân bằng chuẩn đô thị: Đảm bảo chất lượng sống, phát triển bản thân và tích lũy bền vững.',
      needsPct: 50,
      wantsPct: 25,
      savingsPct: 25,
      recommendedRange: 'Thu nhập 25 Triệu - 45 Triệu',
      minIncome: 25000000,
      maxIncome: 50000000
    },
    wealth_acceleration: {
      id: 'wealth_acceleration',
      name: 'Chiến lược Chuẩn Private Wealth (30 / 25 / 45)',
      shortName: 'Chuẩn Private Wealth (30 / 25 / 45)',
      description: 'Chuẩn phân bổ Priority Banking theo Định luật Engel: Tối ưu hóa chi phí sinh hoạt, đẩy mạnh dòng tiền vào nhân bản tài sản.',
      needsPct: 30,
      wantsPct: 25,
      savingsPct: 45,
      recommendedRange: 'Thu nhập >= 50 Triệu (Priority Banking)',
      minIncome: 50000000,
      maxIncome: Infinity
    },
    fire_max: {
      id: 'fire_max',
      name: 'Chiến lược Tăng tốc Độc lập Tài chính FIRE (25 / 15 / 60)',
      shortName: 'Tăng tốc FIRE (25 / 15 / 60)',
      description: 'Chiến lược nén chi phí sinh hoạt xuống mức tối giản để tối đa hóa tốc độ nghỉ hưu sớm và tự do tài chính.',
      needsPct: 25,
      wantsPct: 15,
      savingsPct: 60,
      recommendedRange: 'Độc lập Tài chính & FIRE',
      minIncome: 0,
      maxIncome: Infinity
    }
  };

  // Cơ chế Đề xuất Tự động (Adaptive Tiered Presets) theo ngưỡng thu nhập
  let recommendedStrategyId = 'wealth_acceleration';
  if (income < 25000000) {
    recommendedStrategyId = 'starter_safety';
  } else if (income < 50000000) {
    recommendedStrategyId = 'urban_realistic';
  } else {
    recommendedStrategyId = 'wealth_acceleration';
  }

  // Xác định chiến lược được áp dụng
  let activeKey = strategy;
  if ((!activeKey || activeKey === 'auto') && (customNeeds !== null || customWants !== null || customSavings !== null)) {
    activeKey = 'custom';
  } else if (!activeKey || activeKey === 'auto') {
    activeKey = recommendedStrategyId;
  }

  // Tương thích ngược các alias cũ
  if (activeKey === 'starter' || activeKey === 'starter_balanced' || activeKey === '60_20_20' || activeKey === '60_25_15') {
    activeKey = 'starter_safety';
  } else if (activeKey === 'fire' || activeKey === 'fire_acceleration' || activeKey === '50_20_30' || activeKey === '25_15_60') {
    activeKey = 'fire_max';
  } else if (activeKey === 'private_wealth' || activeKey === 'wealth' || activeKey === '30_25_45') {
    activeKey = 'wealth_acceleration';
  }

  let stratConfig;
  if (activeKey === 'custom') {
    let n = customNeeds !== null && !isNaN(customNeeds) ? Math.max(5, Math.min(85, Number(customNeeds))) : 30;
    let w = customWants !== null && !isNaN(customWants) ? Math.max(5, Math.min(85, Number(customWants))) : 25;
    let s = customSavings !== null && !isNaN(customSavings) ? Math.max(5, Math.min(85, Number(customSavings))) : (100 - n - w);
    stratConfig = {
      id: 'custom',
      name: 'Chiến lược Tùy chỉnh Cá nhân (Custom Studio)',
      shortName: 'Tùy chỉnh Cá nhân',
      description: 'Bộ tỷ lệ được tinh chỉnh thủ công theo nhu cầu và phong cách chi tiêu cá nhân hóa của bạn.',
      needsPct: n,
      wantsPct: w,
      savingsPct: s,
      recommendedRange: 'Tự do tinh chỉnh'
    };
  } else {
    stratConfig = strategies[activeKey] || strategies[recommendedStrategyId];
  }

  const needsTarget = Math.round(income * (stratConfig.needsPct / 100));
  const wantsTarget = Math.round(income * (stratConfig.wantsPct / 100));
  const savingsTarget = Math.round(income * (stratConfig.savingsPct / 100));

  // Dự phóng Tích lũy Lãi kép 1 năm & 5 năm (Lãi suất 10%/năm, góp đều đặn hàng tháng)
  const rMo = 0.10 / 12;
  const projectedSavings1Y = savingsTarget > 0
    ? Math.round(savingsTarget * ((Math.pow(1 + rMo, 12) - 1) / rMo) * (1 + rMo))
    : 0;
  const projectedSavings5Y = savingsTarget > 0
    ? Math.round(savingsTarget * ((Math.pow(1 + rMo, 60) - 1) / rMo) * (1 + rMo))
    : 0;

  // Banking Micro-Metrics:
  // 1. Hạn mức chi tiêu an toàn mỗi ngày (sau khi trừ chi phí cố định)
  const dailySafeSpendNeeds = Math.round((needsTarget * 0.50) / 30);
  const dailySafeSpendWants = Math.round((wantsTarget * 0.65) / 30);

  // 2. Lợi suất dòng tiền nhàn rỗi qua đêm (Overnight Yield 3.8%/năm)
  const monthlyOvernightInterest = Math.round((needsTarget * 0.5 * 0.038) / 12);

  // Chỉ báo Sức khỏe Phân bổ & Cảnh báo Thông minh (Smart Financial Guardrails)
  let healthGuardrail = {
    status: 'optimal',
    badge: 'Đạt chuẩn Private Banking',
    title: `Cấu trúc dòng tiền tối ưu: Đạt chuẩn Private Banking & High Wealth Accumulation (${stratConfig.savingsPct}%).`,
    message: 'Dòng tiền tích sản vượt trội (≥ 35%) tạo lực đẩy lãi kép mạnh mẽ theo chuẩn các gia tộc tài phiệt và Private Wealth.'
  };

  if (stratConfig.savingsPct < 20) {
    healthGuardrail = {
      status: 'danger',
      badge: 'Cảnh báo Dưới Ngưỡng An Toàn',
      title: `Cảnh báo: Tỷ lệ tích sản dưới ngưỡng an toàn tài chính 20% (${stratConfig.savingsPct}%).`,
      message: 'Tỷ lệ tích lũy quá thấp làm chậm tiến độ đạt Quỹ khẩn cấp 6 tháng và suy giảm tốc độ gia tăng tài sản ròng.'
    };
  } else if (stratConfig.needsPct > 45 && income >= 50000000) {
    healthGuardrail = {
      status: 'warning',
      badge: 'Cảnh báo Chi phí Lấn át',
      title: `Lưu ý: Chi phí vận hành đang lấn át hiệu suất tích sản (${stratConfig.needsPct}% > 45%).`,
      message: 'Đối với phân khúc thu nhập cao, tỷ trọng sinh hoạt nên kiểm soát dưới 40% để giải phóng dòng tiền sang Lớp Tích sản & Tự do tài chính.'
    };
  } else if (stratConfig.savingsPct < 35) {
    healthGuardrail = {
      status: 'optimal',
      badge: 'Cân bằng Chuẩn Đô thị',
      title: 'Cấu trúc dòng tiền cân bằng: Đạt chuẩn quản lý tài chính đô thị lành mạnh.',
      message: 'Tỷ lệ phân bổ hài hòa giữa sinh hoạt thiết yếu, nâng tầm phong cách sống và tích lũy bền vững.'
    };
  }

  // Cấu hình Sub-Buckets cho Quỹ Tích sản theo Van tràn Quỹ Khẩn cấp (Emergency Buffer Overflow Gate)
  const isOverflow = emergencyBufferState === 'overflow';
  const savingsSubs = isOverflow ? [
    { name: "Đầu tư Tăng trưởng ETF/Cổ phiếu", percentage: 60, amount: Math.round(savingsTarget * 0.60), desc: "Tích sản chỉ số VN30/Diamond, cổ phiếu tăng trưởng (Chế độ Van tràn Overflow)" },
    { name: "Tài sản Phòng vệ Vàng & Trái phiếu AAA", percentage: 40, amount: Math.round(savingsTarget * 0.40), desc: "Vàng miếng SJC, trái phiếu tổ chức uy tín sinh lời ổn định" }
  ] : [
    { name: "Tài khoản Dự phòng Thanh khoản cao", percentage: 60, amount: Math.round(savingsTarget * 0.60), desc: "Quỹ khẩn cấp 6 tháng (Lãi suất 4.5%/năm, thanh khoản T+0)" },
    { name: "Đầu tư Tăng trưởng ETF/Cổ phiếu", percentage: 40, amount: Math.round(savingsTarget * 0.40), desc: "Tích sản chỉ số chứng khoán dài hạn" }
  ];

  return {
    totalIncome: income,
    strategy: stratConfig,
    recommendedStrategyId,
    strategiesList: Object.values(strategies),
    guardrail: healthGuardrail,
    projectedSavings1Y,
    projectedSavings5Y,
    dailySafeSpendNeeds,
    dailySafeSpendWants,
    monthlyOvernightInterest,
    emergencyBufferState,
    needs: {
      percentage: stratConfig.needsPct,
      name: "Lớp 1: Quỹ Vận hành Đời sống (Liquidity)",
      label: "Chi phí Thiết yếu & Thanh khoản (Nhà ở, Ăn uống, Hóa đơn, Y tế)",
      advice: "Giới hạn chi phí thiết yếu dưới ngưỡng quy định để đảm bảo thanh khoản an toàn.",
      target: needsTarget,
      color: "#10B981",
      dailySafeSpend: dailySafeSpendNeeds,
      monthlyOvernightYield: monthlyOvernightInterest,
      subBuckets: [
        { name: "Nhà ở & Hóa đơn", percentage: 50, amount: Math.round(needsTarget * 0.50), desc: "Tiền thuê/mua nhà, điện nước, internet sinh hoạt" },
        { name: "Ẩm thực & Sinh hoạt", percentage: 35, amount: Math.round(needsTarget * 0.35), desc: "Ăn uống dinh dưỡng, siêu thị & nhu yếu phẩm hàng ngày" },
        { name: "Y tế & Bảo hiểm", percentage: 15, amount: Math.round(needsTarget * 0.15), desc: "Bảo hiểm sức khỏe, khám định kỳ & thuốc men" }
      ]
    },
    wants: {
      percentage: stratConfig.wantsPct,
      name: "Lớp 2: Quỹ Nâng cấp & Phong cách sống (Longevity & Lifestyle)",
      label: "Phát triển Bản thân & Linh hoạt (Học tập, Networking, Trải nghiệm)",
      advice: "Đầu tư vào kỹ năng chuyên môn và các mối quan hệ tạo ra cơ hội nghề nghiệp tương lai.",
      target: wantsTarget,
      color: "#6366F1",
      dailySafeSpend: dailySafeSpendWants,
      subBuckets: [
        { name: "Đào tạo & Kỹ năng", percentage: 35, amount: Math.round(wantsTarget * 0.35), desc: "Sách, khóa học nâng cao nghiệp vụ, chứng chỉ nghề" },
        { name: "Networking & Quan hệ", percentage: 40, amount: Math.round(wantsTarget * 0.40), desc: "Cafe đối tác, duy trì và phát triển mạng lưới công việc" },
        { name: "Trải nghiệm & Giải trí", percentage: 25, amount: Math.round(wantsTarget * 0.25), desc: "Du lịch, thể thao, tái tạo năng lượng sáng tạo" }
      ]
    },
    savings: {
      percentage: stratConfig.savingsPct,
      name: "Lớp 3: Quỹ Tích sản & Tự do Tài chính (Wealth & Alpha)",
      label: "Đầu tư Sinh lời & Độc lập Tài chính (Quỹ khẩn cấp, Tích sản)",
      advice: "Hoàn thiện Quỹ dự phòng khẩn cấp trước khi giải ngân vào các kênh đầu tư sinh lời.",
      target: savingsTarget,
      color: "#F59E0B",
      projected1Y: projectedSavings1Y,
      projected5Y: projectedSavings5Y,
      subBuckets: savingsSubs
    }
  };
}

// Auto-Sweep Configuration Persistence
async function saveAutoSweepConfig(userId, config) {
  const db = readLocalDb();
  if (!db.autoSweeps) db.autoSweeps = {};
  db.autoSweeps[userId] = {
    ...config,
    userId,
    active: true,
    updatedAt: new Date().toISOString()
  };
  writeLocalDb(db);
  return db.autoSweeps[userId];
}

async function getAutoSweepConfig(userId) {
  const db = readLocalDb();
  return (db.autoSweeps && db.autoSweeps[userId]) || null;
}

// Alias for backwards compatibility
const getRule503020 = getWealthAllocation;


// --- JARS OPERATIONS ---
async function getGoalJars(userId) {
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM goal_jars WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
    return res.rows.map(r => ({
      ...r,
      target: Number(r.target_amount || r.target),
      current: Number(r.current_amount || r.current)
    }));
  }
  const db = readLocalDb();
  return (db.goalJars || []).filter(j => j.user_id === userId);
}

module.exports = {
  initPg,
  testConnection,
  connectDatabase,
  getDbStatus,
  seedSampleData,
  findUserByEmail,
  findUserById,
  createUser,
  updateUserBalance,
  getTransactions,
  addTransaction,
  deleteTransaction,
  getSummary,
  getCategoryBreakdown,
  getCashflowTrend,
  getRule503020,
  getWealthAllocation,
  getGoalJars,
  saveAutoSweepConfig,
  getAutoSweepConfig,
  savePasswordResetToken,
  resetDatabase
};
