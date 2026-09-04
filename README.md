# TOEIC Master 2.0 - Hệ thống luyện thi TOEIC 4 kỹ năng & Quản lý ngân hàng câu hỏi AI

Ứng dụng web học và luyện thi TOEIC toàn diện 4 kỹ năng (Listening, Reading, Speaking, Writing) tích hợp bộ quản lý câu hỏi trực quan, bộ sinh bài tập thông minh (Offline Template + AI Generator) và bảo mật an toàn.

---

## 🌟 Những nâng cấp nổi bật trong Phiên bản 2.0

1. **Kiến trúc Mô-đun hóa độc lập (Modular ES Modules)**:
   - Dữ liệu câu hỏi được tách hoàn toàn ra khỏi mã nguồn JavaScript và tổ chức thành các file JSON chuẩn hóa trong thư mục `data/`.
   - Logic được chia tách thành các module chuyên biệt: `storage.js`, `progress.js`, `content-loader.js`, `validation.js`, `quiz-engine.js`, `template-generator.js`, `ai-generator.js`, `admin.js`, v.v.

2. **Quản lý nội dung trực quan (Admin Dashboard - "Quản lý nội dung")**:
   - Thêm, sửa, xóa, nhân bản bài tập trực tiếp ngay trên giao diện web.
   - Tìm kiếm, lọc theo kỹ năng (Part 1-7, Speaking, Writing, Vocab, Grammar), độ khó và trạng thái.
   - Import và Export ngân hàng câu hỏi dạng JSON một cách dễ dàng.
   - **Người dùng không cần phải sửa file JavaScript thủ công mỗi khi thêm nội dung mới!**

3. **Bộ sinh bài tập tự động (Auto Exercise Generator)**:
   - **Offline Template Generator**: Tự động sinh hàng loạt câu hỏi ngữ pháp (Thì, Bị động, Mệnh đề quan hệ, Word Form, Điều kiện) theo công thức chuẩn TOEIC kèm giải thích mà không cần kết nối mạng hay tốn phí API.
   - **AI Generator**: Tích hợp gọi AI an toàn (OpenAI GPT-4o-mini hoặc Gemini Flash) qua backend proxy `server.js` (không lộ API key ở frontend).
   - **Quy trình kiểm duyệt Draft**: Các câu hỏi do AI tạo ra sẽ vào hộp thư nháp để giáo viên/học viên duyệt trước khi đưa vào kho chính.
   - Chế độ Mock AI có sẵn để kiểm thử sinh bài tập ngay cả khi chưa có API key.

4. **Sửa đổi hệ thống chấm điểm chuẩn TOEIC**:
   - Sửa triệt để lỗi chấm điểm của các câu hỏi chùm (Part 3, Part 4, Part 6, Part 7) bằng thuật toán Flattened Multi-question scoring.
   - Thay thế công thức tính điểm tuyến tính ngây thơ bằng biểu đồ chuẩn hóa TOEIC phi tuyến tính chuẩn (thang điểm 10-990) kèm khuyến cáo điểm thi thử.
   - Cơ chế chống gian lận lặp lại lượt nộp bài để tăng điểm ảo (Anti-score inflation).

5. **Hệ thống theo dõi tiến độ & Chuỗi học tập (Streak & Retention)**:
   - Tự động ghi nhận chuỗi ngày học liên tục (Streak), cảnh báo đứt chuỗi nếu bỏ qua quá 1 ngày.
   - Lưu trữ lịch sử bài làm chi tiết (thời gian, kỹ năng, số câu đúng, tỷ lệ chính xác) và vẽ biểu đồ năng lực theo từng kỹ năng.

---

## 📂 Cấu trúc dự án

```
Toeic/
├── index.html                  # Giao diện chính (Single Page Application)
├── css/
│   └── style.css              # Thiết kế giao diện hiện đại, responsive, audio player, admin
├── js/
│   ├── app.js                 # Entry point, router và đồng bộ giao diện
│   └── modules/               # Các module nghiệp vụ độc lập
│       ├── storage.js         # Quản lý localStorage với versioning & migration
│       ├── progress.js        # Streak, bài học hàng ngày và lịch sử làm bài
│       ├── validation.js      # Kiểm tra Schema dữ liệu & Chống mã độc XSS
│       ├── content-loader.js  # Tải JSON, merge bài tập tùy chỉnh, cache
│       ├── quiz-engine.js     # Chấm điểm chuẩn TOEIC, multi-question, thang 10-990
│       ├── template-generator.js # Sinh bài tập ngữ pháp/từ vựng offline
│       ├── ai-generator.js    # Quản lý luồng gọi AI proxy & duyệt nháp
│       ├── listening.js       # UI Luyện nghe có Audio Player & transcript
│       ├── reading.js         # UI Luyện đọc câu đơn & đoạn văn Part 6-7
│       ├── speaking.js        # UI Luyện nói 4 dạng kèm mẫu câu trả lời
│       ├── writing.js         # UI Luyện viết câu, email, essay
│       ├── vocabulary.js      # UI Flashcard từ vựng phản hồi trực quan
│       ├── grammar.js         # UI Lý thuyết & bài tập ngữ pháp
│       ├── mock-test.js       # UI Thi thử tính giờ 25 phút & tổng kết
│       └── admin.js           # Giao diện Dashboard Quản lý câu hỏi & sinh đề
├── data/                      # Ngân hàng dữ liệu JSON tĩnh
│   ├── listening/             # part-1.json, part-2.json, part-3.json, part-4.json
│   ├── reading/               # part-5.json, part-6.json, part-7.json
│   ├── speaking/              # describe-picture.json, opinion.json, read-aloud.json, respond-questions.json
│   ├── writing/               # email.json, essay.json, sentence.json
│   ├── vocabulary/            # business.json, finance.json, health.json, office.json, travel.json
│   ├── grammar/               # conditionals.json, passive.json, relative-clauses.json, tenses.json, word-form.json
│   └── mock-tests/            # test-01.json
├── test/
│   ├── suite.js               # Bộ kiểm thử tự động (Validation, Scoring, Generator, XSS)
│   └── server-test.js         # Kiểm thử API server, path traversal security, mock AI
├── server.js                  # Node.js backend proxy bảo mật & static server
├── package.json               # Cấu hình dự án & scripts
├── .env.example               # Mẫu biến môi trường cấu hình API Key AI
└── README.md                  # Tài liệu hướng dẫn sử dụng
```

