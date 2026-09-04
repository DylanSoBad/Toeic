/**
 * Reading Module - UI for TOEIC Reading Parts 5, 6, 7
 */
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let currentPart = 5;
let currentItems = [];
let currentIndex = 0;
let userAnswers = {};
let isChecked = false;

export const ReadingUI = {
  async init(part = 5) {
    currentPart = parseInt(part, 10) || 5;
    currentIndex = 0;
    userAnswers = {};
    isChecked = false;

    const container = document.getElementById('readingContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải dữ liệu Reading Part ${currentPart}...</p></div>`;

    const data = await ContentLoader.getReadingData(currentPart);
    currentItems = data ? data.items || [] : [];

    this.render();
  },

  render() {
    const container = document.getElementById('readingContent');
    if (!container) return;

    if (!currentItems || currentItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📖</div>
          <h3>Chưa có câu hỏi nào trong Part ${currentPart}</h3>
          <p>Bạn có thể thêm câu hỏi mới qua trang Quản lý nội dung hoặc bộ tạo AI.</p>
        </div>
      `;
      return;
    }

    const item = currentItems[currentIndex];
    const isMulti = item.type === 'multi-question' || Array.isArray(item.questions);

    let html = `
      <div class="quiz-container card animate-fadeIn">
        <div class="quiz-header">
          <div class="quiz-progress-info">
            <span class="badge badge-accent">Part ${currentPart}</span>
            <span class="quiz-counter">Mục ${currentIndex + 1} / ${currentItems.length}</span>
          </div>
          <div class="quiz-topic-tag">${Validator.sanitizeHtml(item.topic || 'General')}</div>
        </div>
    `;

    // Passage rendering for Part 6 & 7
    if (isMulti && item.passage) {
      html += `
        <div class="passage-box">
          <div class="passage-header">
            <span class="passage-tag">Đoạn văn đọc hiểu</span>
          </div>
          <div class="passage-text">${Validator.sanitizeHtml(item.passage)}</div>
        </div>
      `;
    }

    // Question Rendering
    if (isMulti) {
      html += `<div class="subquestions-list">`;
      item.questions.forEach((sub, subIdx) => {
        const subId = sub.id || `${item.id}-q${subIdx}`;
        const selected = userAnswers[subId];

        html += `
          <div class="subquestion-card">
            <div class="subquestion-title">
              <strong>Câu ${subIdx + 1}:</strong> ${Validator.sanitizeHtml(sub.q)}
            </div>
            <div class="options-grid">
        `;

        sub.options.forEach((opt, optIdx) => {
          let optClass = 'option-btn';
          if (selected === optIdx) optClass += ' selected';
          if (isChecked) {
            if (optIdx === sub.correct) optClass += ' correct';
            else if (selected === optIdx) optClass += ' wrong';
          }

          html += `
            <button class="${optClass}" data-sub-id="${subId}" data-opt-idx="${optIdx}" ${isChecked ? 'disabled' : ''}>
              <span class="option-label">${String.fromCharCode(65 + optIdx)}</span>
              <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
            </button>
          `;
        });

        html += `</div>`;

        if (isChecked && sub.explanation) {
          html += `
            <div class="explanation-box visible">
              <span class="exp-icon">💡</span>
              <div class="exp-text"><strong>Giải thích:</strong> ${Validator.sanitizeHtml(sub.explanation)}</div>
            </div>
          `;
        }

        html += `</div>`;
      });
      html += `</div>`;
    } else {
      // Single-choice question (Part 5)
      const qId = item.id;
      const selected = userAnswers[qId];

      html += `
        <div class="single-question-box">
          <div class="question-text">${Validator.sanitizeHtml(item.q || item.question || '')}</div>
          <div class="options-grid">
      `;

      item.options.forEach((opt, optIdx) => {
        let optClass = 'option-btn';
        if (selected === optIdx) optClass += ' selected';
        if (isChecked) {
          if (optIdx === item.correct) optClass += ' correct';
          else if (selected === optIdx) optClass += ' wrong';
        }

        html += `
          <button class="${optClass}" data-sub-id="${qId}" data-opt-idx="${optIdx}" ${isChecked ? 'disabled' : ''}>
            <span class="option-label">${String.fromCharCode(65 + optIdx)}</span>
            <span class="option-text">${Validator.sanitizeHtml(opt)}</span>
          </button>
        `;
      });

      html += `</div>`;

      if (isChecked && item.explanation) {
        html += `
          <div class="explanation-box visible">
            <span class="exp-icon">💡</span>
            <div class="exp-text"><strong>Giải thích:</strong> ${Validator.sanitizeHtml(item.explanation)}</div>
          </div>
        `;
      }

      html += `</div>`;
    }

    // Action Controls
    html += `
        <div class="quiz-actions">
          <button class="btn btn-secondary" id="btnPrevReading" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Câu trước
          </button>

          ${!isChecked ? `
            <button class="btn btn-primary" id="btnCheckReading">
              ✓ Kiểm tra đáp án
            </button>
          ` : `
            <button class="btn btn-primary" id="btnNextReading">
              ${currentIndex === currentItems.length - 1 ? 'Hoàn thành bài học' : 'Câu tiếp theo →'}
            </button>
          `}
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachEvents(item, isMulti);
  },

  attachEvents(item, isMulti) {
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
      btn.onclick = () => {
        if (isChecked) return;
        const subId = btn.getAttribute('data-sub-id');
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        userAnswers[subId] = optIdx;

        document.querySelectorAll(`.option-btn[data-sub-id="${subId}"]`).forEach(b => {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
      };
    });

    const btnCheck = document.getElementById('btnCheckReading');
    if (btnCheck) {
      btnCheck.onclick = () => {
        if (isChecked) return;

        let totalQuestions = 0;
        let correctQuestions = 0;

        if (isMulti) {
          totalQuestions = item.questions.length;
          item.questions.forEach((sub, subIdx) => {
            const subId = sub.id || `${item.id}-q${subIdx}`;
            if (userAnswers[subId] === sub.correct) {
              correctQuestions++;
            }
          });
        } else {
          totalQuestions = 1;
          if (userAnswers[item.id] === item.correct) {
            correctQuestions++;
          }
        }

        isChecked = true;

        Progress.recordQuizResult({
          id: `read-p${currentPart}-${item.id}`,
          skill: 'reading',
          part: currentPart,
          total: totalQuestions,
          correct: correctQuestions,
          durationSeconds: 0
        });

        this.render();
      };
    }

    const btnPrev = document.getElementById('btnPrevReading');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          isChecked = false;
          userAnswers = {};
          this.render();
        }
      };
    }

    const btnNext = document.getElementById('btnNextReading');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < currentItems.length - 1) {
          currentIndex++;
          isChecked = false;
          userAnswers = {};
          this.render();
        } else {
          alert(`Chúc mừng! Bạn đã hoàn thành toàn bộ bài luyện tập Reading Part ${currentPart}.`);
          currentIndex = 0;
          isChecked = false;
          userAnswers = {};
          this.render();
        }
      };
    }
  }
};
