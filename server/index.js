require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 8888;
const JWT_SECRET = process.env.JWT_SECRET || 'dong_bank_jwt_secret_super_secure_key_2026';

// Middlewares - Cấp quyền kết nối API & Database cho các trang web phù hợp
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Banking Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sẵn sàng kết nối cơ sở dữ liệu (tương thích cả Localhost và Vercel Serverless Function)
let dbInitPromise = null;
function ensureDbInit() {
  if (!dbInitPromise) {
    dbInitPromise = db.initPg().catch(err => {
      console.warn('⚠️ Lỗi kết nối DB:', err.message);
    });
  }
  return dbInitPromise;
}

app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    await ensureDbInit();
  }
  next();
});

// Serve Static Frontend files (index.html, app.html)
app.use(express.static(path.join(__dirname, '..')));

// Authentication Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ' });
  }
}

// ==================== AUTHENTICATION ROUTES ====================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu' });
    }

    const existing = await db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được đăng ký tài khoản tại Đồng Bank' });
    }

    const user = await db.createUser({ email, password, fullName, phone });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.full_name }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản Đồng Bank thành công!',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.full_name }, JWT_SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng nhập' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xác thực người dùng' });
  }
});

// ==================== TRANSACTIONS ROUTES ====================

// GET /api/transactions (Lấy lịch sử giao dịch + Bộ lọc)
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, type, category, search, limit } = req.query;
    const transactions = await db.getTransactions(req.user.id, {
      startDate,
      endDate,
      type,
      category,
      search,
      limit: limit ? parseInt(limit, 10) : 100
    });
    res.json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải lịch sử giao dịch' });
  }
});

// POST /api/transactions (Nhập liệu thủ công thu / chi mới)
app.post('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const { name, amount, type, category, date, note } = req.body;
    if (!name || !amount || !category) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên giao dịch, số tiền và danh mục'
      });
    }

    const tx = await db.addTransaction(req.user.id, {
      name,
      amount: parseFloat(amount),
      type: type || 'expense',
      category,
      date,
      note
    });

    const user = await db.findUserById(req.user.id);

    res.status(201).json({
      success: true,
      message: 'Ghi nhận giao dịch thành công!',
      transaction: tx,
      newBalance: user ? user.balance : undefined
    });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ success: false, message: 'Lỗi ghi nhận giao dịch' });
  }
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  try {
    const ok = await db.deleteTransaction(req.user.id, req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch hoặc đã bị xóa' });
    }
    const user = await db.findUserById(req.user.id);
    res.json({ success: true, message: 'Đã xóa giao dịch!', newBalance: user ? user.balance : undefined });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa giao dịch' });
  }
});

// ==================== BÁO CÁO & PHÂN TÍCH TÀI CHÍNH ====================

// GET /api/analytics/summary (Thẻ tổng thu nhập, tổng chi tiêu, số dư, số giao dịch)
app.get('/api/analytics/summary', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await db.getSummary(req.user.id, { startDate, endDate });
    res.json({ success: true, summary });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tính toán tổng quan báo cáo' });
  }
});

// GET /api/analytics/categories (Biểu đồ tròn Pie/Donut Chart theo danh mục)
app.get('/api/analytics/categories', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const breakdown = await db.getCategoryBreakdown(req.user.id, { startDate, endDate });
    res.json({ success: true, ...breakdown });
  } catch (err) {
    console.error('Category breakdown error:', err);
    res.status(500).json({ success: false, message: 'Lỗi phân tích tỷ lệ danh mục' });
  }
});

// GET /api/analytics/cashflow (Biểu đồ cột Bar Chart biến động thu - chi)
app.get('/api/analytics/cashflow', authMiddleware, async (req, res) => {
  try {
    const cashflow = await db.getCashflowTrend(req.user.id);
    res.json({ success: true, trend: cashflow });
  } catch (err) {
    console.error('Cashflow error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải biểu đồ dòng tiền' });
  }
});

// GET /api/budget/allocation & /api/budget/rule-50-30-20 (Chiến lược phân bổ tài chính thông minh thực tế)
const budgetHandler = async (req, res) => {
  try {
    const { strategy, income } = req.query;
    const ruleData = await db.getWealthAllocation(req.user.id, {
      strategy: strategy || 'urban_realistic',
      customIncome: income ? parseFloat(income) : null
    });
    res.json({ success: true, rule: ruleData, allocation: ruleData });
  } catch (err) {
    console.error('Wealth allocation error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tính toán phân bổ ngân sách: ' + err.message });
  }
};
app.get('/api/budget/allocation', authMiddleware, budgetHandler);
app.get('/api/budget/rule-50-30-20', authMiddleware, budgetHandler);


// GET /api/jars (Danh sách hũ mục tiêu)
app.get('/api/jars', authMiddleware, async (req, res) => {
  try {
    const jars = await db.getGoalJars(req.user.id);
    res.json({ success: true, jars });
  } catch (err) {
    console.error('Get jars error:', err);
    res.status(500).json({ success: false, message: 'Lỗi tải danh sách hũ tài chính' });
  }
});

// ==================== DATABASE MANAGEMENT ROUTES ====================

// GET /api/system/db-status (Trạng thái kết nối cơ sở dữ liệu hiện tại)
app.get('/api/system/db-status', async (req, res) => {
  try {
    const status = await db.getDbStatus();
    res.json({ success: true, status });
  } catch (err) {
    console.error('DB Status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi kiểm tra trạng thái database', error: err.message });
  }
});

// Bảo mật cấp ngân hàng: Không tiếp nhận chuỗi kết nối Database từ Client.
// Mọi thông tin cấu hình được lưu trữ và mã hóa an toàn trong file .env trên Server.

// POST /api/system/seed-demo (Nạp dữ liệu giao dịch mẫu)
app.post('/api/system/seed-demo', authMiddleware, async (req, res) => {
  try {
    const resSeed = await db.seedSampleData(req.user.id);
    res.json({
      success: true,
      message: `Đã nạp ${resSeed.count} giao dịch mẫu cho tài khoản của bạn!`,
      count: resSeed.count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi nạp dữ liệu mẫu' });
  }
});

// POST /api/system/db-reset (Reset về mặc định không dữ liệu, bắt đầu từ con số 0)
app.post('/api/system/db-reset', async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        userId = decoded.id;
      } catch (_) {}
    }
    const result = await db.resetDatabase(userId);
    res.json({
      success: true,
      message: result.message,
      result
    });
  } catch (err) {
    console.error('Reset DB error:', err);
    res.status(500).json({ success: false, message: 'Lỗi reset cơ sở dữ liệu: ' + err.message });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.getDbStatus();
  res.json({
    status: 'ONLINE',
    service: 'Đồng Bank API Backend',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Start Server khi chạy local
async function start() {
  await ensureDbInit();
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚀 Đồng Bank Server đang chạy trên cổng ${PORT}`);
    console.log(`🔗 Web Landing Page: http://localhost:${PORT}/index.html`);
    console.log(`🔗 Web Internet Banking: http://localhost:${PORT}/app.html`);
    console.log(`📡 API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`================================================================`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  start();
}

module.exports = app;



