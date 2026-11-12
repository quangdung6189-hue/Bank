// ==========================================================================
// ĐỒNG BANK - ERROR HANDLER & VALIDATION MIDDLEWARES
// Centralized Error Handling, CORS Security & Date Range Validation
// ==========================================================================

/**
 * Middleware kiểm tra hợp lệ khoảng thời gian tìm kiếm (Date Range Validation)
 * Chặn lỗi Ngày bắt đầu > Ngày kết thúc và sai định dạng YYYY-MM-DD
 */
function validateDateRange(req, res, next) {
  const { startDate, endDate } = req.query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (startDate && !dateRegex.test(startDate)) {
    return res.status(400).json({
      success: false,
      message: 'Định dạng ngày bắt đầu không hợp lệ (chuẩn YYYY-MM-DD)'
    });
  }

  if (endDate && !dateRegex.test(endDate)) {
    return res.status(400).json({
      success: false,
      message: 'Định dạng ngày kết thúc không hợp lệ (chuẩn YYYY-MM-DD)'
    });
  }

  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({
      success: false,
      message: 'Khoảng thời gian không hợp lệ: Ngày bắt đầu không được lớn hơn ngày kết thúc'
    });
  }

  next();
}

/**
 * Middleware bắt lỗi 404 cho các route API không tồn tại
 */
function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: `Không tìm thấy endpoint API: ${req.method} ${req.path}`
    });
  }
  next();
}

/**
 * Middleware xử lý lỗi tập trung toàn bộ hệ thống (Centralized Error Handler)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // 1. Lỗi chính sách bảo mật CORS
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'Chính sách bảo mật CORS từ chối nguồn truy cập này'
    });
  }

  // 2. Lỗi cú pháp JSON Body (Bad Request)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu JSON gửi lên không đúng định dạng chuẩn'
    });
  }

  // 3. Lỗi xác thực JWT Token
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Mã xác thực JWT không hợp lệ hoặc đã bị thay đổi'
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại'
    });
  }

  // 4. Lỗi máy chủ không lường trước
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.status || err.statusCode || 500;

  if (!isProduction) {
    console.error('❌ Unhandled Server Error:', err);
  } else {
    console.error('❌ Server Error:', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500
      ? 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.'
      : (err.message || 'Lỗi hệ thống không xác định'),
    ...(isProduction ? {} : { stack: err.stack })
  });
}

module.exports = {
  validateDateRange,
  notFoundHandler,
  errorHandler
};
