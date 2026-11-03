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
  goalJars: [
    {
      id: "jar_emergency_01",
      user_id: "u_dangquangdung_01",
      name: "Quỹ Dự phòng Khẩn cấp 6 Tháng",
      target_amount: 150000000,
      current_amount: 47835000,
      deadline: "2026-12-31",
      category: "Dự phòng",
      color: "#F59E0B",
      icon: "shield",
      status: "active",
      created_at: new Date("2026-01-10").toISOString()
    },
    {
      id: "jar_macbook_02",
      user_id: "u_dangquangdung_01",
      name: "Nâng cấp MacBook Pro M4 Max",
      target_amount: 55000000,
      current_amount: 32500000,
      deadline: "2026-11-30",
      category: "Công việc",
      color: "#10B981",
      icon: "laptop",
      status: "active",
      created_at: new Date("2026-02-01").toISOString()
    },
    {
      id: "jar_travel_03",
      user_id: "u_dangquangdung_01",
      name: "Du lịch Trải nghiệm Tokyo & Kyoto",
      target_amount: 40000000,
      current_amount: 18000000,
      deadline: "2027-03-20",
      category: "Trải nghiệm",
      color: "#6366F1",
      icon: "plane",
      status: "active",
      created_at: new Date("2026-03-01").toISOString()
    }
  ],
  recurringBills: [
    {
      id: "bill_rent_01",
      user_id: "u_dangquangdung_01",
      title: "Tiền thuê căn hộ cao cấp Vinhomes",
      category: "Nhà ở",
      amount: 15000000,
      billing_day: 5,
      frequency: "monthly",
      status: "pending",
      auto_create_tx: true,
      last_paid_at: null,
      created_at: new Date("2026-01-01").toISOString()
    },
    {
      id: "bill_internet_02",
      user_id: "u_dangquangdung_01",
      title: "Gói cước Internet Cáp quang FPT & K+",
      category: "Hóa đơn",
      amount: 450000,
      billing_day: 12,
      frequency: "monthly",
      status: "pending",
      auto_create_tx: true,
      last_paid_at: null,
      created_at: new Date("2026-01-01").toISOString()
    },
    {
      id: "bill_gym_03",
      user_id: "u_dangquangdung_01",
      title: "Hội viên California Fitness & Yoga",
      category: "Sức khỏe",
      amount: 1200000,
      billing_day: 20,
      frequency: "monthly",
      status: "pending",
      auto_create_tx: true,
      last_paid_at: null,
      created_at: new Date("2026-01-01").toISOString()
    },
    {
      id: "bill_insurance_04",
      user_id: "u_dangquangdung_01",
      title: "Bảo hiểm Chăm sóc Sức khỏe Toàn diện",
      category: "Y tế & Bảo hiểm",
      amount: 2500000,
      billing_day: 25,
      frequency: "monthly",
      status: "pending",
      auto_create_tx: true,
      last_paid_at: null,
      created_at: new Date("2026-01-01").toISOString()
    }
  ],
  gamificationProfiles: [
    {
      user_id: "u_dangquangdung_01",
      tree_level: 2,
      current_exp: 340,
      streak_days: 5,
      last_checkin_at: new Date().toISOString().split('T')[0],
      achievements: [
        { id: "first_budget_plan", name: "Nhà hoạch định Tài ba", icon: "✦", unlocked_at: new Date("2026-10-01").toISOString() },
        { id: "streak_3_days", name: "Chuỗi 3 ngày Kỷ luật", icon: "🔥", unlocked_at: new Date("2026-10-15").toISOString() }
      ]
    }
  ]
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
    const parsed = JSON.parse(raw);
    let modified = false;
    if (!parsed.goalJars || parsed.goalJars.length === 0) {
      parsed.goalJars = defaultDbState.goalJars;
      modified = true;
    }
    if (!parsed.recurringBills || parsed.recurringBills.length === 0) {
      parsed.recurringBills = defaultDbState.recurringBills;
      modified = true;
    }
    if (!parsed.gamificationProfiles || parsed.gamificationProfiles.length === 0) {
      parsed.gamificationProfiles = defaultDbState.gamificationProfiles;
      modified = true;
    }
    if (modified) {
      try { fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8'); } catch (_) {}
    }
    return parsed;
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
function formatDateLocal(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    if (d.includes('T')) {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      }
    }
    return d.slice(0, 10);
  }
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(d).slice(0, 10);
}

function getTodayStrLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeTx(t) {
  if (!t) return null;
  const d = formatDateLocal(t.date);
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

  // Seed goal jars if empty
  try {
    const jarsRes = await client.query('SELECT count(*) as count FROM goal_jars');
    if (parseInt(jarsRes.rows[0].count, 10) === 0) {
      for (const j of defaultDbState.goalJars) {
        await client.query(
          `INSERT INTO goal_jars (id, user_id, name, target_amount, current_amount, deadline, category, color, icon, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
          [j.id, j.user_id, j.name, j.target_amount, j.current_amount, j.deadline, j.category, j.color, j.icon, j.status]
        );
      }
    }
  } catch (e) {
    console.warn("⚠️ Không thể seed goal_jars ban đầu:", e.message);
  }

  // Seed recurring bills if empty
  try {
    const billsRes = await client.query('SELECT count(*) as count FROM recurring_bills');
    if (parseInt(billsRes.rows[0].count, 10) === 0) {
      for (const b of defaultDbState.recurringBills) {
        await client.query(
          `INSERT INTO recurring_bills (id, user_id, title, category, amount, billing_day, frequency, status, auto_create_tx)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
          [b.id, b.user_id, b.title, b.category, b.amount, b.billing_day, b.frequency, b.status, b.auto_create_tx]
        );
      }
    }
  } catch (e) {
    console.warn("⚠️ Không thể seed recurring_bills ban đầu:", e.message);
  }

  // Seed gamification profile if empty
  try {
    const profRes = await client.query('SELECT count(*) as count FROM gamification_profiles');
    if (parseInt(profRes.rows[0].count, 10) === 0) {
      const gp = defaultDbState.gamificationProfiles[0];
      await client.query(
        `INSERT INTO gamification_profiles (user_id, tree_level, current_exp, streak_days, last_checkin_at, achievements)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id) DO NOTHING`,
        [gp.user_id, gp.tree_level, gp.current_exp, gp.streak_days, gp.last_checkin_at, JSON.stringify(gp.achievements)]
      );
    }
  } catch (e) {
    console.warn("⚠️ Không thể seed gamification_profiles ban đầu:", e.message);
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
  const user = await findUserById(userId);
  const accountBalance = user ? Math.max(0, Number(user.balance)) : 0;
  const income = (customIncome !== null && customIncome !== undefined)
    ? Number(customIncome)
    : accountBalance;

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
    accountBalance,
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
    return res.rows.map(r => {
      const target = Number(r.target_amount || r.target || 0);
      const current = Number(r.current_amount || r.current || 0);
      const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
      let deadline = r.deadline;
      if (deadline instanceof Date) deadline = deadline.toISOString().slice(0, 10);
      return {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        target_amount: target,
        current_amount: current,
        deadline: deadline || null,
        category: r.category || 'Dự phòng',
        color: r.color || '#10B981',
        icon: r.icon || 'shield',
        status: r.status || (current >= target && target > 0 ? 'completed' : 'active'),
        progress_percent: percent,
        created_at: r.created_at
      };
    });
  }
  const db = readLocalDb();
  return (db.goalJars || []).filter(j => j.user_id === userId).map(j => {
    const target = Number(j.target_amount || j.target || 0);
    const current = Number(j.current_amount || j.current || 0);
    const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
      ...j,
      target_amount: target,
      current_amount: current,
      progress_percent: percent,
      status: j.status || (current >= target && target > 0 ? 'completed' : 'active')
    };
  });
}

async function createGoalJar(userId, jarData) {
  const id = `jar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const target = Number(jarData.target_amount || jarData.target || 0);
  const current = Number(jarData.current_amount || jarData.current || 0);
  const deadline = jarData.deadline || null;
  const category = jarData.category || 'Mục tiêu';
  const color = jarData.color || '#10B981';
  const icon = jarData.icon || 'target';
  const name = jarData.name || 'Hũ tiết kiệm mới';
  const status = current >= target && target > 0 ? 'completed' : 'active';
  const createdAt = new Date().toISOString();

  if (pgPool) {
    await pgPool.query(
      `INSERT INTO goal_jars (id, user_id, name, target_amount, current_amount, deadline, category, color, icon, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, userId, name, target, current, deadline, category, color, icon, status, createdAt]
    );
  } else {
    const db = readLocalDb();
    if (!db.goalJars) db.goalJars = [];
    db.goalJars.push({
      id,
      user_id: userId,
      name,
      target_amount: target,
      current_amount: current,
      deadline,
      category,
      color,
      icon,
      status,
      created_at: createdAt
    });
    writeLocalDb(db);
  }

  // Award exp for creating first jar
  await addGamificationExp(userId, 40, `Tạo hũ mục tiêu mới: ${name}`);

  return { id, user_id: userId, name, target_amount: target, current_amount: current, deadline, category, color, icon, status, progress_percent: target > 0 ? Math.round((current/target)*100) : 0 };
}

