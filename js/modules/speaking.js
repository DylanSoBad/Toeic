/**
 * Speaking Module - Practice interface for TOEIC Speaking Parts 1 - 4
 */
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let currentTypeId = 1;
let currentItems = [];
let currentIndex = 0;
let showTranslation = false;

export const SpeakingUI = {
  async init(typeId = 1) {
    currentTypeId = parseInt(typeId, 10) || 1;
    currentIndex = 0;
    showTranslation = false;

    const container = document.getElementById('speakingContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải bài luyện Speaking...</p></div>`;

    const data = await ContentLoader.getSpeakingData(currentTypeId);
    currentItems = data ? data.items || [] : [];

    this.render();
  },

  render() {
    const container = document.getElementById('speakingContent');
    if (!container) return;

    if (!currentItems || currentItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗣️</div>
          <h3>Chưa có bài luyện Speaking loại ${currentTypeId}</h3>
        </div>
      `;
      return;
    }

    const item = currentItems[currentIndex];

    let html = `
      <div class="speaking-practice-box card animate-fadeIn">
        <div class="practice-header">
          <span class="badge badge-accent">Phần ${currentTypeId}</span>
          <span class="quiz-counter">Bài ${currentIndex + 1} / ${currentItems.length}</span>
        </div>

        <div class="speaking-prompt-card">
          <div class="speaking-text-area">
            ${Validator.sanitizeHtml(item.text || item.sample || '')}
          </div>

          ${item.tips ? `
            <div class="tips-box">
              <span class="tip-icon">💡</span>
              <div class="tip-text"><strong>Mẹo làm bài:</strong> ${Validator.sanitizeHtml(item.tips)}</div>
            </div>
          ` : ''}

          <div class="speaking-translation-toggle">
            <button class="btn btn-secondary btn-sm" id="btnToggleTrans">
              🌐 ${showTranslation ? 'Ẩn bản dịch Tiếng Việt' : 'Xem bản dịch Tiếng Việt'}
            </button>
            <div class="translation-text" id="transBox" style="${showTranslation ? 'display:block;' : 'display:none;'}">
              ${Validator.sanitizeHtml(item.translation || 'Không có bản dịch cho bài này.')}
            </div>
          </div>
        </div>

        <div class="practice-recording-zone">
          <div class="record-timer-status" id="timerStatus">
            <span>Sẵn sàng luyện nói</span>
          </div>
          <button class="btn btn-primary btn-record" id="btnRecordPractice">
            🎙️ Bắt đầu luyện nói (Ghi nhận bài học)
          </button>
        </div>

        <div class="quiz-actions">
          <button class="btn btn-secondary" id="btnPrevSpeaking" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Bài trước
          </button>
          <button class="btn btn-secondary" id="btnNextSpeaking" ${currentIndex === currentItems.length - 1 ? 'disabled' : ''}>
            Bài tiếp theo →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachEvents();
  },

  attachEvents() {
    const btnToggle = document.getElementById('btnToggleTrans');
    const transBox = document.getElementById('transBox');
    if (btnToggle && transBox) {
      btnToggle.onclick = () => {
        showTranslation = !showTranslation;
        transBox.style.display = showTranslation ? 'block' : 'none';
        btnToggle.innerHTML = showTranslation ? '🌐 Ẩn bản dịch Tiếng Việt' : '🌐 Xem bản dịch Tiếng Việt';
      };
    }

    const btnRecord = document.getElementById('btnRecordPractice');
    const timerStatus = document.getElementById('timerStatus');
    if (btnRecord && timerStatus) {
      btnRecord.onclick = () => {
        btnRecord.disabled = true;
        btnRecord.innerHTML = '⏱️ Đang tính giờ luyện nói...';
        timerStatus.innerHTML = '<span class="status-active">● Đang trong phiên luyện nói (15s)...</span>';

        setTimeout(() => {
          btnRecord.disabled = false;
          btnRecord.innerHTML = '✓ Đã hoàn thành lần nói';
          timerStatus.innerHTML = '<span class="status-done">✓ Đã ghi nhận tiến độ học Speaking!</span>';
          Progress.completeLesson('speaking');
        }, 3000);
      };
    }

    const btnPrev = document.getElementById('btnPrevSpeaking');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          showTranslation = false;
          this.render();
        }
      };
    }

    const btnNext = document.getElementById('btnNextSpeaking');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < currentItems.length - 1) {
          currentIndex++;
          showTranslation = false;
          this.render();
        }
      };
    }
  }
};
