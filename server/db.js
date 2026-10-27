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

// Smart Wealth Allocation Engine (Phân bổ Ngân sách Thực tế Thị trường)
async function getWealthAllocation(userId, { strategy = 'urban_realistic', customIncome = null } = {}) {
  const summary = await getSummary(userId);
  const income = (customIncome !== null && customIncome !== undefined)
    ? Number(customIncome)
    : (summary.totalIncome > 0 ? summary.totalIncome : 0);

  let stratConfig = {
    id: 'urban_realistic',
    name: 'Chiến lược Thực tế Đô thị (55 / 25 / 20)',
    description: 'Mô hình chuẩn thị trường hiện nay: Cân đối chi phí sinh hoạt đô thị và đầu tư dài hạn bền vững.',
    needsPct: 55,
    wantsPct: 25,
    savingsPct: 20
  };

  if (strategy === 'fire' || strategy === 'fire_acceleration' || strategy === '50_20_30') {
    stratConfig = {
      id: 'fire_acceleration',
      name: 'Chiến lược Độc lập Tài chính FIRE (50 / 20 / 30)',
      description: 'Dành cho người hướng tới tự do tài chính: Tiết giảm chi tiêu hưởng thụ, tối đa hóa 30% dòng tiền đầu tư tích sản.',
      needsPct: 50,
      wantsPct: 20,
      savingsPct: 30
    };
  } else if (strategy === 'starter' || strategy === '60_25_15') {
    stratConfig = {
      id: 'starter_balanced',
      name: 'Chiến lược Nền tảng An toàn (60 / 25 / 15)',
      description: 'Phù hợp người mới khởi nghiệp hoặc chi phí nhà ở/sinh hoạt chiếm tỷ trọng lớn: Ưu tiên sự vững chắc của cuộc sống.',
      needsPct: 60,
      wantsPct: 25,
      savingsPct: 15
    };
  }

  return {
    totalIncome: income,
    strategy: stratConfig,
    needs: {
      percentage: stratConfig.needsPct,
      name: "Quỹ Vận hành Đời sống",
      label: "Chi phí Thiết yếu (Nhà ở, Ăn uống, Điện nước, Y tế)",
      advice: "Giới hạn tiền thuê nhà hoặc chi tiêu thiết yếu dưới tỷ trọng quy định để đảm bảo an toàn tài chính.",
      target: income > 0 ? Math.round(income * (stratConfig.needsPct / 100)) : 0,
      color: "#00D18F"
    },
    wants: {
      percentage: stratConfig.wantsPct,
      name: "Quỹ Nâng cấp & Phong cách sống",
      label: "Phát triển Bản thân & Linh hoạt (Học tập, Networking, Trải nghiệm)",
      advice: "Đầu tư vào kỹ năng chuyên môn và các mối quan hệ tạo ra cơ hội nghề nghiệp tương lai.",
      target: income > 0 ? Math.round(income * (stratConfig.wantsPct / 100)) : 0,
      color: "#9B8CFF"
    },
    savings: {
      percentage: stratConfig.savingsPct,
      name: "Quỹ Tích sản & Tự do Tài chính",
      label: "Đầu tư Sinh lời & Dự phòng (Quỹ khẩn cấp 6 tháng, Tích lũy)",
      advice: "Hoàn thiện Quỹ dự phòng khẩn cấp trước khi giải ngân vào các kênh đầu tư sinh lời.",
      target: income > 0 ? Math.round(income * (stratConfig.savingsPct / 100)) : 0,
      color: "#E8C57C"
    }
  };
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
  resetDatabase
};