async function depositGoalJar(userId, jarId, amount, note = '') {
  const depositAmt = Math.abs(Number(amount));
  if (!depositAmt || depositAmt <= 0) throw new Error("Số tiền nạp vào hũ phải lớn hơn 0");

  let jar = null;
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM goal_jars WHERE id = $1 AND user_id = $2', [jarId, userId]);
    if (res.rows.length === 0) throw new Error("Không tìm thấy hũ tiết kiệm");
    jar = res.rows[0];
    const newCurrent = Number(jar.current_amount || 0) + depositAmt;
    const target = Number(jar.target_amount || 0);
    const newStatus = target > 0 && newCurrent >= target ? 'completed' : 'active';
    await pgPool.query('UPDATE goal_jars SET current_amount = $1, status = $2 WHERE id = $3', [newCurrent, newStatus, jarId]);
    jar.current_amount = newCurrent;
    jar.status = newStatus;
  } else {
    const db = readLocalDb();
    if (!db.goalJars) db.goalJars = [];
    const idx = db.goalJars.findIndex(j => j.id === jarId && j.user_id === userId);
    if (idx === -1) throw new Error("Không tìm thấy hũ tiết kiệm");
    const target = Number(db.goalJars[idx].target_amount || 0);
    const newCurrent = Number(db.goalJars[idx].current_amount || 0) + depositAmt;
    const newStatus = target > 0 && newCurrent >= target ? 'completed' : 'active';
    db.goalJars[idx].current_amount = newCurrent;
    db.goalJars[idx].status = newStatus;
    writeLocalDb(db);
    jar = db.goalJars[idx];
  }

  // Deduct from user's account balance
  await updateUserBalance(userId, -depositAmt);

  // Add transaction
  await addTransaction(userId, {
    name: `Nạp hũ: ${jar.name}`,
    amount: depositAmt,
    type: 'expense',
    category: 'Tiết kiệm',
    date: new Date().toISOString().slice(0, 10),
    note: note || `Tích lũy vào hũ "${jar.name}"`
  });

  // Award EXP
  let expGain = 50;
  if (jar.status === 'completed') expGain += 100;
  const gameRes = await addGamificationExp(userId, expGain, `Tích lũy vào hũ: ${jar.name}`);

  return { jar, expGain, gameRes };
}

async function withdrawGoalJar(userId, jarId, amount, note = '') {
  const withdrawAmt = Math.abs(Number(amount));
  if (!withdrawAmt || withdrawAmt <= 0) throw new Error("Số tiền rút phải lớn hơn 0");

  let jar = null;
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM goal_jars WHERE id = $1 AND user_id = $2', [jarId, userId]);
    if (res.rows.length === 0) throw new Error("Không tìm thấy hũ tiết kiệm");
    jar = res.rows[0];
    const curr = Number(jar.current_amount || 0);
    if (curr < withdrawAmt) throw new Error(`Số dư hũ không đủ (hiện có ${curr.toLocaleString('vi-VN')}₫)`);
    const newCurrent = curr - withdrawAmt;
    const target = Number(jar.target_amount || 0);
    const newStatus = target > 0 && newCurrent >= target ? 'completed' : 'active';
    await pgPool.query('UPDATE goal_jars SET current_amount = $1, status = $2 WHERE id = $3', [newCurrent, newStatus, jarId]);
    jar.current_amount = newCurrent;
    jar.status = newStatus;
  } else {
    const db = readLocalDb();
    if (!db.goalJars) db.goalJars = [];
    const idx = db.goalJars.findIndex(j => j.id === jarId && j.user_id === userId);
    if (idx === -1) throw new Error("Không tìm thấy hũ tiết kiệm");
    const curr = Number(db.goalJars[idx].current_amount || 0);
    if (curr < withdrawAmt) throw new Error(`Số dư hũ không đủ (hiện có ${curr.toLocaleString('vi-VN')}₫)`);
    const newCurrent = curr - withdrawAmt;
    const target = Number(db.goalJars[idx].target_amount || 0);
    const newStatus = target > 0 && newCurrent >= target ? 'completed' : 'active';
    db.goalJars[idx].current_amount = newCurrent;
    db.goalJars[idx].status = newStatus;
    writeLocalDb(db);
    jar = db.goalJars[idx];
  }

  // Refund back to user's main balance
  await updateUserBalance(userId, withdrawAmt);

  // Add transaction
  await addTransaction(userId, {
    name: `Rút tiền hũ: ${jar.name}`,
    amount: withdrawAmt,
    type: 'income',
    category: 'Thu hồi quỹ',
    date: new Date().toISOString().slice(0, 10),
    note: note || `Rút tiền từ hũ "${jar.name}" về tài khoản chính`
  });

  return { jar, refunded: withdrawAmt };
}

