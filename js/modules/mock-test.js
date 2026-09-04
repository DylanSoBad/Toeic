/**
 * Mock Test Module - 20-question Timed Exam, Subquestion Evaluation & TOEIC Score Estimate
 */
import { ContentLoader } from './content-loader.js';
import { QuizSession } from './quiz-engine.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let session = null;
let flattenedQuestions = [];
let currentIndex = 0;
let timerInterval = null;
let remainingSeconds = 25 * 60; // 25 minutes

export const MockTestUI = {
  async init() {
    this.stopTimer();
    const container = document.getElementById('mockTestContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang chuẩn bị đề thi thử TOEIC...</p></div>`;

    const data = await ContentLoader.getMockTestData();
    const items = data ? data.items || [] : [];

    session = new QuizSession(items);
    flattenedQuestions = session.getFlattenedQuestions();
    currentIndex = 0;
    remainingSeconds = (data && data.durationMinutes ? data.durationMinutes : 25) * 60;

    this.renderIntro(data);
  },

  renderIntro(data) {
    const container = document.getElementById('mockTestContent');
    if (!container) return;

    container.innerHTML = `
      <div class="mock-intro-card card animate-fadeIn">
        <div class="mock-intro-icon">⏱️</div>
        <h2>${Validator.sanitizeHtml(data.title || 'Đề thi thử TOEIC')}</h2>
        <p class="mock-intro-desc">${Validator.sanitizeHtml(data.description || 'Bài thi trắc nghiệm rút gọn 20 câu mô phỏng cấu trúc đề thi TOEIC thật.')}</p>

        <div class="mock-info-grid">
          <div class="info-card">
            <span class="info-num">20</span>
            <span class="info-lbl">Câu hỏi (10 L + 10 R)</span>
          </div>
          <div class="info-card">
            <span class="info-num">25</span>
            <span class="info-lbl">Phút làm bài</span>
          </div>
          <div class="info-card">
            <span class="info-num">990</span>
            <span class="info-lbl">Thang điểm ước lượng</span>
          </div>
        </div>

        <div class="mock-guidelines">
          <h4>Quy chế phòng thi:</h4>
          <ul>
            <li>Đồng hồ đếm ngược sẽ bắt đầu chạy ngay khi bạn bấm "Bắt đầu làm bài".</li>
            <li>Bạn có thể tự do chuyển đổi giữa các câu hỏi bằng thanh điều hướng bên dưới.</li>
            <li>Hệ thống tự động chấm điểm và quy đổi sang dải điểm TOEIC ước lượng ngay khi nộp bài.</li>
          </ul>
        </div>

        <button class="btn btn-primary btn-lg" id="btnStartMock">
          🚀 Bắt đầu làm bài ngay
        </button>
      </div>
    `;

    const btnStart = document.getElementById('btnStartMock');
    if (btnStart) {
      btnStart.onclick = () => {
        this.startTimer();
        this.renderQuestionView();
      };
    }
  },

  startTimer() {
    this.stopTimer();
    timerInterval = setInterval(() => {
      remainingSeconds--;
      this.updateTimerDisplay();
      if (remainingSeconds <= 0) {
        this.stopTimer();
        alert('Hết giờ làm bài! Hệ thống đang tự động nộp bài và tổng hợp kết quả.');
        this.submitExam();
      }
    }, 1000);
  },

  stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  },

  updateTimerDisplay() {
    const timerElem = document.getElementById('mockTimer');
    if (!timerElem) return;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    timerElem.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (remainingSeconds < 300) {
      timerElem.classList.add('timer-warning');
    }
  },

  renderQuestionView() {
    const container = document.getElementById('mockTestContent');
    if (!container) return;

    const q = flattenedQuestions[currentIndex];
    const totalQ = flattenedQuestions.length;
    const selectedOpt = session.getAnswer(q.id);

    let html = `
      <div class="mock-exam-layout animate-fadeIn">
        <!-- Top bar with Timer and Progress -->
        <div class="mock-top-bar card">
          <div class="mock-meta-left">
            <span class="badge ${q.skill === 'listening' ? 'badge-info' : 'badge-accent'}">
              ${q.skill === 'listening' ? '🎧 Listening' : '📖 Reading'}
            </span>
            <span class="mock-q-counter">Câu ${currentIndex + 1} / ${totalQ}</span>
          </div>
          <div class="mock-timer-box">
            <span class="timer-icon">⏳</span>
            <span class="mock-timer" id="mockTimer">25:00</span>
          </div>
          <div class="mock-meta-right">
            <button class="btn btn-warning btn-sm" id="btnSubmitMockEarly">
              ✓ Nộp bài thi
            </button>
          </div>
        </div>

        <!-- Question Body -->
        <div class="mock-question-card card">
    `;

    if (q.passage) {
      html += `
        <div class="passage-box">
          <div class="passage-header">
            <span class="passage-tag">Tài liệu / Đoạn văn câu hỏi ${q.subIndex + 1}/${q.totalSubInGroup}</span>
          </div>
          <div class="passage-text">${Validator.sanitizeHtml(q.passage)}</div>
        </div>
      `;
    }

    html += `
          <div class="mock-question-title">
            <strong>Câu ${currentIndex + 1}:</strong> ${Validator.sanitizeHtml(q.q || '')}
          </div>

          <div class="options-grid">
    `;

    q.options.forEach((opt, optIdx) => {
      const isSelected = selectedOpt === optIdx;
      html += `
        <button class="option-btn ${isSelected ? 'selected' : ''}" data-opt-idx="${optIdx}">
          <span class="option-label">${String.fromCharCode(65 + optIdx)}</span>
          <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
        </button>
      `;
    });

    html += `
          </div>
        </div>

        <!-- Question Palette / Navigation Grid -->
        <div class="mock-nav-palette card">
          <div class="palette-title">Danh sách câu hỏi:</div>
          <div class="palette-grid">
    `;

    flattenedQuestions.forEach((item, idx) => {
      const hasAns = typeof session.getAnswer(item.id) === 'number';
      let pClass = 'palette-btn';
      if (idx === currentIndex) pClass += ' active';
      if (hasAns) pClass += ' answered';

      html += `<button class="${pClass}" data-goto-idx="${idx}">${idx + 1}</button>`;
    });

    html += `
          </div>
        </div>

        <!-- Bottom Actions -->
        <div class="mock-actions-bar">
          <button class="btn btn-secondary" id="btnMockPrev" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Câu trước
          </button>
          <button class="btn btn-secondary" id="btnMockNext" ${currentIndex === totalQ - 1 ? 'disabled' : ''}>
            Câu tiếp theo →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.updateTimerDisplay();
    this.attachExamEvents();
  },

  attachExamEvents() {
    // Select option
    const q = flattenedQuestions[currentIndex];
    const optionBtns = document.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
      btn.onclick = () => {
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        session.selectAnswer(q.id, optIdx);

        optionBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        // Update palette
        const paletteBtn = document.querySelector(`.palette-btn[data-goto-idx="${currentIndex}"]`);
        if (paletteBtn) paletteBtn.classList.add('answered');
      };
    });

    // Palette jump
    const paletteBtns = document.querySelectorAll('.palette-btn');
    paletteBtns.forEach(btn => {
      btn.onclick = () => {
        currentIndex = parseInt(btn.getAttribute('data-goto-idx'), 10);
        this.renderQuestionView();
      };
    });

    // Navigation buttons
    const btnPrev = document.getElementById('btnMockPrev');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          this.renderQuestionView();
        }
      };
    }

    const btnNext = document.getElementById('btnMockNext');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < flattenedQuestions.length - 1) {
          currentIndex++;
          this.renderQuestionView();
        }
      };
    }

    // Early submit
    const btnSubmit = document.getElementById('btnSubmitMockEarly');
    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const answeredCount = flattenedQuestions.filter(x => typeof session.getAnswer(x.id) === 'number').length;
        const total = flattenedQuestions.length;
        if (answeredCount < total) {
          if (!confirm(`Bạn mới làm được ${answeredCount}/${total} câu. Bạn có chắc chắn muốn nộp bài sớm không?`)) {
            return;
          }
        } else {
          if (!confirm('Bạn đã trả lời đủ tất cả các câu. Xác nhận nộp bài?')) {
            return;
          }
        }
        this.stopTimer();
        this.submitExam();
      };
    }
  },

  submitExam() {
    this.stopTimer();
    const result = session.evaluate();

    // Record strictly once to Progress
    Progress.recordMockTest({
      total: result.total,
      correct: result.correct,
      durationSeconds: result.durationSeconds
    });

    this.renderResultView(result);
  },

  renderResultView(result) {
    const container = document.getElementById('mockTestContent');
    if (!container) return;

    const est = result.estimatedScore;

    let html = `
      <div class="mock-result-container animate-fadeIn">
        <div class="mock-score-card card">
          <div class="result-badge">KẾT QUẢ THI THỬ</div>
          <div class="total-score-display">
            <span class="score-num">${est.totalScore}</span>
            <span class="score-max">/ 990</span>
          </div>
          <p class="score-disclaimer"><em>* ${Validator.sanitizeHtml(est.disclaimer)}</em></p>

          <div class="subscore-grid">
            <div class="subscore-card">
              <span class="subscore-title">🎧 Listening Score</span>
              <span class="subscore-val">${est.listeningScore} / 495</span>
              <span class="subscore-raw">Đúng: ${result.listening.correct}/${result.listening.total} câu</span>
            </div>
            <div class="subscore-card">
              <span class="subscore-title">📖 Reading Score</span>
              <span class="subscore-val">${est.readingScore} / 495</span>
              <span class="subscore-raw">Đúng: ${result.reading.correct}/${result.reading.total} câu</span>
            </div>
          </div>

          <div class="result-stats-row">
            <div><strong>Tỷ lệ chính xác:</strong> ${result.accuracy}%</div>
            <div><strong>Thời gian hoàn thành:</strong> ${Math.floor(result.durationSeconds / 60)} phút ${result.durationSeconds % 60} giây</div>
          </div>

          <div class="result-cta-buttons">
            <button class="btn btn-primary" id="btnRetakeMock">
              🔄 Làm lại đề này
            </button>
          </div>
        </div>

        <!-- Detailed Breakdown -->
        <div class="mock-review-card card">
          <h3>Chi tiết đáp án & Giải thích từng câu:</h3>
          <div class="review-list">
    `;

    result.breakdown.forEach((item, idx) => {
      html += `
        <div class="review-item ${item.isCorrect ? 'is-correct' : 'is-wrong'}">
          <div class="review-q-header">
            <span class="review-q-num">Câu ${idx + 1}</span>
            <span class="review-status-badge ${item.isCorrect ? 'correct' : 'wrong'}">
              ${item.isCorrect ? '✓ Đúng' : (item.isAnswered ? '✗ Sai' : '○ Chưa làm')}
            </span>
          </div>
          <div class="review-q-text">${Validator.sanitizeHtml(item.q)}</div>

          <div class="review-options">
      `;

      item.options.forEach((opt, optIdx) => {
        let optCls = 'review-opt';
        if (optIdx === item.correct) optCls += ' correct-answer';
        if (optIdx === item.selected && !item.isCorrect) optCls += ' wrong-answer';

        html += `
          <div class="${optCls}">
            <span class="opt-mark">${String.fromCharCode(65 + optIdx)}</span>
            <span>${Validator.sanitizeHtml(opt)}</span>
            ${optIdx === item.correct ? ' <strong>(Đáp án đúng)</strong>' : ''}
            ${optIdx === item.selected && !item.isCorrect ? ' <em>(Bạn đã chọn)</em>' : ''}
          </div>
        `;
      });

      html += `</div>`;

      if (item.explanation) {
        html += `
          <div class="explanation-box visible">
            <span class="exp-icon">💡</span>
            <div class="exp-text"><strong>Giải thích:</strong> ${Validator.sanitizeHtml(item.explanation)}</div>
          </div>
        `;
      }

      html += `</div>`;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const btnRetake = document.getElementById('btnRetakeMock');
    if (btnRetake) {
      btnRetake.onclick = () => {
        this.init();
      };
    }
  }
};
