# TOEIC Master 3.0

Ứng dụng học TOEIC cá nhân chạy bằng HTML, CSS, JavaScript modules và Node.js. Nội dung nằm trong JSON; bạn có thể cập nhật qua giao diện quản lý hoặc tạo bài bằng AI rồi duyệt.

## Chạy trên máy

Cần Node.js 22 trở lên. Ứng dụng và kiểm thử nghiệp vụ không cần cài thư viện ngoài.

```sh
npm start
```

Mở http://127.0.0.1:3000. Giữ nguyên địa chỉ và cổng trong các lần dùng để đọc đúng dữ liệu trình duyệt đã lưu. localhost và 127.0.0.1 là hai vùng lưu trữ khác nhau.

Server mặc định chỉ nghe trên máy này. Có thể đặt PORT và HOST qua biến môi trường. Không mở index.html trực tiếp bằng file:// vì các module cần tải JSON qua HTTP.

## Luồng học

1. Vào **Mục tiêu của tôi**, nhập điểm mục tiêu, thời gian học mỗi ngày, ngày thi tùy chọn và Part muốn cải thiện.
2. Làm bài **Kiểm tra đầu vào**, hoặc học theo kế hoạch trước. Số câu được tính từ ngân hàng hiện có, tính riêng từng câu con.
3. Sau khi nộp, xem độ chính xác, câu sai/chưa trả lời, giải thích và nhóm kiến thức cần ôn.
4. Mở **Lộ trình học** để học theo ngày, hoàn thành, bỏ qua hoặc dời nhiệm vụ. Bài khảo sát tạo gợi ý cho bảy ngày đầu.
5. **Sổ câu cần ôn** lấy lần làm gần nhất của mỗi câu. Câu làm đúng sẽ rời danh sách sai; câu bạn lưu thủ công được giữ đến khi bỏ lưu.
6. **Tiến độ** và **Nhật ký học** phản ánh các lượt làm thật. Kết quả mới cập nhật lại gợi ý đang chờ trong ngày.

Bộ đề xuất hiện dùng quy tắc: độ chính xác, dạng câu sai, số mẫu đã làm, Part người học chọn, lượt học gần đây, thời gian học và ngày thi. Đề xuất có lý do, ưu tiên câu chưa gặp hoặc đã lâu chưa làm. Đây không phải một mô hình AI đánh giá trình độ.

Đánh dấu nhiệm vụ hoàn thành chỉ đổi kế hoạch. Điểm và số câu đúng chỉ tăng khi một lượt làm được nộp. Speaking/Writing được ghi nhận là tự luyện, không phải chấm nói/viết tự động.

## Quản lý nội dung

Vào **Quản lý nội dung → Ngân hàng câu hỏi**:

- Tìm theo từ khóa, lọc kỹ năng, Part, chủ đề, mức độ và trạng thái.
- Thêm/sửa bài bằng biểu mẫu. Có trường riêng cho Reading/Listening, Speaking, Writing, từ vựng và quy tắc ngữ pháp.
- Với bài theo đoạn, sửa nội dung đoạn và thêm/xóa/sửa từng câu con, đáp án và giải thích.
- Xem trước bài; nhân bản sẽ tạo ID mới và lưu bản nháp.
- Xóa có xác nhận. Xóa bài có sẵn tạo dấu ẩn trong bộ nhớ trình duyệt, không xóa file nguồn.
- Duyệt bản nháp để bài được đưa vào phần luyện tập.

Nội dung bạn sửa được lưu trong localStorage, ghi đè bài gốc theo ID. Thay đổi Part/kỹ năng/trạng thái sẽ cập nhật đúng nhóm luyện tập. Bản nháp không xuất hiện trong bài luyện.

### Nhập và xuất JSON

**Import JSON** nhận một object bài tập, mảng bài tập hoặc object chứa items/rules. File tối đa 2 MB, mảng tối đa 5.000 bài. Toàn bộ lô được kiểm tra trước khi lưu; lô có lỗi sẽ bị từ chối.