async function deleteGoalJar(userId, jarId) {
  let jar = null;
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM goal_jars WHERE id = $1 AND user_id = $2', [jarId, userId]);
    if (res.rows.length === 0) throw new Error("Không tìm thấy hũ tiết kiệm");
    jar = res.rows[0];
    const curr = Number(jar.current_amount || 0);
    if (curr > 0) {
      await updateUserBalance(userId, curr);
    }
    await pgPool.query('DELETE FROM goal_jars WHERE id = $1 AND user_id = $2', [jarId, userId]);
  } else {
    const db = readLocalDb();
    if (!db.goalJars) db.goalJars = [];
    const idx = db.goalJars.findIndex(j => j.id === jarId && j.user_id === userId);
    if (idx === -1) throw new Error("Không tìm thấy hũ tiết kiệm");
    jar = db.goalJars[idx];
    const curr = Number(jar.current_amount || 0);
    if (curr > 0) {
      await updateUserBalance(userId, curr);
    }
    db.goalJars.splice(idx, 1);
    writeLocalDb(db);
  }
  return { success: true, deleted: jarId, refunded: Number(jar.current_amount || 0) };
}

// --- RECURRING BILLS OPERATIONS ---
function calculateBillCountdown(billingDay) {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let targetDate;
  if (billingDay >= currentDay) {
    targetDate = new Date(currentYear, currentMonth, billingDay);
  } else {
    targetDate = new Date(currentYear, currentMonth + 1, billingDay);
  }
  const diffTime = targetDate - new Date(currentYear, currentMonth, currentDay);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    daysRemaining: diffDays,
    nextDueDate: targetDate.toISOString().slice(0, 10),
    isDueSoon: diffDays <= 3 && diffDays >= 0,
    isToday: diffDays === 0
  };
}

async function getRecurringBills(userId) {
  let bills = [];
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM recurring_bills WHERE user_id = $1 ORDER BY billing_day ASC', [userId]);
    bills = res.rows;
  } else {
    const db = readLocalDb();
    bills = (db.recurringBills || []).filter(b => b.user_id === userId);
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return bills.map(b => {
    const billingDay = parseInt(b.billing_day, 10) || 1;
    const countdown = calculateBillCountdown(billingDay);
    let lastPaidAt = b.last_paid_at;
    if (lastPaidAt instanceof Date) lastPaidAt = lastPaidAt.toISOString();

    let isPaidThisMonth = false;
    if (lastPaidAt) {
      const paidDate = new Date(lastPaidAt);
      if (paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear) {
        isPaidThisMonth = true;
      }
    }

    return {
      id: b.id,
      user_id: b.user_id,
      title: b.title,
      category: b.category,
      amount: Number(b.amount),
      billing_day: billingDay,
      frequency: b.frequency || 'monthly',
      status: isPaidThisMonth ? 'paid' : (b.status || 'pending'),
      auto_create_tx: Boolean(b.auto_create_tx),
      last_paid_at: lastPaidAt,
      created_at: b.created_at,
      days_remaining: countdown.daysRemaining,
      next_due_date: countdown.nextDueDate,
      is_due_soon: countdown.isDueSoon && !isPaidThisMonth,
      is_today: countdown.isToday && !isPaidThisMonth,
      is_paid_this_month: isPaidThisMonth
    };
  });
}

