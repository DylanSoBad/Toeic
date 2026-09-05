/** Writing drafts persist across navigation. Completion records self-practice, not an AI grade. */
import { ContentLoader } from './content-loader.js';
import { Progress, createAttemptId } from './progress.js';
import { Storage } from './storage.js';
import { Validator } from './validation.js';

let currentTypeId = 1, items = [], index = 0, loadVersion = 0;
const escape = value => Validator.sanitizeHtml(String(value ?? ''));
const container = () => document.getElementById('writingContent');
const getAttempt = item => Storage.get().activeAttempts[`writing-${item.id}`];
const setAttempt = (item, attempt) => Storage.update(data => { data.activeAttempts[`writing-${item.id}`] = attempt; });

export const WritingUI = {
  async init(typeId = 1) {
    const version = ++loadVersion;
    currentTypeId = Number(typeId) || 1; index = 0;
    if (!container()) return;
    container().innerHTML = '<p class="empty-state">Đang tải bài luyện viết…</p>';
    try {
      const data = await ContentLoader.getWritingData(currentTypeId);
      if (version !== loadVersion) return;
      items = data?.items || []; this.render();
    } catch (error) { container().innerHTML = `<p role="alert">${escape(error.message)}</p>`; }
  },
  render() {
    if (!container()) return;
    const item = items[index];
    if (!item) { container().innerHTML = '<div class="empty-state">Chưa có bài luyện viết đã duyệt.</div>'; return; }
    let attempt = getAttempt(item) || { id: createAttemptId('writing'), startedAt: Date.now(), text: '', completed: false };
    container().innerHTML = `<div class="writing-practice-box card"><div class="practice-header"><span class="badge badge-accent">Writing · Phần ${currentTypeId}</span><span>Bài ${index + 1}/${items.length}</span></div>
      <div class="writing-prompt-card">${item.hint ? `<p>Gợi ý: ${escape(item.hint)}</p>` : ''}${item.email ? `<pre class="email-pre">${escape(item.email)}</pre>` : ''}<p>${escape(item.topicText || item.question)}</p>${item.tips ? `<p class="tips-box">${escape(item.tips)}</p>` : ''}</div>
      <label for="writingInput">Bài viết của bạn</label><textarea class="writing-textarea" id="writingInput" maxlength="30000" ${attempt.completed ? 'readonly' : ''} placeholder="Nhập bài viết bằng tiếng Anh…">${escape(attempt.text)}</textarea>
      <p id="wordCountLabel"></p><p>Hoàn thành sẽ lưu bài viết và thời gian tự luyện. Bài này chưa được chấm điểm tự động.</p>
      <button class="btn btn-primary" id="btnSubmitWriting">${attempt.completed ? 'Viết lại bài này' : 'Hoàn thành và lưu bài'}</button><p id="writingStatus" role="status">${attempt.completed ? 'Đã lưu bài viết.' : ''}</p>
      <details ${attempt.completed ? 'open' : ''}><summary>Xem bài mẫu</summary><p>${escape(item.sample || 'Chưa có bài mẫu.')}</p>${item.translation ? `<p>${escape(item.translation)}</p>` : ''}</details>
      <div class="quiz-actions"><button class="btn btn-secondary" id="btnPrevWriting" ${index === 0 ? 'disabled' : ''}>← Bài trước</button><button class="btn btn-secondary" id="btnNextWriting" ${index === items.length - 1 ? 'disabled' : ''}>Bài tiếp →</button></div></div>`;
    const input = container().querySelector('#writingInput'), status = container().querySelector('#writingStatus');
    const updateCount = () => { container().querySelector('#wordCountLabel').textContent = `Số từ: ${input.value.trim() ? input.value.trim().split(/\s+/).length : 0}`; };
    updateCount();
    input.oninput = () => {
      updateCount(); attempt = { ...attempt, text: input.value };
      try { setAttempt(item, attempt); status.textContent = 'Đã lưu bản nháp trên trình duyệt.'; } catch (error) { status.textContent = error.message; }
    };
    container().querySelector('#btnSubmitWriting').onclick = () => {
      try {
        if (attempt.completed) { setAttempt(item, { id: createAttemptId('writing'), startedAt: Date.now(), text: '', completed: false }); this.render(); return; }
        const text = input.value.trim();
        if (text.length < 5) { status.textContent = 'Hãy viết câu trả lời trước khi hoàn thành.'; input.focus(); return; }
        Progress.completeLesson('writing', { id: attempt.id, exerciseId: item.id, part: currentTypeId, topic: item.topic,
          response: text, durationSeconds: Math.max(0, Math.round((Date.now() - attempt.startedAt) / 1000)) });
        setAttempt(item, { ...attempt, text, completed: true }); this.render();
      } catch (error) { status.textContent = error.message; }
    };
    container().querySelector('#btnPrevWriting').onclick = () => { if (index > 0) { index--; this.render(); } };
    container().querySelector('#btnNextWriting').onclick = () => { if (index < items.length - 1) { index++; this.render(); } };
  }
};
