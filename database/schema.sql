-- ====================================================================
-- SCHEMA CƠ SỞ DỮ LIỆU ĐỒNG BANK (POSTGRESQL / SQLITE TƯƠNG THÍCH)
-- ====================================================================

-- 1. BẢNG NGƯỜI DÙNG (USERS)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) UNIQUE NOT NULL,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG GIAO DỊCH (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,                         -- Tên giao dịch
    amount NUMERIC(15, 2) NOT NULL,                     -- Số tiền
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'in', 'out')), -- Loại (Thu nhập / Chi tiêu)
    category VARCHAR(50) NOT NULL,                      -- Danh mục (Ăn uống, Di chuyển, Mua sắm, Lương, Hóa đơn...)
    date DATE NOT NULL DEFAULT CURRENT_DATE,            -- Ngày tháng giao dịch
    note TEXT,                                          -- Ghi chú bổ sung
    reference_code VARCHAR(50),                         -- Mã tham chiếu
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CHỈ MỤC (INDEXES) TỐI ƯU HÓA TÌM KIẾM & BỘ LỌC THỜI GIAN
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);

-- 4. BẢNG HŨ TÀI CHÍNH & MỤC TIÊU TIẾT KIỆM (JARS 50/30/20)
CREATE TABLE IF NOT EXISTS goal_jars (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(15, 2) NOT NULL,
    current_amount NUMERIC(15, 2) DEFAULT 0,
    deadline DATE,
    category VARCHAR(64) DEFAULT 'general',
    status VARCHAR(32) DEFAULT 'active',
    icon VARCHAR(30) DEFAULT 'target',
    color VARCHAR(30) DEFAULT '#10B981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE goal_jars ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE goal_jars ADD COLUMN IF NOT EXISTS category VARCHAR(64) DEFAULT 'general';
ALTER TABLE goal_jars ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';

-- 5. BẢNG HÓA ĐƠN & PHÍ CỐ ĐỊNH (RECURRING BILLS)
CREATE TABLE IF NOT EXISTS recurring_bills (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    billing_day INT NOT NULL CHECK (billing_day BETWEEN 1 AND 31),
    frequency VARCHAR(32) DEFAULT 'monthly',
    status VARCHAR(32) DEFAULT 'pending',
    auto_create_tx BOOLEAN DEFAULT TRUE,
    last_paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bills_user ON recurring_bills(user_id);

-- 6. BẢNG GAME HÓA TÀI CHÍNH (GAMIFICATION PROFILES - WEALTH TREE)
CREATE TABLE IF NOT EXISTS gamification_profiles (
    user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tree_level INT DEFAULT 1,
    current_exp INT DEFAULT 0,
    streak_days INT DEFAULT 1,
    last_checkin_at DATE,
    achievements JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. BẢNG TOKEN KHÔI PHỤC MẬT KHẨU (PASSWORD RESET TOKENS)
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
