/**
 * Listening Module - UI & Audio Player for TOEIC Listening Parts 1 - 4
 */
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let currentPart = 1;
let currentItems = [];
let currentIndex = 0;
let userAnswers = {}; // { questionId: optionIndex }
let isChecked = false;

export const ListeningUI = {
  async init(part = 1) {
    currentPart = parseInt(part, 10) || 1;
    currentIndex = 0;
    userAnswers = {};
    isChecked = false;

    const container = document.getElementById('listeningContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải dữ liệu Listening Part ${currentPart}...</p></div>`;

    const data = await ContentLoader.getListeningData(currentPart);
    currentItems = data ? data.items || [] : [];

    this.render();
  },

  render() {
    const container = document.getElementById('listeningContent');
    if (!container) return;

    if (!currentItems || currentItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎧</div>
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

        <!-- Audio Player Section -->
        <div class="audio-player-box">
    `;

    if (item.audioUrl) {
      html += `
          <div class="real-audio-player">
            <audio controls src="${Validator.sanitizeHtml(item.audioUrl)}" class="custom-audio-elem" preload="metadata">
              Trình duyệt của bạn không hỗ trợ thẻ audio HTML5.
            </audio>
          </div>
      `;
    } else {
      html += `
          <div class="no-audio-badge">
            <span class="audio-status-icon">📢</span>
            <div class="audio-status-text">
              <strong>Chưa có file âm thanh cho câu hỏi này</strong>
              <span>Bạn có thể luyện nghe bằng cách bấm "Hiện transcript" hoặc xem nội dung bên dưới.</span>
            </div>
          </div>
      `;
    }

    // Transcript Toggle Section (Hidden by default)
    const transcriptText = item.transcript || item.audio || '';
    html += `
          <div class="transcript-section">
            <button class="btn btn-secondary btn-sm" id="btnToggleTranscript">
              👁️ ${isChecked ? 'Ẩn / Hiện transcript' : 'Hiện transcript'}
            </button>
            <div class="transcript-content ${isChecked ? 'visible' : ''}" id="transcriptBox" style="${isChecked ? 'display:block;' : 'display:none;'}">
              <div class="transcript-label">Transcript:</div>
              <div class="transcript-text">${Validator.sanitizeHtml(transcriptText)}</div>
            </div>
          </div>
        </div>
    `;

    // Question Rendering
    if (isMulti) {
      // Multi-question dialogue / talk
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
      // Single-choice question (Part 1, 2)
      const qId = item.id;
      const selected = userAnswers[qId];

      html += `
        <div class="single-question-box">
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
          <button class="btn btn-secondary" id="btnPrevListening" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Câu trước
          </button>

          ${!isChecked ? `
            <button class="btn btn-primary" id="btnCheckListening">
              ✓ Kiểm tra đáp án
            </button>
          ` : `
            <button class="btn btn-primary" id="btnNextListening">
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
    // Transcript toggle
    const btnToggle = document.getElementById('btnToggleTranscript');
    const transcriptBox = document.getElementById('transcriptBox');
    if (btnToggle && transcriptBox) {
      btnToggle.onclick = () => {
        const isHidden = transcriptBox.style.display === 'none';
        transcriptBox.style.display = isHidden ? 'block' : 'none';
        transcriptBox.classList.toggle('visible', isHidden);
      };
    }

    // Option clicks
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
      btn.onclick = () => {
        if (isChecked) return;
        const subId = btn.getAttribute('data-sub-id');
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        userAnswers[subId] = optIdx;

        // Deselect others in the same question
        document.querySelectorAll(`.option-btn[data-sub-id="${subId}"]`).forEach(b => {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
      };
    });

    // Check Answers
    const btnCheck = document.getElementById('btnCheckListening');
    if (btnCheck) {
      btnCheck.onclick = () => {
        if (isChecked) return; // Prevent multiple submit abuse

        // Evaluate question(s)
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

        // Record progress strictly once
        Progress.recordQuizResult({
          id: `listen-p${currentPart}-${item.id}`,
          skill: 'listening',
          part: currentPart,
          total: totalQuestions,
          correct: correctQuestions,
          durationSeconds: 0
        });

        // Re-render to show explanation & results
        this.render();

        // Show transcript automatically on check
        const tBox = document.getElementById('transcriptBox');
        if (tBox) tBox.style.display = 'block';
      };
    }

    // Navigation
    const btnPrev = document.getElementById('btnPrevListening');
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

    const btnNext = document.getElementById('btnNextListening');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < currentItems.length - 1) {
          currentIndex++;
          isChecked = false;
          userAnswers = {};
          this.render();
        } else {
          alert(`Chúc mừng! Bạn đã hoàn thành toàn bộ bài luyện tập Listening Part ${currentPart}.`);
          currentIndex = 0;
          isChecked = false;
          userAnswers = {};
          this.render();
        }
      };
    }
  }
};