Nếu ID đã tồn tại, phải chủ động bật **Thay thế bài có ID đã tồn tại**. Bài mang nguồn AI/mô phỏng được nhập ở trạng thái draft. **Export kết quả** xuất nhóm đang lọc; **Export tất cả** xuất ngân hàng hiện tại.

Muốn cập nhật bộ dữ liệu gốc cho các trình duyệt khác: xuất JSON, đặt các items vào file tương ứng trong data/ và tải lại ứng dụng. Không có API ghi tùy ý vào ổ đĩa. /api/data/save trả 405; giao diện dùng bộ nhớ trình duyệt và xuất file.

Xuất ngân hàng không bao gồm toàn bộ lịch sử học, hồ sơ hoặc lượt đang làm. Để sao lưu toàn bộ trạng thái cá nhân, sao lưu giá trị khóa toeic_master_data từ vùng lưu trữ của trình duyệt. Chưa có chức năng tài khoản hoặc đồng bộ nhiều thiết bị.

### Schema câu trắc nghiệm

```json
{
  "id": "reading-p5-custom-001",
  "version": 1,
  "skill": "reading",
  "part": 5,
  "type": "single-choice",
  "topic": "office",
  "level": "beginner",
  "q": "The manager _____ the report yesterday.",
  "options": ["reviewed", "reviewing", "reviews", "review"],
  "correct": 0,
  "explanation": "Yesterday xác định quá khứ; reviewed là động từ quá khứ đơn.",
  "questionType": "verb-tense",
  "grammarPoint": "verb-tense",
  "source": "manual",
  "status": "approved"
}
```

Đáp án correct bắt đầu từ 0. Không dùng correctAnswer thay thế. ID phải duy nhất ở cả cấp bài và câu con. Các lựa chọn phải khác nhau.

Bài theo đoạn dùng type: multi-question, passage hoặc transcript và questions. Mỗi câu con có id, q, options, correct, explanation và metadata riêng. Metadata cấp cha được kế thừa khi chấm bài.

Metadata hỗ trợ: questionType, grammarPoint, vocabularyTopic, trapType, estimatedTime, topic và level. Không suy đoán nguyên nhân tâm lý của lỗi; phân tích chỉ nhóm theo metadata đã có.

Nội dung khác:

- Speaking: skill speaking, part 1–4, text; tùy chọn sample, tips, translation.
- Writing: skill writing, part 1–3, question/hint/topicText; tùy chọn email, sample.
- Vocabulary: skill vocabulary, topic, word, meaning; tùy chọn phonetic, example.
- Grammar: skill grammar, topic, title, formula/usage; tùy chọn examples (mảng chuỗi), keywords.

## Tạo bài offline

Trong **Sinh bài tập mẫu**, chọn chuyên đề, độ khó, số câu và có/không có giải thích. Bộ mẫu hỗ trợ Reading Part 5: thì, từ loại, bị động, điều kiện, từ vựng.

Kho mẫu hữu hạn. Khi số câu phù hợp ít hơn số yêu cầu, giao diện thông báo và chỉ trả số mẫu hiện có; không nhân bản câu để đủ số lượng. Đáp án được trộn và vẫn chấm theo chỉ số đúng mới. Có thể xem trước rồi thêm từng câu hoặc cả lô.

Offline ở đây nghĩa là bộ tạo theo mẫu không gọi AI hoặc dịch vụ mạng; ứng dụng vẫn cần được phục vụ từ Node/static server. Chưa có service worker/PWA để mở toàn bộ app từ cache khi server ngừng chạy.

## Cấu hình AI

Sao chép .env.example thành .env trên máy, điền OPENAI_API_KEY và khởi động lại server.

```env
PORT=3000
HOST=127.0.0.1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AI_TIMEOUT_MS=25000
```

Điền key thật trực tiếp trong file .env trên máy. Không đặt key trong mã frontend, JSON bài tập hoặc Git.

Trong **Tạo bài tập bằng AI**:

