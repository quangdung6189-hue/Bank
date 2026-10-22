# Đồng Bank — Hệ thống Ngân hàng Số & Quản lý Tài chính Cá nhân

Dự án được xây dựng dựa trên phong cách thiết kế Fintech cao cấp (Emerald Jade & Champagne Gold) với trải nghiệm mượt mà, phản hồi tức thì và tương tác hiện đại.

---

## 🌟 Cấu trúc Dự án

1. **[index.html](file:///c:/Users/DANG%20QUANG%20DUNG/Downloads/Bank/index.html)**:
   - **Landing Page giới thiệu Đồng**: Mở đầu với hiệu ứng WebGL Aurora (Three.js), mô hình điện thoại 3D phản hồi theo góc nhìn, trình diễn 5 tính năng cốt lõi (Phản hồi < 0,5s, Báo cáo < 1,5s, Offline-first, RAM < 100MB, Trợ lý AI giọng nói).
   - Widget tương tác phân bổ ngân sách **50/30/20** chạy Vue 3.
   - Nút liên kết chuyển tiếp trực tiếp vào **Internet Banking Web App**.

2. **[app.html](file:///c:/Users/DANG%20QUANG%20DUNG/Downloads/Bank/app.html)**:
   - **Ứng dụng Web Ngân hàng số (Internet Banking SPA)** đầy đủ 6 phân hệ:
     - 📊 **Tổng quan (Dashboard)**: Thẻ số dư khả dụng (ẩn/hiện mắt số dư), thẻ tín dụng kim loại Đồng Signature 3D lật xem mã CVV, biểu đồ dòng tiền tuần, danh sách giao dịch gần nhất.
     - ⚡ **Chuyển tiền nhanh 24/7 (Transfers)**: Nội bộ & Liên ngân hàng Napas 24/7 (hỗ trợ 15+ ngân hàng lớn), gợi ý người thụ hưởng, chuyển đổi số tiền thành chữ tiếng Việt realtime, modal bảo mật Smart OTP 6 số sinh tự động và xuất biên lai điện tử.
     - 💳 **Quản lý Thẻ (Cards)**: Bật/tắt thanh toán online, thanh toán quốc tế, rút ATM, điều chỉnh hạn mức ngày bằng thanh trượt, tạo thẻ ảo dùng 1 lần (Virtual Disposable Card).
     - 🎯 **Hũ tài chính 50/30/20 & Tiết kiệm (Jars)**: Vòng tròn phân bổ tự động theo mức lương, danh sách hũ mục tiêu (MacBook M4, Du lịch, Quỹ khẩn cấp) với chức năng nạp/rút tiền realtime.
     - 📑 **Lịch sử & Phân tích chi tiêu (History & Analytics)**: Bộ lọc theo danh mục, loại tiền vào/ra, tìm kiếm từ khóa, xuất sao kê PDF.
     - 🎙️ **Trợ lý AI Giọng nói Đồng Copilot (AI Copilot)**: Hỗ trợ nhận diện giọng nói tiếng Việt qua Web Speech API, phát âm phản hồi, trả lời câu hỏi và tự động tạo lệnh chuyển tiền nhanh.

---

## 🚀 Hướng dẫn Chạy Thử nghiệm

Máy chủ cục bộ đang chạy tại:
- **Landing Page**: `http://localhost:8888/index.html`
- **Internet Banking App**: `http://localhost:8888/app.html`

Nếu cần khởi động lại máy chủ:
```bash
python -m http.server 8888
```
hoặc mở trực tiếp file `index.html` hoặc `app.html` trên trình duyệt Chrome, Edge, Safari hoặc Firefox.
