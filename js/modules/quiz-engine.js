/** Shared immutable scoring, persisted attempts and accessible practice rendering. */
import { Storage } from './storage.js';
import { Progress, createAttemptId } from './progress.js';

const clone = value => JSON.parse(JSON.stringify(value));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const metadataKeys = ['skill', 'part', 'topic', 'level', 'difficulty', 'questionType', 'grammarPoint',
  'vocabularyTopic', 'trapType', 'estimatedTime', 'source', 'tips'];

export function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\\]/.test(value)) return null;
  if (value.startsWith('//')) return null;
  try {
    const url = new URL(value, 'https://toeic.local/');
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch { return null; }
}

/** Illustrative display helper only; this is not ETS calibration or a proficiency assessment. */
export function estimateToeicScore(correctListening, totalListening, correctReading, totalReading) {
  const scale = (correct, total) => total > 0 ? Math.round((5 + 490 * Math.max(0, Math.min(1, correct / total))) / 5) * 5 : null;
  const listeningScore = scale(correctListening, totalListening);
  const readingScore = scale(correctReading, totalReading);
  return { listeningScore, readingScore,
    totalScore: listeningScore !== null && readingScore !== null ? listeningScore + readingScore : null,
    disclaimer: 'Quy đổi minh họa không chính thức, chưa được hiệu chuẩn với đề ETS và không xác định trình độ TOEIC.' };
}

export class QuizSession {
  constructor(items = [], options = {}) {
    this.rawItems = clone(Array.isArray(items) ? items : []);
    this.options = { ...options };
    this.id = options.id || createAttemptId('quiz');
    this.answers = new Map();
    this.assistedQuestionIds = new Set();
    this.submitted = false;
    this.startTime = Number.isFinite(options.startTime) ? options.startTime : Date.now();
    this.endTime = null;
    this.result = null;
    this.questions = this.flatten();
  }

  flatten() {
    const list = [];
    const ids = new Set();
    const visit = (item, index, parent = null, inherited = {}) => {
      const id = item.id || (parent ? `${parent.id}-q${index}` : `q-${index}`);
      const meta = { ...inherited };
      for (const key of metadataKeys) if (item[key] !== undefined) meta[key] = item[key];
      const context = {
        ...meta, passage: item.passage ?? parent?.passage ?? null,
        transcript: item.transcript || item.audio || parent?.transcript || null,
        audioUrl: safeMediaUrl(item.audioUrl || parent?.audioUrl),
        imageUrl: safeMediaUrl(item.imageUrl || parent?.imageUrl)
      };
      if (Array.isArray(item.questions)) {
        item.questions.forEach((sub, subIndex) => visit(sub, subIndex,
          { ...context, id, type: item.type || 'multi-question', size: item.questions.length }, meta));
        return;
      }
      if (!Array.isArray(item.options)) return;
      const correct = item.correct ?? item.correctAnswer;
      if (ids.has(id)) throw new Error(`ID câu hỏi bị trùng: ${id}`);
      if (!Number.isInteger(correct) || correct < 0 || correct >= item.options.length || item.options.length < 2) {
        throw new Error(`Đáp án của câu ${id} không hợp lệ.`);
      }
      ids.add(id);
      list.push({ ...context, id, parentId: parent?.id || null,
        parentType: parent?.type || 'single-choice', parentSkill: context.skill,
        subIndex: parent ? index : 0, totalSubInGroup: parent?.size || 1,
        q: item.q || item.question || (context.skill === 'listening' ? 'Nghe và chọn đáp án phù hợp.' : ''),
        options: [...item.options], correct, explanation: item.explanation || '',
        questionType: context.questionType || context.grammarPoint || 'general' });
    };
    this.rawItems.forEach((item, index) => visit(item, index));
    return list;
  }

  getFlattenedQuestions() { return clone(this.questions); }
  selectAnswer(questionId, optionIndex) {
    if (this.submitted) return false;
    const question = this.questions.find(q => q.id === questionId);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return false;
    this.answers.set(questionId, optionIndex);
    return true;
  }
  getAnswer(questionId) { return this.answers.get(questionId); }
  markAssisted(questionId) { if (!this.submitted) this.assistedQuestionIds.add(questionId); }