1. Chọn kỹ năng, Part/loại bài, chủ đề, độ khó, số bài và ngôn ngữ giải thích.
2. Có thể mở từ **Tạo bài AI theo điểm yếu** để điền mục tiêu, nhóm câu sai và các đáp án gần đây.
3. Bấm tạo để gửi yêu cầu tới server.
4. Xem trước, sửa và duyệt bản nháp. Chỉ bài approved được dùng để luyện.

Hỗ trợ cấu trúc cho Listening, Reading, Speaking, Writing, Vocabulary và Grammar. Part trong Speaking/Writing là loại bài nội bộ của ứng dụng, không phải số câu trên đề thi chính thức.

Backend dùng OpenAI Chat Completions với Structured Outputs, schema riêng theo dạng bài. Có kiểm tra schema và nội dung bắt buộc, giới hạn số lượng, chống ID/lựa chọn trùng và kiểm tra cả lô. Tạo bài từ điểm yếu chỉ gửi các đoạn ngữ cảnh được chọn, không gửi toàn bộ localStorage.

Tham khảo kỹ thuật: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### Phân biệt AI thật và mô phỏng

- Thiếu key: API trả lỗi 503 rõ ràng. Không tự chuyển yêu cầu AI thật thành nội dung giả.
- **Thử nghiệm chế độ Mock**: dữ liệu kiểm thử được ghi source ai-mock và nhãn mô phỏng, đi qua cùng luồng validate/draft/duyệt.
- AI thật trả source ai, model, generationConfig, createdAt, reviewedAt và validationResult.
- Validation chứng minh dữ liệu phù hợp cấu trúc, không đảm bảo câu hỏi không mơ hồ hoặc mọi giải thích đều đúng. Cần duyệt nội dung.
- Chưa xác minh gọi AI thật trong lần triển khai này vì không có API key. Tích hợp được kiểm thử bằng mock HTTP provider và luồng trình duyệt.

Không lưu, ghi log hoặc gửi lại API key cho trình duyệt. Giới hạn đầu vào 32 KB, 1–10 bài/nhóm mỗi lần, 12 lượt/phút trong một tiến trình và timeout tối đa 60 giây. Serverless có thể chạy nhiều tiến trình; bộ giới hạn trong bộ nhớ không phải quota toàn hệ thống. Chưa triển khai xác thực nhiều người dùng; không mở API dùng key trả phí cho Internet trước khi có lớp truy cập phù hợp.

## Audio và chấm điểm

Có thể gán audioUrl/imageUrl tới đường dẫn file hoặc URL HTTP(S) hợp lệ. Ví dụ: audio/part-2-001.mp3. Audio thật dùng HTML audio có phát/tạm dừng và nghe lại; server hỗ trợ byte ranges.

Kho gốc hiện chưa có file audio hoặc ảnh đề bài thật. UI thông báo thiếu audio, transcript mặc định ẩn, việc xem transcript được ghi là hỗ trợ. Bài Listening này giúp luyện nội dung; không đánh giá đầy đủ năng lực nghe. AI tạo transcript/miêu tả ảnh, không tự tạo file audio/ảnh.

Kết quả hiển thị số đúng, sai, bỏ trống, Listening/Reading và độ chính xác. Không công bố điểm quy đổi là điểm TOEIC chính thức. Hàm estimateToeicScore chỉ được giữ để tương thích, là quy đổi minh họa chưa hiệu chuẩn; giao diện mới dùng độ chính xác.

Mock test và khảo sát lưu deadline theo thời gian thực, giữ đáp án khi rời trang/tải lại. Một attempt ID chỉ được ghi nhận một lần. Luyện lại chủ động tạo attempt mới.

## Kiến trúc