async function addRecurringBill(userId, billData) {
  const id = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = (billData.title || '').trim();
  if (!title) throw new Error("Tên khoản phí cố định không được để trống");
  const category = billData.category || 'Hóa đơn';
  const amount = Math.abs(Number(billData.amount));
  if (!amount || amount <= 0) throw new Error("Số tiền thanh toán phải lớn hơn 0");
  const billingDay = Math.min(31, Math.max(1, parseInt(billData.billing_day, 10) || 1));
  const frequency = billData.frequency || 'monthly';
  const autoCreateTx = billData.auto_create_tx !== false;
  const createdAt = new Date().toISOString();

  if (pgPool) {
    await pgPool.query(
      `INSERT INTO recurring_bills (id, user_id, title, category, amount, billing_day, frequency, status, auto_create_tx, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, title, category, amount, billingDay, frequency, 'pending', autoCreateTx, createdAt]
    );
  } else {
    const db = readLocalDb();
    if (!db.recurringBills) db.recurringBills = [];
    db.recurringBills.push({
      id,
      user_id: userId,
      title,
      category,
      amount,
      billing_day: billingDay,
      frequency,
      status: 'pending',
      auto_create_tx: autoCreateTx,
      last_paid_at: null,
      created_at: createdAt
    });
    writeLocalDb(db);
  }

  await addGamificationExp(userId, 30, `Thêm lịch nhắc hóa đơn: ${title}`);
  return { id, user_id: userId, title, category, amount, billing_day: billingDay, frequency, status: 'pending', auto_create_tx: autoCreateTx };
}

async function payRecurringBill(userId, billId) {
  let bill = null;
  const paidAt = new Date().toISOString();

  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM recurring_bills WHERE id = $1 AND user_id = $2', [billId, userId]);
    if (res.rows.length === 0) throw new Error("Không tìm thấy khoản phí cố định này");
    bill = res.rows[0];
    await pgPool.query('UPDATE recurring_bills SET last_paid_at = $1, status = $2 WHERE id = $3', [paidAt, 'paid', billId]);
  } else {
    const db = readLocalDb();
    if (!db.recurringBills) db.recurringBills = [];
    const idx = db.recurringBills.findIndex(b => b.id === billId && b.user_id === userId);
    if (idx === -1) throw new Error("Không tìm thấy khoản phí cố định này");
    db.recurringBills[idx].last_paid_at = paidAt;
    db.recurringBills[idx].status = 'paid';
    bill = db.recurringBills[idx];
    writeLocalDb(db);
  }

  const amt = Number(bill.amount);
  // Create expense transaction
  const tx = await addTransaction(userId, {
    name: `Thanh toán: ${bill.title}`,
    amount: amt,
    type: 'expense',
    category: bill.category,
    date: paidAt.slice(0, 10),
    note: `Thanh toán định kỳ ngày ${bill.billing_day} hàng tháng`
  });

  // Award EXP
  const expRes = await addGamificationExp(userId, 50, `Thanh toán đúng hạn: ${bill.title}`);

  return { success: true, bill: { ...bill, last_paid_at: paidAt, status: 'paid' }, transaction: tx, gamification: expRes };
}

async function deleteRecurringBill(userId, billId) {
  if (pgPool) {
    await pgPool.query('DELETE FROM recurring_bills WHERE id = $1 AND user_id = $2', [billId, userId]);
  } else {
    const db = readLocalDb();
    if (!db.recurringBills) db.recurringBills = [];
    db.recurringBills = db.recurringBills.filter(b => !(b.id === billId && b.user_id === userId));
    writeLocalDb(db);
  }
  return { success: true, deleted: billId };
}

// --- GAMIFICATION OPERATIONS ---
const LEVEL_CONFIG = [
  { level: 1, minExp: 0, maxExp: 200, name: "Hạt mầm Tài chính", icon: "🌱", description: "Bắt đầu hành trình kỷ luật tài chính cá nhân" },
  { level: 2, minExp: 200, maxExp: 500, name: "Mầm xanh Thịnh vượng", icon: "🌿", description: "Đã hình thành thói quen ghi chép và phân bổ" },
  { level: 3, minExp: 500, maxExp: 1000, name: "Cây non Bền vững", icon: "🪴", description: "Xây dựng vững vàng quỹ khẩn cấp và hũ mục tiêu" },
  { level: 4, minExp: 1000, maxExp: 2000, name: "Cây đại thụ Tài chính", icon: "🌳", description: "Làm chủ dòng tiền và tự động hóa tích sản" },
  { level: 5, minExp: 2000, maxExp: 5000, name: "Vườn Địa đàng Cổ thụ", icon: "✨🌲", description: "Đạt đẳng cấp Private Wealth và Tự do tài chính" }
];

function getLevelInfo(totalExp) {
  let matched = LEVEL_CONFIG[0];
  for (const cfg of LEVEL_CONFIG) {
    if (totalExp >= cfg.minExp) {
      matched = cfg;
    }
  }
  const nextTarget = matched.maxExp;
  const prevLevelExp = matched.minExp;
  const expInLevel = totalExp - prevLevelExp;
  const levelSpan = nextTarget - prevLevelExp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((expInLevel / levelSpan) * 100)));

  return {
    level: matched.level,
    title: matched.name,
    icon: matched.icon,
    description: matched.description,
    currentExp: totalExp,
    expToNext: Math.max(0, nextTarget - totalExp),
    nextLevelTarget: nextTarget,
    progressPercent
  };
}

async function getGamificationProfile(userId) {
  let row = null;
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM gamification_profiles WHERE user_id = $1', [userId]);
    if (res.rows.length > 0) row = res.rows[0];
  } else {
    const db = readLocalDb();
    if (db.gamificationProfiles) {
      row = db.gamificationProfiles.find(g => g.user_id === userId);
    }
  }

  if (!row) {
    row = {
      user_id: userId,
      tree_level: 2,
      current_exp: 380,
      streak_days: 5,
      last_checkin_at: new Date().toISOString().split('T')[0],
      tree_name: "Vườn Thịnh Vượng Đặng Quang Dũng",
      plant_skin: "🌿",
      streak_freeze_count: 1,
      achievements: [
        { id: "first_budget_plan", name: "Nhà hoạch định Tài ba", icon: "✦", unlocked_at: new Date("2026-10-01").toISOString() },
        { id: "streak_3_days", name: "Chuỗi 3 ngày Kỷ luật", icon: "🔥", unlocked_at: new Date("2026-10-15").toISOString() }
      ]
    };
  }

  let achievements = [];
  try {
    achievements = typeof row.achievements === 'string' ? JSON.parse(row.achievements) : (row.achievements || []);
  } catch (_) {
    achievements = [];
  }

  let lastCheckin = formatDateLocal(row.last_checkin_at);
  const todayStr = getTodayStrLocal();
  const checkedInToday = (lastCheckin === todayStr);

  // Real-time online streak calculation
  let streakDays = Number(row.streak_days || 1);
  let streakStatus = 'active_today';
  let isStreakBroken = false;
  let diffDays = 0;

  if (lastCheckin) {
    const d1 = new Date(lastCheckin + 'T00:00:00');
    const d2 = new Date(todayStr + 'T00:00:00');
    diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    diffDays = 999;
  }

  if (checkedInToday) {
    streakStatus = 'active_today';
  } else if (diffDays === 1) {
    streakStatus = 'at_risk';
  } else if (diffDays > 1) {
    streakStatus = 'broken';
    isStreakBroken = true;
    streakDays = 0;
  }

  // Calculate live countdown until midnight
  const now = new Date();
  const tomorrowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const secondsUntilMidnight = Math.max(0, Math.floor((tomorrowMidnight - now) / 1000));
  const hoursLeft = Math.floor(secondsUntilMidnight / 3600);
  const minsLeft = Math.floor((secondsUntilMidnight % 3600) / 60);
  const countdownFormatted = `${String(hoursLeft).padStart(2, '0')}h ${String(minsLeft).padStart(2, '0')}m`;

  // 7-day streak history tracker
  const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const streakHistory7d = [];
  for (let i = 6; i >= 0; i--) {
    const dayDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayDateStr = formatDateLocal(dayDate);
    const dayLabel = dayLabels[dayDate.getDay()];
    const isToday = (i === 0);
    let checked = false;
    if (isToday) {
      checked = checkedInToday;
    } else {
      checked = (!isStreakBroken && (i <= (streakDays || 0)));
    }
    streakHistory7d.push({
      date: dayDateStr,
      day_label: dayLabel,
      dayLabel,
      is_today: isToday,
      isToday,
      checked
    });
  }

  const totalExp = Number(row.current_exp || 0);
  const levelInfo = getLevelInfo(totalExp);

  return {
    user_id: userId,
    tree_level: levelInfo.level,
    tree_title: levelInfo.title,
    tree_icon: row.plant_skin || levelInfo.icon,
    tree_description: levelInfo.description,
    tree_name: row.tree_name || "Vườn Thịnh Vượng Đặng Quang Dũng",
    plant_skin: row.plant_skin || "🌿",
    streak_freeze_count: Number(row.streak_freeze_count || 1),
    current_exp: totalExp,
    exp_to_next: levelInfo.expToNext,
    next_level_target: levelInfo.nextLevelTarget,
    progress_percent: levelInfo.progressPercent,
    streak_days: streakDays,
    streak_status: streakStatus,
    is_streak_broken: isStreakBroken,
    diff_days: diffDays,
    countdown_seconds: secondsUntilMidnight,
    countdown_text: countdownFormatted,
    streak_history_7d: streakHistory7d,
    last_checkin_at: lastCheckin,
    checked_in_today: checkedInToday,
    achievements
  };
}

async function addGamificationExp(userId, expToAdd, reason = '') {
  const profile = await getGamificationProfile(userId);
  const newExp = profile.current_exp + Number(expToAdd);
  const newLevelInfo = getLevelInfo(newExp);
  const leveledUp = newLevelInfo.level > profile.tree_level;

  let achievements = [...profile.achievements];
  if (leveledUp && !achievements.some(a => a.id === `level_${newLevelInfo.level}`)) {
    achievements.push({
      id: `level_${newLevelInfo.level}`,
      name: `Thăng hạng: ${newLevelInfo.title}`,
      icon: newLevelInfo.icon,
      unlocked_at: new Date().toISOString()
    });
  }

  if (pgPool) {
    await pgPool.query(
      `INSERT INTO gamification_profiles (user_id, tree_level, current_exp, streak_days, last_checkin_at, achievements, tree_name, plant_skin, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         tree_level = $2,
         current_exp = $3,
         achievements = $6,
         updated_at = NOW()`,
      [userId, newLevelInfo.level, newExp, profile.streak_days, profile.last_checkin_at, JSON.stringify(achievements), profile.tree_name, profile.plant_skin]
    );
  } else {
    const db = readLocalDb();
    if (!db.gamificationProfiles) db.gamificationProfiles = [];
    const idx = db.gamificationProfiles.findIndex(g => g.user_id === userId);
    const updated = {
      user_id: userId,
      tree_level: newLevelInfo.level,
      current_exp: newExp,
      streak_days: profile.streak_days,
      last_checkin_at: profile.last_checkin_at,
      achievements,
      tree_name: profile.tree_name,
      plant_skin: profile.plant_skin
    };
    if (idx >= 0) db.gamificationProfiles[idx] = updated;
    else db.gamificationProfiles.push(updated);
    writeLocalDb(db);
  }

  return {
    gained: expToAdd,
    totalExp: newExp,
    level: newLevelInfo.level,
    title: newLevelInfo.title,
    leveledUp,
    reason
  };
}

async function checkinGamification(userId, { extraCare = false } = {}) {
  const profile = await getGamificationProfile(userId);
  const todayStr = getTodayStrLocal();

  if (profile.checked_in_today) {
    if (extraCare) {
      const expGain = 10;
      const newExp = profile.current_exp + expGain;
      const newLevelInfo = getLevelInfo(newExp);
      if (pgPool) {
        await pgPool.query(
          `UPDATE gamification_profiles SET current_exp = $1, tree_level = $2, updated_at = NOW() WHERE user_id = $3`,
          [newExp, newLevelInfo.level, userId]
        );
      } else {
        const db = readLocalDb();
        const idx = db.gamificationProfiles.findIndex(g => g.user_id === userId);
        if (idx >= 0) {
          db.gamificationProfiles[idx].current_exp = newExp;
          db.gamificationProfiles[idx].tree_level = newLevelInfo.level;
          writeLocalDb(db);
        }
      }
      const updatedProfile = await getGamificationProfile(userId);
      return {
        success: true,
        isExtraCare: true,
        message: `Bạn đã tưới thêm nước dinh dưỡng cho cây! +${expGain} EXP 🧪🌱`,
        expGained: expGain,
        profile: updatedProfile
      };
    }
    return {
      success: false,
      alreadyCheckedIn: true,
      canExtraCare: true,
      message: "Hôm nay bạn đã tưới nước điểm danh rồi! Bạn có thể tưới thêm nước dinh dưỡng.",
      profile
    };
  }

  let newStreak = 1;
  if (profile.last_checkin_at) {
    const lastDate = new Date(profile.last_checkin_at);
    const today = new Date();
    const diffMs = today.getTime() - lastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) {
      newStreak = (profile.streak_days || 0) + 1;
    } else {
      newStreak = 1; // broken streak
    }
  }

  const expGain = 50 + (newStreak >= 7 ? 25 : 0);
  const newExp = profile.current_exp + expGain;
  const newLevelInfo = getLevelInfo(newExp);
  let achievements = [...profile.achievements];

  if (newStreak >= 3 && !achievements.some(a => a.id === 'streak_3_days')) {
    achievements.push({ id: 'streak_3_days', name: 'Chuỗi 3 ngày Kỷ luật', icon: '🔥', unlocked_at: new Date().toISOString() });
  }
  if (newStreak >= 7 && !achievements.some(a => a.id === 'streak_7_days')) {
    achievements.push({ id: 'streak_7_days', name: 'Chiến binh Bền bỉ 7 ngày', icon: '⚡', unlocked_at: new Date().toISOString() });
  }

  if (pgPool) {
    await pgPool.query(
      `INSERT INTO gamification_profiles (user_id, tree_level, current_exp, streak_days, last_checkin_at, achievements, tree_name, plant_skin, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         tree_level = $2,
         current_exp = $3,
         streak_days = $4,
         last_checkin_at = $5,
         achievements = $6,
         updated_at = NOW()`,
      [userId, newLevelInfo.level, newExp, newStreak, todayStr, JSON.stringify(achievements), profile.tree_name || 'Vườn Thịnh Vượng', profile.plant_skin || '🌿']
    );
  } else {
    const db = readLocalDb();
    if (!db.gamificationProfiles) db.gamificationProfiles = [];
    const idx = db.gamificationProfiles.findIndex(g => g.user_id === userId);
    const updated = {
      user_id: userId,
      tree_level: newLevelInfo.level,
      current_exp: newExp,
      streak_days: newStreak,
      last_checkin_at: todayStr,
      achievements,
      tree_name: profile.tree_name || 'Vườn Thịnh Vượng',
      plant_skin: profile.plant_skin || '🌿'
    };
    if (idx >= 0) db.gamificationProfiles[idx] = updated;
    else db.gamificationProfiles.push(updated);
    writeLocalDb(db);
  }

  const updatedProfile = await getGamificationProfile(userId);

  return {
    success: true,
    message: `Tưới nước thành công! +${expGain} EXP 🌱 (Chuỗi ${newStreak} ngày kỷ luật)`,
    expGained: expGain,
    newStreak,
    profile: updatedProfile
  };
}

async function customizeGamification(userId, { tree_name, plant_skin }) {
  const profile = await getGamificationProfile(userId);
  const newName = (tree_name || profile.tree_name || 'Vườn Thịnh Vượng').trim();
  const newSkin = plant_skin || profile.plant_skin || '🌿';

  if (pgPool) {
    await pgPool.query(
      `UPDATE gamification_profiles SET tree_name = $1, plant_skin = $2, updated_at = NOW() WHERE user_id = $3`,
      [newName, newSkin, userId]
    );
  } else {
    const db = readLocalDb();
    if (db.gamificationProfiles) {
      const idx = db.gamificationProfiles.findIndex(g => g.user_id === userId);
      if (idx >= 0) {
        db.gamificationProfiles[idx].tree_name = newName;
        db.gamificationProfiles[idx].plant_skin = newSkin;
        writeLocalDb(db);
      }
    }
  }
  return await getGamificationProfile(userId);
}

async function simulateGamificationStreak(userId, action) {
  const profile = await getGamificationProfile(userId);
  const now = new Date();
  let updatedLastCheckin = profile.last_checkin_at;
  let updatedStreak = profile.streak_days;
  let message = '';

  if (action === 'reset_today') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    updatedLastCheckin = formatDateLocal(yesterday);
    message = 'Đã khôi phục trạng thái chưa tưới nước hôm nay! Nút tưới sẵn sàng.';
  } else if (action === 'simulate_miss_day') {
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    updatedLastCheckin = formatDateLocal(twoDaysAgo);
    updatedStreak = 0;
    message = 'Đã mô phỏng không vào ứng dụng trong 1 ngày! Chuỗi kỷ luật đã bị đứt về 0 ngày.';
  } else if (action === 'advance_streak') {
    updatedStreak = (profile.streak_days || 0) + 1;
    updatedLastCheckin = getTodayStrLocal();
    message = `Đã cộng dồn +1 ngày chuỗi kỷ luật! Chuỗi hiện tại: ${updatedStreak} ngày.`;
  }

  if (pgPool) {
    await pgPool.query(
      `UPDATE gamification_profiles SET last_checkin_at = $1, streak_days = $2, updated_at = NOW() WHERE user_id = $3`,
      [updatedLastCheckin, updatedStreak, userId]
    );
  } else {
    const db = readLocalDb();
    if (db.gamificationProfiles) {
      const idx = db.gamificationProfiles.findIndex(g => g.user_id === userId);
      if (idx >= 0) {
        db.gamificationProfiles[idx].last_checkin_at = updatedLastCheckin;
        db.gamificationProfiles[idx].streak_days = updatedStreak;
        writeLocalDb(db);
      }
    }
  }

  const updatedProfile = await getGamificationProfile(userId);
  return { success: true, message, profile: updatedProfile };
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
  createGoalJar,
  depositGoalJar,
  withdrawGoalJar,
  deleteGoalJar,
  getRecurringBills,
  addRecurringBill,
  payRecurringBill,
  deleteRecurringBill,
  getGamificationProfile,
  addGamificationExp,
  checkinGamification,
  customizeGamification,
  simulateGamificationStreak,
  saveAutoSweepConfig,
  getAutoSweepConfig,
  savePasswordResetToken,
  resetDatabase
};