  evaluate() {
    if (this.result) return clone(this.result);
    if (!this.submitted) { this.submitted = true; this.endTime = Date.now(); }
    const breakdown = this.questions.map(q => {
      const selected = this.answers.get(q.id);
      const isAnswered = Number.isInteger(selected) && selected >= 0 && selected < q.options.length;
      return { ...q, selected: isAnswered ? selected : null, isAnswered,
        isCorrect: isAnswered && selected === q.correct,
        assisted: q.skill === 'listening' && (!q.audioUrl || this.assistedQuestionIds.has(q.id)) };
    });
    const total = breakdown.length;
    const correct = breakdown.filter(q => q.isCorrect).length;
    const answered = breakdown.filter(q => q.isAnswered).length;
    const skillResult = skill => {
      const rows = breakdown.filter(q => q.skill === skill);
      return { total: rows.length, correct: rows.filter(q => q.isCorrect).length,
        answered: rows.filter(q => q.isAnswered).length, assisted: rows.some(q => q.assisted) };
    };
    const listening = skillResult('listening'), reading = skillResult('reading');
    this.result = { id: this.id, attemptId: this.id, total, correct, answered, unanswered: total - answered,
      wrong: answered - correct, accuracy: total ? Math.round(correct / total * 100) : 0,
      listening, reading, assisted: breakdown.some(q => q.assisted),
      estimatedScore: estimateToeicScore(listening.correct, listening.total, reading.correct, reading.total),
      durationSeconds: Math.max(0, Math.round(((this.endTime || Date.now()) - this.startTime) / 1000)), breakdown };
    return clone(this.result);
  }

  serialize() {
    return { id: this.id, rawItems: clone(this.rawItems), options: { ...this.options },
      startTime: this.startTime, endTime: this.endTime, submitted: this.submitted,
      answers: [...this.answers], assistedQuestionIds: [...this.assistedQuestionIds] };
  }
  static restore(value) {
    if (!value || !Array.isArray(value.rawItems) || typeof value.id !== 'string') throw new Error('Phiên luyện tập không hợp lệ.');
    const session = new QuizSession(value.rawItems, { ...value.options, id: value.id, startTime: value.startTime });
    for (const [id, option] of Array.isArray(value.answers) ? value.answers : []) session.selectAnswer(id, option);
    session.assistedQuestionIds = new Set(Array.isArray(value.assistedQuestionIds) ? value.assistedQuestionIds : []);
    session.submitted = value.submitted === true;
    session.endTime = Number.isFinite(value.endTime) ? value.endTime : null;
    return session;
  }
}

export function renderQuestionContext(question, reveal = false) {
  let html = question.passage ? `<div class="passage-box"><div class="passage-text">${escape(question.passage)}</div></div>` : '';
  if (question.imageUrl) html += `<img class="question-image" src="${escape(question.imageUrl)}" alt="Hình minh họa bài tập" style="max-width:100%;max-height:300px;object-fit:contain">`;
  if (question.skill !== 'listening') return html;
  html += question.audioUrl
    ? `<audio controls preload="metadata" src="${escape(question.audioUrl)}" style="width:100%">Trình duyệt không hỗ trợ âm thanh.</audio>`
    : '<p class="no-audio-badge">Chưa có audio. Bạn có thể đọc transcript để luyện nội dung; kết quả này chưa đánh giá khả năng nghe.</p>';
  if (question.transcript) html += `<details class="transcript-section" data-transcript ${reveal ? 'open' : ''}><summary>Hiện / ẩn transcript</summary><p class="transcript-text">${escape(question.transcript)}</p></details>`;
  return html;
}