---

## 🚀 Cài đặt và Chạy ứng dụng

### Yêu cầu hệ thống
- Node.js phiên bản 18+ (Dự án được tối ưu và kiểm thử trên Node.js v22).

### 1. Khởi động máy chủ ứng dụng
Chạy lệnh sau tại thư mục gốc của dự án:
```bash
npm start
# hoặc: node server.js
```
Mở trình duyệt và truy cập:
👉 `http://localhost:3000`

### 2. Cấu hình AI Generator (Tùy chọn)
Nếu bạn muốn sử dụng tính năng tạo câu hỏi tự động bằng AI trực tiếp qua OpenAI:
1. Tạo file `.env` từ file mẫu `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Điền API Key của bạn vào `.env`:
   ```env
   OPENAI_API_KEY=sk-...
   PORT=3000
   ```
*(Lưu ý: Nếu không điền API Key, hệ thống vẫn hoạt động bình thường với chế độ **Offline Template Generator** hoặc **Mock AI Mode** hoàn toàn miễn phí).*

---

## 🧪 Kiểm thử tự động (Automated Testing)

Dự án đi kèm bộ kiểm thử tự động toàn diện kiểm tra tính hợp lệ của toàn bộ file dữ liệu, thuật toán chấm điểm, và tính năng bảo mật:

```bash
npm test
# hoặc: node test/suite.js
```

Kết quả kiểm tra bao gồm:
- ✅ **Static Data Integrity**: Kiểm tra cấu trúc toàn bộ 25+ file JSON câu hỏi trong thư mục `data/`.
- ✅ **Quiz Engine & Multi-question Scoring**: Kiểm tra phân rã câu hỏi phụ Part 3, 4, 6, 7 và tính toán độ chính xác.
- ✅ **Anti-Inflation**: Đảm bảo không bị lặp điểm khi nộp bài nhiều lần.
- ✅ **TOEIC Scale Conversion**: Kiểm tra chuyển đổi điểm theo đường cong chuẩn hóa (10-990).
- ✅ **Template Generator**: Kiểm tra sinh câu hỏi tự động không trùng lặp và đúng đáp án.
- ✅ **XSS Protection**: Kiểm tra khả năng lọc sạch mã độc trong câu hỏi và giải thích.

---

## 📝 Định dạng Schema câu hỏi chuẩn

### Câu hỏi đơn (Listening Part 1-2, Reading Part 5):
```json
{
  "id": "read-p5-001",
  "skill": "reading",
  "part": 5,
  "q": "The customer service representative _____ resolved the customer complaint.",
  "options": ["quick", "quickly", "quickness", "quicker"],
  "correct": 1,
  "explanation": "Cần một trạng từ (adverb) bổ nghĩa cho động từ 'resolved'. 'quickly' là trạng từ phù hợp.",
  "level": "intermediate"
}
```

### Câu hỏi chùm (Listening Part 3-4, Reading Part 6-7):
```json
{
  "id": "read-p6-001",
  "skill": "reading",
  "part": 6,
  "passage": "Thank you for contacting City Center Fitness. We are pleased to inform you that...",
  "questions": [
    {
      "id": "read-p6-001-q1",
      "q": "Chỗ trống [1]:",
      "options": ["renovation", "renovate", "renovated", "renovating"],
      "correct": 0,
      "explanation": "Vị trí này cần danh từ làm tân ngữ."
    }
  ]
}
```

---

## 🛡️ Bảo mật và Kiểm soát lỗi
- **Proxy AI an toàn**: API Key chỉ được lưu trữ trên môi trường server (`process.env`), không bao giờ gửi về client.
- **Phòng chống Path Traversal**: Endpoint `/api/data` và trình đọc file tĩnh kiểm tra nghiêm ngặt đường dẫn cơ sở, ngăn chặn truy cập tệp nhạy cảm bên ngoài thư mục được cấp phép.
- **Sanitize HTML**: Mọi văn bản người dùng nhập hoặc import đều được lọc qua hàm `Validator.sanitizeHtml()`, chống tấn công XSS.

---

## 📄 Bản quyền
Dự án được xây dựng và nâng cấp bởi Đội ngũ Kỹ sư Cao cấp - **TOEIC Master Team**.
Giấy phép mã nguồn mở: MIT License.
