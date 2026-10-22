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
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.DB_STORAGE_PATH || path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Default seed password: "password123"
const defaultHashedPassword = bcrypt.hashSync("password123", 10);

const defaultDbState = {
  users: [
    {
      id: "u_minhanh_01",
      email: "demo@dongbank.vn",
      password_hash: defaultHashedPassword,
      full_name: "Minh Anh",
      account_number: "8888 6868 9999",
      balance: 47250000,
      phone: "0908889999",
      role: "user",
      created_at: new Date("2026-01-01").toISOString()
    }
  ],
  transactions: [
    {
      id: "TX_101",
      user_id: "u_minhanh_01",
      name: "Lương tháng 10 (Công ty Công nghệ Tech)",
      amount: 18500000,
      type: "income",
      category: "Lương",
      date: "2026-10-22",
      note: "Nhận lương kỳ 2 chuyển khoản Techcombank",
      reference_code: "FT261022001",
      created_at: new Date("2026-10-22T08:02:00Z").toISOString()
    },
    {
      id: "TX_102",
      user_id: "u_minhanh_01",
      name: "Highlands Coffee - Cà phê sáng & đối tác",
      amount: 65000,
      type: "expense",
      category: "Ăn uống",
      date: "2026-10-22",
      note: "Thanh toán quẹt thẻ tại quầy",
      reference_code: "FT261022002",
      created_at: new Date("2026-10-22T09:15:00Z").toISOString()
    },
    {
      id: "TX_103",
      user_id: "u_minhanh_01",
      name: "Grab Car di chuyển gặp khách hàng",
      amount: 85000,
      type: "expense",
      category: "Di chuyển",
      date: "2026-10-22",
      note: "Đặt xe từ Cầu Giấy về Hoàn Kiếm",
      reference_code: "FT261022003",
      created_at: new Date("2026-10-22T10:47:00Z").toISOString()
    },
    {
      id: "TX_104",
      user_id: "u_minhanh_01",
      name: "Bách Hóa Xanh - Thực phẩm gia đình",
      amount: 342000,
      type: "expense",
      category: "Mua sắm",
      date: "2026-10-21",
      note: "Mua rau củ, trái cây và gia vị",
      reference_code: "FT261021004",
      created_at: new Date("2026-10-21T11:15:00Z").toISOString()
    },
    {
      id: "TX_105",
      user_id: "u_minhanh_01",
      name: "EVN Tiền điện tháng 10",
      amount: 750000,
      type: "expense",
      category: "Hóa đơn",
      date: "2026-10-20",
      note: "Thanh toán tự động hóa đơn sinh hoạt",
      reference_code: "FT261020005",
      created_at: new Date("2026-10-20T14:30:00Z").toISOString()
    },
    {
      id: "TX_106",
      user_id: "u_minhanh_01",
      name: "Thưởng dự án quý 3",
      amount: 8000000,
      type: "income",
      category: "Thu nhập",
      date: "2026-10-18",
      note: "Thưởng KPI xuất sắc quý",
      reference_code: "FT261018006",
      created_at: new Date("2026-10-18T16:00:00Z").toISOString()
    },
    {
      id: "TX_107",
      user_id: "u_minhanh_01",
      name: "Shopee Mall - Đồ gia dụng",
      amount: 890000,
      type: "expense",
      category: "Mua sắm",
      date: "2026-10-17",
      note: "Mua sắm thiết bị bàn làm việc",
      reference_code: "FT261017007",
      created_at: new Date("2026-10-17T19:20:00Z").toISOString()
    }
  ],
  goalJars: [
    { id: "G1", user_id: "u_minhanh_01", name: "MacBook Pro M4", current: 28800000, target: 45000000, icon: "💻", color: "#00D18F" },
    { id: "G2", user_id: "u_minhanh_01", name: "Du lịch Tokyo mùa thu", current: 15000000, target: 30000000, icon: "✈️", color: "#9B8CFF" },
    { id: "G3", user_id: "u_minhanh_01", name: "Quỹ dự phòng khẩn cấp 6 tháng", current: 85000000, target: 100000000, icon: "🛡️", color: "#E8C57C" }
  ]
};

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
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
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

// Auto-seed demo records if DB is fresh
async function seedPostgresIfEmpty(client) {
  const countRes = await client.query('SELECT count(*) as count FROM users');
  const userCount = parseInt(countRes.rows[0].count, 10);
  if (userCount === 0) {
    console.log("🌱 Database trống, tiến hành nạp tài khoản demo & dữ liệu giao dịch mẫu...");
    // Insert demo user
    const u = defaultDbState.users[0];
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, account_number, balance, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, u.password_hash, u.full_name, u.account_number, u.balance, u.phone, u.role]
    );

    // Insert transactions
    for (const tx of defaultDbState.transactions) {
      await client.query(
        `INSERT INTO transactions (id, user_id, name, amount, type, category, date, note, reference_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
        [tx.id, tx.user_id, tx.name, tx.amount, tx.type, tx.category, tx.date, tx.note, tx.reference_code]
      );
    }

    // Insert goal jars
    for (const jar of defaultDbState.goalJars) {
      await client.query(
        `INSERT INTO goal_jars (id, user_id, name, target_amount, current_amount, icon, color)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [jar.id, jar.user_id, jar.name, jar.target, jar.current, jar.icon, jar.color]
      );
    }
    console.log("✅ Đã nạp thành công 1 người dùng và 7 giao dịch mẫu vào cơ sở dữ liệu!");
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
      connectionTimeoutMillis: 8000
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

      return {
        mode: 'postgres',
        connected: true,
        database: meta.rows[0].db_name,
        user: meta.rows[0].db_user,
        host: meta.rows[0].server_ip || 'Remote Cloud Server',
        port: meta.rows[0].server_port || 5432,
        userCount: parseInt(uCount.rows[0].count, 10),
        transactionCount: parseInt(txCount.rows[0].count, 10),
        message: '🟢 Đang hoạt động trên máy chủ PostgreSQL',
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

// Re-seed demo transactions for testing
async function seedSampleData(userId) {
  const seedTxs = defaultDbState.transactions.map(t => ({
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
  const initialBalance = 47250000;

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

// --- TRANSACTIONS OPERATIONS (SPRINT 1 & 2) ---
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

// --- SPRINT 2: ANALYTICS & SUMMARY ---
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

// 50/30/20 Rule Computation
async function getRule503020(userId) {
  const summary = await getSummary(userId);
  const income = summary.totalIncome > 0 ? summary.totalIncome : 30000000; // default 30M reference
  return {
    totalIncome: income,
    needs: {
      percentage: 50,
      label: "Thiết yếu (Ăn uống, Nhà ở, Hóa đơn)",
      target: Math.round(income * 0.5),
      color: "#00D18F"
    },
    wants: {
      percentage: 30,
      label: "Mong muốn (Cà phê, Mua sắm, Giải trí)",
      target: Math.round(income * 0.3),
      color: "#9B8CFF"
    },
    savings: {
      percentage: 20,
      label: "Tích lũy & Đầu tư (Quỹ dự phòng, Tiết kiệm)",
      target: Math.round(income * 0.2),
      color: "#E8C57C"
    }
  };
}

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
  getGoalJars
};
