// ==========================================================================
// ĐỒNG BANK - RATE LIMITING SECURITY MIDDLEWARE
// Sliding Window Rate Limiter (In-Memory, Zero Dependencies)
// Bảo vệ chống Spam request, Brute-force và DoS cho các API nhạy cảm
// ==========================================================================

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket ? req.socket.remoteAddress || '127.0.0.1' : '127.0.0.1';
}

/**
 * Tạo middleware giới hạn tần suất request (Rate Limiter)
 * @param {Object} options
 * @param {number} options.windowMs - Khung thời gian trượt (ms)
 * @param {number} options.max - Số lượng request tối đa trong khung thời gian
 * @param {string} options.message - Thông báo trả về khi bị giới hạn
 * @param {boolean} options.skipInTest - Bỏ qua giới hạn trong môi trường kiểm thử tự động
 */
function createRateLimiter({
  windowMs = 60 * 1000,
  max = 100,
  message = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.',
  skipInTest = true
} = {}) {
  const hits = new Map();

  // Dọn dẹp bộ nhớ định kỳ sau mỗi 2 phút
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, records] of hits.entries()) {
      const valid = records.filter(timestamp => now - timestamp < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, Math.max(30000, windowMs));

  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimitMiddleware(req, res, next) {
    // Bỏ qua rate limit trong môi trường test tự động để tránh cản trở test suites
    if (skipInTest && (process.env.NODE_ENV === 'test' || process.env.SKIP_RATE_LIMIT === 'true')) {
      return next();
    }

    const ip = getClientIp(req);
    const now = Date.now();

    const currentRecords = hits.get(ip) || [];
    const validRecords = currentRecords.filter(timestamp => now - timestamp < windowMs);

    const remaining = Math.max(0, max - validRecords.length);
    const resetTime = Math.ceil((windowMs - (validRecords.length > 0 ? now - validRecords[0] : 0)) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (validRecords.length >= max) {
      res.setHeader('Retry-After', resetTime);
      return res.status(429).json({
        success: false,
        message,
        retryAfter: resetTime
      });
    }

    validRecords.push(now);
    hits.set(ip, validRecords);
    next();
  };
}

// 1. Giới hạn nghiêm ngặt cho API Xác thực / Auth (Chống brute-force mật khẩu & spam OTP)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,                  // Tối đa 20 lần thử / 15 phút
  message: 'Quá nhiều lượt đăng nhập hoặc thử mật khẩu. Vui lòng chờ 15 phút trước khi thử lại.'
});

// 2. Giới hạn cho các API Giao dịch tài chính nhạy cảm (Tạo GD, nạp/rút hũ, trả hóa đơn)
const txLimiter = createRateLimiter({
  windowMs: 60 * 1000,      // 1 phút
  max: 60,                  // Tối đa 60 giao dịch / phút
  message: 'Tần suất thực hiện giao dịch tài chính quá cao. Vui lòng giảm tốc độ để bảo vệ tài khoản.'
});

// 3. Giới hạn chung cho toàn bộ hệ thống API (Chống DDoS / Crawl dữ liệu)
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,      // 1 phút
  max: 300,                 // Tối đa 300 requests / phút
  message: 'Hệ thống Đồng Bank phát hiện lưu lượng truy cập bất thường từ thiết bị của bạn. Vui lòng thử lại sau.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  txLimiter,
  apiLimiter
};
