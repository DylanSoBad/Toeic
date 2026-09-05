/** Self-directed speaking practice. No microphone recording or automatic speech scoring is implied. */
import { ContentLoader } from './content-loader.js';
import { Progress, createAttemptId } from './progress.js';
import { Storage } from './storage.js';
import { Validator } from './validation.js';

let currentTypeId = 1, items = [], index = 0, timer = null, loadVersion = 0;
const escape = value => Validator.sanitizeHtml(String(value ?? ''));
const container = () => document.getElementById('speakingContent');
const getAttempt = item => Storage.get().activeAttempts[`speaking-${item.id}`];
const setAttempt = (item, attempt) => Storage.update(data => { data.activeAttempts[`speaking-${item.id}`] = attempt; });

export const SpeakingUI = {
  async init(typeId = 1) {
    const version = ++loadVersion;
    currentTypeId = Number(typeId) || 1; index = 0;
    if (timer) clearInterval(timer);
    if (!container()) return;
    container().innerHTML = '<p class="empty-state">Đang tải bài luyện nói…</p>';
    try {
      const data = await ContentLoader.getSpeakingData(currentTypeId);
      if (version !== loadVersion) return;
      items = data?.items || []; this.render();
    } catch (error) { container().innerHTML = `<p role="alert">${escape(error.message)}</p>`; }
  },
  render() {
    if (timer) clearInterval(timer);
    if (!container()) return;
    const item = items[index];
    if (!item) { container().innerHTML = '<div class="empty-state">Chưa có bài luyện nói đã duyệt.</div>'; return; }
    const attempt = getAttempt(item);
    container().innerHTML = `<div class="speaking-practice-box card"><div class="practice-header"><span class="badge badge-accent">Speaking · Phần ${currentTypeId}</span><span>Bài ${index + 1}/${items.length}</span></div>
      <div class="speaking-prompt-card"><p class="speaking-text-area">${escape(item.text || item.question || item.sample)}</p>
      ${item.tips ? `<p class="tips-box">${escape(item.tips)}</p>` : ''}
      <details><summary>Bản dịch tiếng Việt</summary><p>${escape(item.translation || 'Chưa có bản dịch.')}</p></details>
      ${item.sample && item.text ? `<details><summary>Bài nói mẫu</summary><p>${escape(item.sample)}</p></details>` : ''}</div>
      <p>Tự luyện nói và xác nhận khi hoàn thành. Ứng dụng đo thời gian; chưa ghi âm hoặc chấm phát âm.</p>
      <p id="timerStatus" role="status"></p><button class="btn btn-primary" id="btnRecordPractice">${attempt?.completed ? 'Luyện lại' : attempt?.startedAt ? 'Tôi đã hoàn thành bài nói' : 'Bắt đầu luyện nói'}</button>
      <div class="quiz-actions"><button class="btn btn-secondary" id="btnPrevSpeaking" ${index === 0 ? 'disabled' : ''}>← Bài trước</button><button class="btn btn-secondary" id="btnNextSpeaking" ${index === items.length - 1 ? 'disabled' : ''}>Bài tiếp →</button></div></div>`;
    const status = container().querySelector('#timerStatus');
    const tick = () => { status.textContent = attempt?.completed ? 'Đã ghi nhận bài luyện nói.' : attempt?.startedAt ? `Thời gian đã luyện: ${Math.max(0, Math.floor((Date.now() - attempt.startedAt) / 1000))} giây` : 'Sẵn sàng luyện nói.'; };
    tick(); if (attempt?.startedAt && !attempt.completed) timer = setInterval(tick, 1000);
    container().querySelector('#btnRecordPractice').onclick = () => {
      try {
        const active = getAttempt(item);
        if (!active?.startedAt || active.completed) setAttempt(item, { id: createAttemptId('speaking'), startedAt: Date.now(), completed: false });
        else {
          const durationSeconds = Math.floor((Date.now() - active.startedAt) / 1000);
          if (durationSeconds < 1) { status.textContent = 'Hãy luyện bài nói trước khi xác nhận hoàn thành.'; return; }
          Progress.completeLesson('speaking', { id: active.id, exerciseId: item.id, part: currentTypeId, topic: item.topic, durationSeconds });
          setAttempt(item, { ...active, completed: true });
        }
        this.render();
      } catch (error) { status.textContent = error.message; }
    };
    container().querySelector('#btnPrevSpeaking').onclick = () => { if (index > 0) { index--; this.render(); } };
    container().querySelector('#btnNextSpeaking').onclick = () => { if (index < items.length - 1) { index++; this.render(); } };
  }
};