export function renderReview(result) {
  return `<section class="mock-review-card card"><h3>Đáp án và nội dung cần ôn</h3>
    <p>Đúng ${result.correct}/${result.total} · Sai ${result.wrong ?? result.answered - result.correct} · Chưa trả lời ${result.unanswered}</p>
    <div class="review-list">${result.breakdown.map((q, index) => `<article class="review-item ${q.isCorrect ? 'is-correct' : 'is-wrong'}">
      <p><strong>Câu ${index + 1} · ${q.isCorrect ? 'Đúng' : q.isAnswered ? 'Sai' : 'Chưa trả lời'}</strong> · Part ${escape(q.part || '—')}</p>
      ${renderQuestionContext(q, true)}<p>${escape(q.q)}</p>
      <p>Bạn chọn: ${q.isAnswered ? `${String.fromCharCode(65 + q.selected)}. ${escape(q.options[q.selected])}` : 'Chưa trả lời'}</p>
      <p><strong>Đáp án đúng: ${String.fromCharCode(65 + q.correct)}. ${escape(q.options[q.correct])}</strong></p>
      <div class="explanation-box visible">${escape(q.explanation || 'Bài này chưa có giải thích chi tiết.')}</div>
      <p>Dạng câu: ${escape(q.grammarPoint || q.questionType || 'Chưa phân loại')}${q.trapType ? ` · Bẫy: ${escape(q.trapType)}` : ''}</p>
      ${q.tips ? `<p>Mẹo ôn tập: ${escape(q.tips)}</p>` : '<p>Khi ôn lại, xác định bằng chứng trong đề và đối chiếu từng phương án với giải thích.</p>'}
      ${!q.isCorrect ? `<div class="quiz-actions"><button class="btn btn-secondary btn-sm" data-save-review="${index}">Lưu để ôn lại</button><button class="btn btn-primary btn-sm" data-practice-type="${index}">Luyện thêm dạng này</button></div>` : ''}
    </article>`).join('')}</div></section>`;
}

export function attachReviewEvents(container, result) {
  container.querySelectorAll('[data-save-review]').forEach(button => button.onclick = () => {
    const q = result.breakdown[Number(button.dataset.saveReview)];
    try {
      if (!Storage.get().reviewIds.includes(q.id)) {
        if (globalThis.window?.PersonalLearningUI?.saveReview) window.PersonalLearningUI.saveReview(q.id);
        else Storage.update(data => { data.reviewIds.push(q.id); });
      }
      button.textContent = 'Đã lưu'; button.disabled = true;
    } catch (error) { alert(error.message); }
  });
  container.querySelectorAll('[data-practice-type]').forEach(button => button.onclick = () => {
    const q = result.breakdown[Number(button.dataset.practiceType)];
    if (globalThis.window?.PersonalLearningUI?.startPractice) window.PersonalLearningUI.startPractice({
      skill: q.skill, part: q.part, questionType: q.questionType, grammarPoint: q.grammarPoint });
  });
}

