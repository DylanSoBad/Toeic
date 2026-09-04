/**
 * Writing Module - Practice interface for TOEIC Writing
 */
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let currentTypeId = 1;
let currentItems = [];
let currentIndex = 0;
let showSample = false;

export const WritingUI = {
  async init(typeId = 1) {
    currentTypeId = parseInt(typeId, 10) || 1;
    currentIndex = 0;
    showSample = false;

    const container = document.getElementById('writingContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải bài luyện Writing...</p></div>`;

    const data = await ContentLoader.getWritingData(currentTypeId);
    currentItems = data ? data.items || [] : [];

    this.render();
  },

  render() {
    const container = document.getElementById('writingContent');
    if (!container) return;

    if (!currentItems || currentItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✍️</div>
          <h3>Chưa có bài luyện Writing loại ${currentTypeId}</h3>
        </div>
      `;
      return;
    }

    const item = currentItems[currentIndex];

    let html = `
      <div class="writing-practice-box card animate-fadeIn">
        <div class="practice-header">
          <span class="badge badge-accent">Phần ${currentTypeId}</span>
          <span class="quiz-counter">Bài ${currentIndex + 1} / ${currentItems.length}</span>
        </div>

        <div class="writing-prompt-card">
          ${item.hint ? `<div class="writing-hint-box"><strong>Gợi ý:</strong> ${Validator.sanitizeHtml(item.hint)}</div>` : ''}
          ${item.email ? `<div class="writing-email-box"><div class="email-tag">Email nhận được:</div><pre class="email-pre">${Validator.sanitizeHtml(item.email)}</pre></div>` : ''}
          ${item.topicText ? `<div class="writing-topic-box"><strong>Đề bài luận:</strong><p>${Validator.sanitizeHtml(item.topicText)}</p></div>` : ''}
          ${item.question ? `<div class="writing-question-box"><strong>Yêu cầu:</strong> ${Validator.sanitizeHtml(item.question)}</div>` : ''}
          ${item.tips ? `<div class="tips-box"><span class="tip-icon">💡</span><div class="tip-text">${Validator.sanitizeHtml(item.tips)}</div></div>` : ''}
        </div>

        <div class="writing-editor-zone">
          <div class="editor-header">
            <span>Khu vực làm bài</span>
            <span class="word-counter" id="wordCountLabel">Số từ: 0</span>
          </div>
          <textarea class="writing-textarea" id="writingInput" placeholder="Nhập câu trả lời hoặc bài luận tiếng Anh của bạn tại đây..."></textarea>
        </div>

        <div class="writing-actions-zone">
          <button class="btn btn-primary" id="btnSubmitWriting">
            ✓ Hoàn thành & Ghi nhận bài tập
          </button>
          <button class="btn btn-secondary" id="btnToggleSample">
            📄 ${showSample ? 'Ẩn câu mẫu / bài mẫu' : 'Xem câu mẫu / bài mẫu'}
          </button>
        </div>

        <div class="sample-box" id="sampleBox" style="${showSample ? 'display:block;' : 'display:none;'}">
          <div class="sample-label">Bài làm mẫu (Sample Answer):</div>
          <div class="sample-text">${Validator.sanitizeHtml(item.sample || 'Chưa có mẫu cho bài này.')}</div>
          ${item.translation ? `<div class="sample-trans"><strong>Bản dịch:</strong> ${Validator.sanitizeHtml(item.translation)}</div>` : ''}
        </div>

        <div class="quiz-actions">
          <button class="btn btn-secondary" id="btnPrevWriting" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Bài trước
          </button>
          <button class="btn btn-secondary" id="btnNextWriting" ${currentIndex === currentItems.length - 1 ? 'disabled' : ''}>
            Bài tiếp theo →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachEvents();
  },

  attachEvents() {
    const input = document.getElementById('writingInput');
    const wordCountLabel = document.getElementById('wordCountLabel');
    if (input && wordCountLabel) {
      input.oninput = () => {
        const text = input.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        wordCountLabel.textContent = `Số từ: ${words}`;
      };
    }

    const btnToggleSample = document.getElementById('btnToggleSample');
    const sampleBox = document.getElementById('sampleBox');
    if (btnToggleSample && sampleBox) {
      btnToggleSample.onclick = () => {
        showSample = !showSample;
        sampleBox.style.display = showSample ? 'block' : 'none';
        btnToggleSample.innerHTML = showSample ? '📄 Ẩn câu mẫu / bài mẫu' : '📄 Xem câu mẫu / bài mẫu';
      };
    }

    const btnSubmit = document.getElementById('btnSubmitWriting');
    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const text = input ? input.value.trim() : '';
        if (text.length < 5) {
          alert('Vui lòng viết ít nhất một vài từ trước khi nộp bài!');
          return;
        }
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '✓ Đã ghi nhận tiến độ!';
        Progress.completeLesson('writing');
        // Show sample automatically after submission
        showSample = true;
        if (sampleBox) sampleBox.style.display = 'block';
      };
    }

    const btnPrev = document.getElementById('btnPrevWriting');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          showSample = false;
          this.render();
        }
      };
    }

    const btnNext = document.getElementById('btnNextWriting');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < currentItems.length - 1) {
          currentIndex++;
          showSample = false;
          this.render();
        }
      };
    }
  }
};
