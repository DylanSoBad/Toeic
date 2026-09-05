/** Timed mock test. The deadline survives navigation, reload and background-tab throttling. */
import { ContentLoader } from './content-loader.js';
import { QuizSession, renderQuestionContext, renderReview, attachReviewEvents } from './quiz-engine.js';
import { Progress } from './progress.js';
import { Storage } from './storage.js';
import { Validator } from './validation.js';

let session = null, currentIndex = 0, deadline = null, timerInterval = null, testData = null;
let loadingVersion = 0;
const escape = value => Validator.sanitizeHtml(String(value ?? ''));
const container = () => document.getElementById('mockTestContent');
const remaining = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
const persist = () => Storage.update(data => { data.activeAttempts.mock = {
  session: session.serialize(), currentIndex, deadline, title: testData?.title, durationMinutes: testData?.durationMinutes }; });

export const MockTestUI = {
  async init() {
    const version = ++loadingVersion;
    this.stopTimer();
    if (!container()) return;
    container().innerHTML = '<p class="empty-state">Đang chuẩn bị bài thi thử…</p>';
    try {
      const saved = Storage.get().activeAttempts.mock;
      if (saved?.session) {
        session = QuizSession.restore(saved.session);
        deadline = Number.isFinite(saved.deadline) ? saved.deadline : null;
        currentIndex = Math.min(Math.max(0, saved.currentIndex || 0), Math.max(0, session.questions.length - 1));
        testData = { title: saved.title, durationMinutes: saved.durationMinutes || 25 };
        if (session.submitted) { this.renderResultView(session.evaluate()); return; }
        if (deadline) {
          if (!remaining()) { this.submitExam(true); return; }
          this.renderQuestionView(); this.startTimer(); return;
        }
      }
      testData = await ContentLoader.getMockTestData();
      if (version !== loadingVersion) return;
      session = new QuizSession(testData?.items || []);
      deadline = null; currentIndex = 0;
      this.renderIntro(testData);
    } catch (error) { container().innerHTML = `<p class="empty-state" role="alert">${escape(error.message)}</p>`; }
  },

  renderIntro(data = {}) {
    const questions = session.getFlattenedQuestions();
    if (!questions.length) { container().innerHTML = '<div class="empty-state">Chưa có đề thi đã duyệt. Hãy thêm bài tập trong Quản lý nội dung.</div>'; return; }
    const lTotal = questions.filter(q => q.skill === 'listening').length;
    const missingAudio = questions.some(q => q.skill === 'listening' && !q.audioUrl);
    container().innerHTML = `<div class="mock-intro-card card"><h2>${escape(data?.title || 'Bài thi thử rút gọn')}</h2>
      <p>${questions.length} câu · ${lTotal} Listening, ${questions.length - lTotal} Reading · ${Number(data?.durationMinutes) || 25} phút</p>
      <p>Đồng hồ bắt đầu khi bạn bấm bắt đầu. Câu trả lời và thời hạn được lưu để tiếp tục khi quay lại; đồng hồ vẫn chạy khi rời trang.</p>
      <p>Kết quả là độ chính xác bài luyện tập, chưa được hiệu chuẩn thành điểm TOEIC.</p>
      ${missingAudio ? '<p class="no-audio-badge">Đề này còn thiếu audio. Có thể mở transcript để luyện nội dung; phần đó chưa đánh giá khả năng nghe.</p>' : ''}
      <button class="btn btn-primary btn-lg" id="btnStartMock">Bắt đầu làm bài</button><p role="status" id="mockStatus"></p></div>`;
    container().querySelector('#btnStartMock').onclick = () => {
      session.startTime = Date.now();
      deadline = session.startTime + (Number(data?.durationMinutes) || 25) * 60000;
      try { persist(); this.renderQuestionView(); this.startTimer(); }
      catch (error) { container().querySelector('#mockStatus').textContent = error.message; }
    };
  },

  startTimer() {
    this.stopTimer();
    timerInterval = setInterval(() => {
      this.updateTimerDisplay();
      if (session && !session.submitted && remaining() <= 0) this.submitExam(true);
    }, 1000);
  },
  stopTimer() { if (timerInterval) clearInterval(timerInterval); timerInterval = null; },
  updateTimerDisplay() {
    const timer = container()?.querySelector('#mockTimer');
    const seconds = remaining();
    if (timer) { timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; timer.classList.toggle('timer-warning', seconds < 300); }
  },

  renderQuestionView() {
    if (!container() || !session) return;
    const questions = session.getFlattenedQuestions(), q = questions[currentIndex];
    if (!q) return;
    const answered = questions.filter(item => session.getAnswer(item.id) !== undefined).length;
    container().innerHTML = `<div class="mock-exam-layout"><div class="mock-top-bar card"><span>Câu ${currentIndex + 1}/${questions.length} · Đã trả lời ${answered}</span>
      <strong class="mock-timer" id="mockTimer"></strong><button class="btn btn-primary" id="btnSubmitMockEarly">Nộp bài thi</button></div>
      <div class="mock-question-card card"><p class="badge badge-accent">${escape(q.skill)}${q.part ? ` · Part ${escape(q.part)}` : ''}</p>
        ${renderQuestionContext(q)}<h3>${escape(q.q)}</h3><div class="options-grid">
        ${q.options.map((option, i) => `<button class="option-btn ${session.getAnswer(q.id) === i ? 'selected' : ''}" data-opt-idx="${i}" aria-pressed="${session.getAnswer(q.id) === i}"><span class="option-label">${String.fromCharCode(65 + i)}</span><span>${escape(option)}</span></button>`).join('')}</div></div>
      <div class="mock-nav-palette card"><p>Chuyển nhanh đến câu hỏi</p><div class="palette-grid">${questions.map((question, i) => `<button class="palette-btn ${i === currentIndex ? 'active' : ''} ${session.getAnswer(question.id) !== undefined ? 'answered' : ''}" data-goto-idx="${i}" aria-label="Câu ${i + 1}${session.getAnswer(question.id) !== undefined ? ', đã trả lời' : ', chưa trả lời'}">${i + 1}</button>`).join('')}</div></div>
      <div class="quiz-actions"><button class="btn btn-secondary" id="btnMockPrev" ${currentIndex === 0 ? 'disabled' : ''}>← Câu trước</button><button class="btn btn-secondary" id="btnMockNext" ${currentIndex === questions.length - 1 ? 'disabled' : ''}>Câu tiếp →</button></div>
      <p id="mockStatus" role="status"></p></div>`;
    this.updateTimerDisplay();
    const save = () => { try { persist(); } catch (error) { container().querySelector('#mockStatus').textContent = error.message; } };
    container().querySelectorAll('[data-opt-idx]').forEach(button => button.onclick = () => {
      if (remaining() <= 0) { this.submitExam(true); return; }
      session.selectAnswer(q.id, Number(button.dataset.optIdx));
      save();
      container().querySelectorAll('[data-opt-idx]').forEach(option => {
        option.classList.toggle('selected', option === button); option.setAttribute('aria-pressed', String(option === button));
      });
      container().querySelector(`[data-goto-idx="${currentIndex}"]`)?.classList.add('answered');
    });
    container().querySelectorAll('[data-transcript]').forEach(details => details.addEventListener('toggle', () => {
      if (details.open) {
        questions.filter(question => question.id === q.id || (q.parentId && question.parentId === q.parentId)).forEach(question => session.markAssisted(question.id)); save();
      }
    }));
    const navigate = index => { currentIndex = index; save(); this.renderQuestionView(); };
    container().querySelectorAll('[data-goto-idx]').forEach(button => button.onclick = () => navigate(Number(button.dataset.gotoIdx)));
    container().querySelector('#btnMockPrev').onclick = () => { if (currentIndex > 0) navigate(currentIndex - 1); };
    container().querySelector('#btnMockNext').onclick = () => { if (currentIndex < questions.length - 1) navigate(currentIndex + 1); };
    container().querySelector('#btnSubmitMockEarly').onclick = () => {
      const unanswered = questions.filter(question => session.getAnswer(question.id) === undefined).length;
      if (confirm(unanswered ? `Còn ${unanswered} câu chưa trả lời. Bỏ qua và nộp bài?` : 'Nộp bài và xem kết quả?')) this.submitExam();
    };
  },

  submitExam(timedOut = false) {
    if (!session) return;
    this.stopTimer();
    if (timedOut && !session.submitted) { session.submitted = true; session.endTime = deadline; }
    const result = session.evaluate();
    try {
      Progress.recordMockTest({ ...result, kind: 'mock', timedOut }); persist(); this.renderResultView(result);
    } catch (error) {
      if (container()) {
        container().innerHTML = `<div class="card"><p role="alert">${escape(error.message)}</p><button class="btn btn-primary" id="btnRetryMockSave">Thử lưu kết quả lại</button></div>`;
        container().querySelector('#btnRetryMockSave').onclick = () => this.submitExam(timedOut);
      }
    }
  },

  renderResultView(result) {
    if (!container()) return;
    container().innerHTML = `<div class="mock-result-container"><div class="mock-score-card card"><h2>Kết quả bài thi thử</h2>
      <div class="total-score-display"><span class="score-num">${result.accuracy}%</span></div><p>Đúng ${result.correct}/${result.total} · Chưa trả lời ${result.unanswered}</p>
      <p>Listening ${result.listening.correct}/${result.listening.total} · Reading ${result.reading.correct}/${result.reading.total}</p>
      <p>Thời gian: ${Math.floor(result.durationSeconds / 60)} phút ${result.durationSeconds % 60} giây</p>
      <p>${result.assisted ? 'Có câu Listening thiếu audio hoặc đã xem transcript; kết quả chưa phản ánh đầy đủ khả năng nghe.' : 'Kết quả trên đề rút gọn, chưa được hiệu chuẩn thành điểm TOEIC.'}</p>
      <button class="btn btn-primary" id="btnRetakeMock">Làm lại đề này</button></div>${renderReview(result)}</div>`;
    attachReviewEvents(container(), result);
    container().querySelector('#btnRetakeMock').onclick = () => {
      Storage.update(data => { delete data.activeAttempts.mock; }); session = null; deadline = null; this.init();
    };
  }
};
