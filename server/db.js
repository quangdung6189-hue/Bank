const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let pgPool = null;
const usePg = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());

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

// PostgreSQL Initialization (if configured)
async function initPg() {
  if (!usePg) return false;
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
    });
    
    // Test connection
    const client = await pgPool.connect();
    console.log("✅ Đã kết nối thành công tới PostgreSQL Database từ xa!");
    
    // Run schema
    const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    client.release();
    return true;
  } catch (err) {
    console.warn("⚠️ Không thể kết nối PostgreSQL, tự động chuyển về Local Database:", err.message);
    pgPool = null;
    return false;
  }
}

// ==================== REPOSITORY FUNCTIONS ====================

// --- USER OPERATIONS ---
async function findUserByEmail(email) {
  const normEmail = (email || '').toLowerCase().trim();
  if (pgPool) {
    const res = await pgPool.query('SELECT * FROM users WHERE LOWER(email) = $1', [normEmail]);
    return res.rows[0] || null;
  }
  const db = readLocalDb();
  return db.users.find(u => u.email.toLowerCase() === normEmail) || null;
}

async function findUserById(id) {
  if (pgPool) {
    const res = await pgPool.query('SELECT id, email, full_name, account_number, balance, phone, role, created_at FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }
  const db = readLocalDb();
  const u = db.users.find(x => x.id === id);
  if (!u) return null;
  const { password_hash, ...safeUser } = u;
  return safeUser;
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
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, full_name, account_number, balance, phone, role, created_at`,
      [id, normEmail, passwordHash, fullName, accountNumber, initialBalance, phone || null]
    );
    return res.rows[0];
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
  return safeUser;
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
    return res.rows;
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
  return list.slice(0, limit);
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
    return res.rows[0];
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
  return newTx;
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
    return res.rows;
  }
  const db = readLocalDb();
  return (db.goalJars || []).filter(j => j.user_id === userId);
}

module.exports = {
  initPg,
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