```text
index.html / css/style.css / css/learning.css
js/app.js                         Điều hướng và đồng bộ giao diện
js/modules/storage.js             localStorage v3, migration, thông báo lỗi lưu
js/modules/progress.js            Lịch sử, thống kê, streak, chống ghi trùng
js/modules/quiz-engine.js         Chấm câu đơn/nhóm, lưu và khôi phục lượt làm
js/modules/learning.js            Phân tích, đề xuất, kế hoạch và sổ câu sai
js/modules/personal-learning-ui.js Hồ sơ, trang chủ, khảo sát, kế hoạch, nhật ký
js/modules/content-loader.js      JSON, validate, ghi đè và xóa cục bộ
js/modules/validation.js          Kiểm tra dữ liệu dùng chung browser/server
js/modules/admin.js               Biểu mẫu quản lý, nhập/xuất, duyệt bài
js/modules/ai-generator.js        Client AI, kiểm tra và lưu nháp
js/modules/template-generator.js  Ngân hàng mẫu offline
js/modules/{listening,reading,speaking,writing,vocabulary,grammar,mock-test}.js
data/                             Nội dung bài tập gốc theo nhóm
server.js                         Static server và API trên Node
server/ai-service.js               Schema/prompt/AI service dùng chung
api/ai-generate.js                 Adapter API cho Vercel
scripts/build.mjs                 Chỉ đóng gói nội dung công khai vào dist/
test/                             Kiểm thử nghiệp vụ, server và trình duyệt
```

Storage v3 chuyển từ toeic_progress hoặc v2 sang cấu trúc mới, giữ tiến độ, bài tùy chỉnh, hồ sơ và trường chưa biết. Không tạo ngày học giả. JSON lỗi được giữ nguyên và báo lỗi; ghi thất bại không được coi là thành công.

Nút **Đặt lại tiến độ học** giữ ngân hàng tùy chỉnh và mục tiêu, không xóa dữ liệu ứng dụng khác cùng origin. Lịch sử và lượt đang làm sẽ mất sau khi bạn xác nhận đặt lại.

Thiết kế tham khảo luồng học của [English Michael](https://englishmichael.com/), giữ nhận diện TOEIC Master. Không nhập hình ảnh, lời chứng thực, mã nguồn hoặc đề thi từ website tham khảo.

## Kiểm thử và build

```sh
npm test
npm run build
```

npm test chạy bộ kiểm tra dữ liệu ban đầu và các test Node: validation/import, migration, chấm câu con, chống nộp trùng, streak, kế hoạch, AI schema/mock, lỗi provider/timeout, private files và path traversal. Test API mở cổng tạm tự đóng, không dùng key thật hoặc gọi OpenAI.

Kiểm thử trình duyệt là tùy chọn, cần Playwright trong môi trường công cụ:

```sh
npm run test:browser
```

Nếu module Playwright không nằm trong node_modules của dự án, đặt TOEIC_PLAYWRIGHT_PATH tới module đã cài. Đặt TOEIC_BROWSER_CHANNEL=msedge để dùng Edge có sẵn, hoặc dùng Chromium do Playwright quản lý.

Bộ browser test dùng profile riêng, server cổng tạm và env rỗng, không thay dữ liệu trình duyệt bạn dùng. Có kiểm tra onboarding, khảo sát/reload, sửa bài con/từ vựng, JSON import/export, draft AI, Reading, các tab Grammar, mock timer, Speaking/Writing và layout 390/768/1440 px. Ảnh kiểm tra nằm trong test-results/ (không đưa vào Git).

Build tạo dist/ chỉ gồm tài nguyên công khai. vercel.json trỏ outputDirectory vào dist/, không xuất toàn bộ repository. Chưa thực hiện deploy hoặc xác minh runtime Vercel trong lần triển khai này.

## Giới hạn hiện tại

- Ngân hàng nhỏ; cần tiếp tục biên soạn và duyệt nội dung để phục vụ ôn thi dài hạn.
- Chưa có tài khoản, đồng bộ nhiều máy, lịch nhắc ngoài ứng dụng hoặc chấm nói/viết tự động.
- Chưa có audio/ảnh đề thật hoặc TTS. Thêm media hợp lệ vào kho để luyện nghe đúng nghĩa.
- Bộ mẫu offline hữu hạn; AI thật cần API key và tài khoản có hạn mức.
- Nội dung cũ chưa có metadata sẽ được hiển thị chung hoặc theo Part; không tự gán nguyên nhân sai không có bằng chứng.
