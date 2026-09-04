/**
 * Vocabulary Module - Flashcards, Pronunciation, Shuffle & Learned Tracker
 */
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { Validator } from './validation.js';

let currentTopic = 'business';
let currentWords = [];
let currentIndex = 0;
let isFlipped = false;

export const VocabUI = {
  async init(topic = 'business') {
    currentTopic = topic;
    currentIndex = 0;
    isFlipped = false;

    const container = document.getElementById('vocabContent');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Đang tải từ vựng chủ đề ${currentTopic}...</p></div>`;

    const data = await ContentLoader.getVocabData(currentTopic);
    currentWords = data ? data.items || [] : [];

    this.render();
  },

  render() {
    const container = document.getElementById('vocabContent');
    if (!container) return;

    if (!currentWords || currentWords.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <h3>Chưa có từ vựng nào trong chủ đề này</h3>
        </div>
      `;
      return;
    }

    const wordItem = currentWords[currentIndex];
    const progressData = Progress.get();
    const isLearned = progressData.learnedWords && progressData.learnedWords[wordItem.word];

    let html = `
      <div class="vocab-container card animate-fadeIn">
        <div class="vocab-header">
          <div class="quiz-progress-info">
            <span class="badge badge-accent">${Validator.sanitizeHtml(currentTopic.toUpperCase())}</span>
            <span class="quiz-counter">Từ ${currentIndex + 1} / ${currentWords.length}</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="btnShuffleVocab">
            🔀 Trộn từ
          </button>
        </div>

        <!-- Flashcard -->
        <div class="flashcard-wrapper">
          <div class="flashcard ${isFlipped ? 'flipped' : ''}" id="flashcardElement">
            <!-- Front -->
            <div class="flashcard-face flashcard-front">
              <span class="card-hint">Bấm để lật thẻ</span>
              <div class="word-main">${Validator.sanitizeHtml(wordItem.word)}</div>
              <div class="word-phonetic">${Validator.sanitizeHtml(wordItem.phonetic || '')}</div>
              <div class="card-action-hint">👆 Xem nghĩa & câu ví dụ</div>
            </div>
            <!-- Back -->
            <div class="flashcard-face flashcard-back">
              <span class="card-hint">Bấm để lật lại</span>
              <div class="word-meaning">${Validator.sanitizeHtml(wordItem.meaning || '')}</div>
              <div class="word-example">
                <strong>Ví dụ:</strong> "${Validator.sanitizeHtml(wordItem.example || '')}"
              </div>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="vocab-actions">
          <button class="btn ${isLearned ? 'btn-success' : 'btn-primary'}" id="btnMarkLearned">
            ${isLearned ? '✓ Đã thuộc từ này' : '★ Đánh dấu đã thuộc'}
          </button>
        </div>

        <div class="quiz-actions">
          <button class="btn btn-secondary" id="btnPrevVocab" ${currentIndex === 0 ? 'disabled' : ''}>
            ← Từ trước
          </button>
          <button class="btn btn-secondary" id="btnNextVocab" ${currentIndex === currentWords.length - 1 ? 'disabled' : ''}>
            Từ tiếp theo →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
    this.attachEvents(wordItem);
  },

  attachEvents(wordItem) {
    const card = document.getElementById('flashcardElement');
    if (card) {
      card.onclick = () => {
        isFlipped = !isFlipped;
        card.classList.toggle('flipped', isFlipped);
      };
    }

    const btnMark = document.getElementById('btnMarkLearned');
    if (btnMark) {
      btnMark.onclick = () => {
        Progress.recordWordLearned(wordItem.word);
        btnMark.className = 'btn btn-success';
        btnMark.innerHTML = '✓ Đã thuộc từ này';
      };
    }

    const btnShuffle = document.getElementById('btnShuffleVocab');
    if (btnShuffle) {
      btnShuffle.onclick = () => {
        for (let i = currentWords.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [currentWords[i], currentWords[j]] = [currentWords[j], currentWords[i]];
        }
        currentIndex = 0;
        isFlipped = false;
        this.render();
      };
    }

    const btnPrev = document.getElementById('btnPrevVocab');
    if (btnPrev) {
      btnPrev.onclick = () => {
        if (currentIndex > 0) {
          currentIndex--;
          isFlipped = false;
          this.render();
        }
      };
    }

    const btnNext = document.getElementById('btnNextVocab');
    if (btnNext) {
      btnNext.onclick = () => {
        if (currentIndex < currentWords.length - 1) {
          currentIndex++;
          isFlipped = false;
          this.render();
        }
      };
    }
  }
};
