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

-- 2. BẢNG GIAO DỊCH (TRANSACTIONS - SPRINT 1 & SPRINT 2)
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
    icon VARCHAR(20) DEFAULT '🎯',
    color VARCHAR(30) DEFAULT '#00D18F',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