/** Listening and Reading share one grouped-question runner, so navigation cannot reset a submission. */
export function createPracticeUI({ containerId, skill, defaultPart, loadData }) {
  let part = defaultPart, items = [], index = 0, attempts = new Map(), loadVersion = 0;
  const key = () => `practice-${skill}-${part}`;
  const persist = () => Storage.update(data => { data.activeAttempts[key()] = {
    index, sessions: [...attempts].map(([id, session]) => [id, session.serialize()]) }; });
  const getSession = () => {
    const item = items[index];
    if (!attempts.has(item.id)) attempts.set(item.id, new QuizSession([{ ...item, skill, part }]));
    return attempts.get(item.id);
  };
  return {
    async init(value = defaultPart) {
      const version = ++loadVersion;
      part = Number(value) || defaultPart;
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '<p class="empty-state">Đang tải bài tập…</p>';
      try {
        const data = await loadData(part);
        if (version !== loadVersion) return;
        items = data?.items || [];
        const saved = Storage.get().activeAttempts[key()];
        attempts = new Map(); index = Math.min(saved?.index || 0, Math.max(0, items.length - 1));
        for (const [id, snapshot] of saved?.sessions || []) {
          if (items.some(item => item.id === id)) {
            try { attempts.set(id, QuizSession.restore(snapshot)); } catch { /* A corrupt attempt does not hide the bank. */ }
          }
        }
        this.render();
      } catch (error) { container.innerHTML = `<p class="empty-state" role="alert">${escape(error.message)}</p>`; }
    },
    render() {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!items.length) { container.innerHTML = '<div class="empty-state"><h3>Chưa có bài tập đã duyệt</h3><p>Thêm bài từ Quản lý nội dung.</p></div>'; return; }
      const session = getSession();
      const questions = session.getFlattenedQuestions();
      const checked = session.submitted;
      const title = skill === 'listening' ? 'Listening' : 'Reading';
      container.innerHTML = `<div class="quiz-container card answer-sheet"><div class="quiz-header"><div><span class="badge badge-accent">${title} Part ${part}</span><h2>Phiếu trả lời</h2></div><span class="sheet-position">Mục ${index + 1} / ${items.length} · ${questions.length} câu</span></div>
        ${questions[0] ? renderQuestionContext(questions[0], checked) : ''}
        ${checked ? '<p class="sheet-hint">Đã nộp bài. Xem đáp án và giải thích bên dưới.</p>' : questions.map((q, qIndex) => `<section class="subquestion-card" aria-labelledby="sheet-question-${qIndex}"><span class="sheet-question-number">Câu ${String(qIndex + 1).padStart(2, '0')}</span><p class="question-text" id="sheet-question-${qIndex}">${escape(q.q)}</p><p class="sheet-hint">Chọn một đáp án phù hợp nhất.</p>
          <div class="options-grid" role="group" aria-labelledby="sheet-question-${qIndex}">${q.options.map((option, optionIndex) => `<button type="button" class="option-btn ${session.getAnswer(q.id) === optionIndex ? 'selected' : ''}" data-question="${qIndex}" data-option="${optionIndex}" aria-pressed="${session.getAnswer(q.id) === optionIndex}"><span class="option-label">${String.fromCharCode(65 + optionIndex)}</span><span class="option-text">${escape(option)}</span><span class="option-check" aria-hidden="true">✓</span></button>`).join('')}</div></section>`).join('')}
        <div class="quiz-actions"><button class="btn btn-secondary" data-prev ${index === 0 ? 'disabled' : ''}>← Mục trước</button>
          ${checked ? '<button class="btn btn-secondary" data-retry>Làm lại mục này</button>' : '<button class="btn btn-primary" data-check>Kiểm tra đáp án</button>'}
          <button class="btn btn-secondary" data-next ${index === items.length - 1 ? 'disabled' : ''}>Mục tiếp →</button></div><p data-practice-status role="status"></p></div>
        ${checked ? renderReview(session.evaluate()) : ''}`;
      container.querySelectorAll('[data-question]').forEach(button => button.onclick = () => {
        const questionIndex = Number(button.dataset.question);
        if (!session.selectAnswer(questions[questionIndex].id, Number(button.dataset.option))) return;
        container.querySelectorAll(`[data-question="${questionIndex}"]`).forEach(option => {
          const selected = option === button; option.classList.toggle('selected', selected); option.setAttribute('aria-pressed', String(selected));
        });
        try { persist(); } catch (error) { container.querySelector('[data-practice-status]').textContent = error.message; }
      });
      container.querySelectorAll('[data-transcript]').forEach(details => details.addEventListener('toggle', () => {
        if (details.open && !session.submitted) { questions.forEach(q => session.markAssisted(q.id)); persist(); }
      }));
      const checkButton = container.querySelector('[data-check]');
      if (checkButton) checkButton.onclick = () => {
        const answered = questions.filter(q => Number.isInteger(session.getAnswer(q.id))).length;
        if (answered < questions.length && !confirm(`Còn ${questions.length - answered} câu chưa trả lời. Xác nhận bỏ qua các câu này và nộp?`)) return;
        const result = session.evaluate();
        try {
          Progress.recordQuizResult({ ...result, skill, part, kind: 'practice' }); persist(); this.render();
        } catch (error) { container.querySelector('[data-practice-status]').textContent = error.message; }
      };
      container.querySelector('[data-prev]').onclick = () => { if (index > 0) { index--; this.render(); persist(); } };
      container.querySelector('[data-next]').onclick = () => { if (index < items.length - 1) { index++; this.render(); persist(); } };
      const retry = container.querySelector('[data-retry]');
      if (retry) retry.onclick = () => { attempts.delete(items[index].id); this.render(); persist(); };
      if (checked) attachReviewEvents(container, session.evaluate());
    }
  };
}
