import { Storage } from './storage.js';
import { ContentLoader } from './content-loader.js';
import { Progress } from './progress.js';
import { QuizSession } from './quiz-engine.js';
import { Validator } from './validation.js';
import { AdminUI } from './admin.js';
import { analyze, getProfile, saveProfile, localDay, offsetDay, ensurePlan, updateTask, recommendations, selectPractice, diagnosticItems, countQuestions, reviewQuestions, generationContext, typeLabel, questionType, newId } from './learning.js';

const e = value => Validator.sanitizeHtml(String(value ?? ''));
const $ = id => document.getElementById(id);
const button = (label, action, attrs = '', cls = 'btn btn-secondary') => `<button type="button" class="${cls}" data-learn="${action}" ${attrs}>${label}</button>`;
const empty = (text, action = '') => `<div class="learn-empty"><span class="eyebrow">BẮT ĐẦU TỪ ĐÂY</span><p>${text}</p>${action}</div>`;
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
const formatSeconds = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.max(0, seconds % 60).toString().padStart(2, '0')}`;
let bank = []; let loaded = false; let run = null; let timer = null; let busy = false; let selectedPlanDate = localDay(); let lastRecordedId = null;

function status(text, isError = false) {
  const box = $('learningToast'); if (!box) return;
  box.textContent = text; box.className = `learning-toast visible ${isError ? 'error' : ''}`;
  clearTimeout(status.timeout); status.timeout = setTimeout(() => box.classList.remove('visible'), 6500);
}
function safeAudio(url) { return typeof url === 'string' && (/^https?:\/\//i.test(url) || /^(?:\.?\.?\/)?(?:audio|media|assets)\//.test(url)); }
function setPage(page) { window.navigateTo(page); }
function persistRun() {
  const state = Storage.get();
  state.learningAttempt = run && !run.result ? { id: run.id, items: run.items, answers: [...run.session.answers], current: run.current, startTime: run.session.startTime, deadline: run.deadline, title: run.title, kind: run.kind, task: run.task, assisted: run.assisted } : null;
  Storage.save(state);
}
function stat(label, value, note = '') { return `<div class="learn-stat"><span>${label}</span><strong>${e(value)}</strong>${note ? `<small>${e(note)}</small>` : ''}</div>`; }
function taskHtml(task, date, compact = false) {
  const finished = task.status !== 'pending';
  const statuses = { completed: 'Đã hoàn thành', skipped: 'Đã bỏ qua', postponed: 'Đã dời lịch' };
  return `<article class="learn-task ${finished ? 'task-done' : ''}"><div class="task-index">${finished ? '✓' : task.kind === 'review' ? '↺' : task.kind === 'vocabulary' ? 'Aa' : String(task.part).padStart(2, '0')}</div><div class="task-copy"><strong>${e(task.title)}</strong><p>${e(task.reason)}</p><span class="learn-meta">${finished ? statuses[task.status] : `${task.minutes} phút dự kiến · ${task.level ? e(task.level) : 'Ôn tập'}`}</span></div><div class="task-actions">${!finished ? button('Luyện ngay →', 'task-start', `data-id="${e(task.id)}" data-date="${date}"`, 'btn btn-primary btn-sm') : ''}${!compact ? `<details class="task-menu"><summary>Tùy chọn</summary>${button('Đánh dấu hoàn thành', 'task-state', `data-id="${e(task.id)}" data-date="${date}" data-state="completed"`)}${button('Bỏ qua', 'task-state', `data-id="${e(task.id)}" data-date="${date}" data-state="skipped"`)}${button('Dời sang ngày kế', 'task-state', `data-id="${e(task.id)}" data-date="${date}" data-state="postpone"`)}${finished ? button('Mở lại', 'task-state', `data-id="${e(task.id)}" data-date="${date}" data-state="pending"`) : ''}</details>` : ''}</div></article>`;
}
function partBars(rows) {
  return rows.length ? rows.map(row => `<div class="part-row"><div><strong>Part ${e(row.key)}</strong><span>${row.correct}/${row.total} câu${row.assisted ? ' · có transcript' : ''}</span></div><div class="part-track"><div style="width:${row.accuracy}%"></div></div><strong>${row.accuracy}%</strong></div>`).join('') : empty('Làm một bài ngắn để biết Part nào cần tập trung.');
}

export const PersonalLearningUI = {
  async init() {
    document.addEventListener('click', async event => {
      const target = event.target.closest('[data-learn]'); if (!target) return;
      try { await this.action(target.dataset.learn, target.dataset); } catch (err) { status(err.message || 'Không thể thực hiện. Vui lòng thử lại.', true); }
    });
    document.addEventListener('submit', event => { if (event.target.id === 'learningProfileForm') { event.preventDefault(); this.submitProfile(event.target); } });
    document.addEventListener('change', event => { if (event.target.id === 'learningPlanDate') { selectedPlanDate = event.target.value || localDay(); this.renderPlan(); } });
    const saved = Storage.get().learningAttempt;
    if (saved?.items?.length && Array.isArray(saved.answers)) {
      try {
        const session = new QuizSession(saved.items); session.answers = new Map(saved.answers); session.startTime = saved.startTime; session.id = saved.id;
        run = { ...saved, session, questions: session.getFlattenedQuestions(), result: null };
        this.startClock();
      } catch { status('Không thể khôi phục lượt làm dở. Lịch sử đã nộp vẫn được giữ.', true); }
    }
    await this.loadBank();
    if (!Storage.get().dailyPlans?.[localDay()]) ensurePlan(bank);
    this.renderHome();
    lastRecordedId = Storage.get().history?.[0]?.id;
    Storage.subscribe(() => {
      const latestId = Storage.get().history?.[0]?.id;
      if (loaded && latestId && latestId !== lastRecordedId && !busy) {
        lastRecordedId = latestId; ensurePlan(bank, localDay(), true);
      }
      const active = document.querySelector('.page.active')?.id;
      if (active === 'page-home') this.renderHome();
      if (active === 'page-roadmap') this.renderPlan();
      if (active === 'page-progress') this.renderAnalysis();
      if (active === 'page-review') this.renderReview();
      if (active === 'page-journal') this.renderJournal();
    });
  },
  async loadBank() { bank = await ContentLoader.getAllQuestionBank(); loaded = true; return bank; },
  renderHome() {
    const container = $('learningHome'); if (!container) return;
    const state = Storage.get(), profile = getProfile(state), a = analyze(state), stats = Progress.getStats();
    const tasks = state.dailyPlans?.[localDay()] || [];
    const done = tasks.filter(t => t.status === 'completed').length;
    const score = profile.currentScore; const gap = score === null ? null : Math.max(0, profile.targetScore - score);
    const weakest = a.parts[0]; const latest = state.history?.[0];
    container.innerHTML = `
      <div class="learn-page-top"><span class="eyebrow">GÓC HỌC CỦA BẠN</span><span class="learn-meta">${e(dateLabel(localDay()))}</span></div>
      <div class="learn-heading"><div><h1>Mỗi ngày, vững thêm<br><em>một chút tiếng Anh.</em></h1><p>Làm bài, hiểu câu sai, rồi luyện đúng phần cần cải thiện.</p></div>${button('Mục tiêu của tôi ↗', 'profile', '', 'btn btn-outline')}</div>
      ${!profile.onboarded ? `<div class="onboarding-banner"><div><strong>Bắt đầu với một mục tiêu vừa sức.</strong><p>Chọn điểm mong muốn và thời gian học. Bạn có thể làm bài khảo sát ngay hoặc học trước.</p></div>${button('Thiết lập mục tiêu', 'profile', '', 'btn btn-primary')}</div>` : ''}
      <div class="learning-stats">${stat('Mục tiêu TOEIC', profile.targetScore, score !== null ? `Điểm bạn nhập: ${score} · còn ${gap} điểm` : 'Chưa có điểm đầu vào được xác nhận')}${stat('Độ chính xác', stats.totalAnswered ? `${stats.accuracy}%` : '—', `${stats.totalAnswered || 0} câu đã trả lời`)}${stat('Học tuần này', `${a.weekMinutes} phút`, 'Từ thời gian làm bài đã lưu')}${stat('Ngày liên tiếp', stats.streak || 0, `${stats.vocabCount || 0} từ đã thuộc`)}</div>
      <div class="learning-columns"><section class="card today-card"><div class="section-heading"><div><span class="eyebrow">KẾ HOẠCH NHỎ, ĐỀU ĐẶN</span><h2>Hôm nay học gì?</h2></div><span class="pill">${done}/${tasks.length} xong</span></div><div class="plan-progress"><span style="width:${tasks.length ? done / tasks.length * 100 : 0}%"></span></div>${tasks.length ? tasks.slice(0, 3).map(t => taskHtml(t, localDay(), true)).join('') : empty('Ngân hàng hiện chưa có bài phù hợp. Thêm nội dung để tạo kế hoạch.', button('Quản lý nội dung', 'admin'))}<div class="card-footer">${button('Xem kế hoạch 7 ngày →', 'plan', '', 'text-button')}<span>${profile.dailyMinutes} phút / ngày</span></div></section>
      <aside class="card focus-card"><span class="eyebrow">ĐIỂM XUẤT PHÁT</span><h2>${run && !run.result ? 'Bài đang chờ bạn' : weakest ? `Tập trung Part ${e(weakest.key)}` : 'Hiểu mình trước khi học'}</h2><p>${run && !run.result ? `${e(run.title)} · Đã chọn ${run.session.answers.size}/${run.questions.length} câu.` : weakest ? `Bạn đúng ${weakest.correct}/${weakest.total} câu ở Part này. Luyện thêm một nhóm ngắn để tìm ra phần cần ôn.` : 'Một bài khảo sát ngắn giúp bạn chọn nội dung nên luyện trước.'}</p>${run && !run.result ? button('Tiếp tục bài đang làm →', 'resume', '', 'btn btn-primary') : button('Kiểm tra đầu vào →', 'diagnostic', '', 'btn btn-primary')}${weakest ? button('Luyện Part này', 'practice', `data-part="${e(weakest.key)}"`, 'btn btn-outline') : ''}<div class="focus-note">Bài nghe thiếu audio sẽ được ghi là luyện với transcript. Kết quả này không phải điểm TOEIC chính thức.</div></aside></div>
      <div class="learning-columns secondary"><section class="card"><div class="section-heading"><h2>Nhịp học trong tuần</h2><span class="learn-meta">7 ngày gần nhất</span></div><div class="week-strip">${a.week.map(d => `<div class="week-day ${d.lessons ? 'has-activity' : ''} ${d.date === localDay() ? 'today' : ''}"><span>${e(new Date(`${d.date}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' }))}</span><div>${d.lessons ? d.lessons : '·'}</div><small>${Math.round(d.seconds / 60)} phút</small></div>`).join('')}</div>${button('Mở nhật ký học →', 'journal', '', 'text-button')}</section><section class="card"><div class="section-heading"><h2>Lần luyện gần nhất</h2></div>${latest ? `<p class="recent-title">${e(latest.title || latest.skill)} ${latest.part ? `· Part ${e(latest.part)}` : ''}</p><div class="recent-score">${latest.correct ?? 0}<span> / ${latest.total ?? 0} câu đúng</span></div><p class="learn-meta">${e(new Date(latest.timestamp).toLocaleString('vi-VN'))}</p>${button('Xem phân tích & câu cần ôn →', 'analysis', '', 'text-button')}` : empty('Lịch sử sẽ xuất hiện sau bài làm đầu tiên.')}</section></div>
      <div class="learn-shortcuts">${button('Listening · Part 1–4 ↗', 'navigate', 'data-page="listening"')}${button('Reading · Part 5–7 ↗', 'navigate', 'data-page="reading"')}${button('Từ vựng ↗', 'navigate', 'data-page="vocabulary"')}${button('Thi thử ↗', 'navigate', 'data-page="mocktest"')}${button('Tạo bài mới với AI ↗', 'ai')}</div>`;
  },
  renderProfile() {
    const p = getProfile(); const box = $('learningProfile'); if (!box) return;
    box.innerHTML = `<div class="learn-form-wrap card"><span class="eyebrow">THIẾT LẬP CỦA BẠN</span><h1 class="page-title">Học để tới mục tiêu nào?</h1><p class="page-desc">Kế hoạch được gợi ý theo thời gian bạn có và kết quả làm bài.</p><form id="learningProfileForm"><div class="learn-form-grid"><label>Điểm TOEIC hiện tại (nếu biết)<input name="currentScore" type="number" min="10" max="990" value="${e(p.currentScore)}" placeholder="Để trống nếu chưa thi"></label><label>Điểm mục tiêu<input name="targetScore" type="number" min="10" max="990" required value="${p.targetScore}"></label><label>Ngày dự kiến thi<input name="examDate" type="date" min="${localDay()}" value="${e(p.examDate)}"></label><label>Thời gian học mỗi ngày (phút)<input name="dailyMinutes" type="number" min="10" max="180" required value="${p.dailyMinutes}"></label></div><fieldset class="learn-fieldset"><legend>Part bạn muốn cải thiện (tùy chọn)</legend><div class="part-checks">${Array.from({ length: 7 }, (_, i) => `<label><input type="checkbox" name="weakParts" value="${i + 1}" ${p.weakParts.includes(i + 1) ? 'checked' : ''}>Part ${i + 1}</label>`).join('')}</div></fieldset><label class="learn-check"><input type="checkbox" name="startDiagnostic"> Làm bài kiểm tra đầu vào sau khi lưu</label><div id="profileErrors" role="alert" class="learn-error"></div><div class="learn-actions"><button class="btn btn-primary" type="submit">Lưu mục tiêu & bắt đầu →</button>${button('Quay về', 'home')}</div></form><p class="learn-meta">Mục tiêu và tiến độ được lưu trong trình duyệt này. Chưa có đồng bộ giữa các thiết bị.</p></div>`;
  },
  submitProfile(form) {
    try {
      const values = new FormData(form);
      const result = saveProfile({ currentScore: values.get('currentScore') === '' ? null : Number(values.get('currentScore')), targetScore: Number(values.get('targetScore')), examDate: values.get('examDate'), dailyMinutes: Number(values.get('dailyMinutes')), weakParts: values.getAll('weakParts').map(Number) });
      if (!result.success) { $('profileErrors').textContent = result.errors.join(' '); return; }
      ensurePlan(bank, localDay(), true); status('Đã lưu mục tiêu và cập nhật kế hoạch.');
      if (values.has('startDiagnostic')) this.showDiagnostic(); else setPage('home');
    } catch (err) { $('profileErrors').textContent = err.message; }
  },
  renderPlan() {
    const container = $('learningPlan'); if (!container) return;
    const state = Storage.get(); const tasks = state.dailyPlans?.[selectedPlanDate] || [];
    container.innerHTML = `<div class="section-heading"><div><span class="eyebrow">LỘ TRÌNH CỦA BẠN</span><h1 class="page-title">Một việc nhỏ, mỗi ngày.</h1></div>${button('Chỉnh mục tiêu', 'profile', '', 'btn btn-outline')}</div><p class="page-desc">Gợi ý bằng quy tắc từ kết quả thật. Bạn luôn có thể đổi lịch và chọn bài khác.</p><div class="plan-date-strip">${Array.from({ length: 7 }, (_, i) => { const d = offsetDay(localDay(), i); const list = state.dailyPlans?.[d] || []; return button(`<span>${e(new Date(`${d}T12:00:00`).toLocaleDateString('vi-VN', { weekday: 'short' }))}</span><strong>${d.slice(8)}</strong><small>${list.filter(t => t.status === 'completed').length}/${list.length}</small>`, 'plan-date', `data-date="${d}"`, `plan-day ${d === selectedPlanDate ? 'selected' : ''}`); }).join('')}</div><div class="card"><div class="section-heading"><h2>${e(dateLabel(selectedPlanDate))}</h2>${button(tasks.length ? 'Cập nhật gợi ý' : 'Tạo kế hoạch ngày này', 'regenerate', `data-date="${selectedPlanDate}"`, 'btn btn-outline btn-sm')}</div>${tasks.length ? tasks.map(t => taskHtml(t, selectedPlanDate)).join('') : empty('Chưa lên lịch ngày này. Tạo gợi ý để phân bổ thời gian học.')}<p class="learn-meta">Đánh dấu nhiệm vụ chỉ cập nhật kế hoạch. Điểm và độ chính xác chỉ tính từ bài làm đã nộp.</p></div>`;
  },
  renderAnalysis() {
    const container = $('learningAnalysis'); if (!container) return;
    const a = analyze(); const p = getProfile();
    container.innerHTML = `<div class="section-heading"><div><span class="eyebrow">TỪ BÀI LÀM THẬT</span><h2>Bạn đang tiến bộ ở đâu?</h2></div>${button('Ôn lại câu sai →', 'review', '', 'btn btn-primary')}</div><div class="learning-stats">${stat('Mục tiêu', p.targetScore, p.currentScore !== null ? `Bạn tự nhập điểm hiện tại: ${p.currentScore}` : 'Chưa có điểm TOEIC được xác nhận')}${stat('Độ chính xác tuần này', a.weekAccuracy === null ? '—' : `${a.weekAccuracy}%`, a.previousAccuracy === null ? 'Chưa có số liệu tuần trước' : `Tuần trước: ${a.previousAccuracy}%`)}${stat('Câu cần luyện lại', a.mistakes.length, 'Lấy lần làm gần nhất của từng câu')}${stat('Thời gian tuần này', `${a.weekMinutes} phút`)}</div><div class="learning-columns"><section class="card"><h2>Độ chính xác theo Part</h2>${partBars(a.parts)}<p class="learn-meta">Các bài có xem transcript được ghi chú riêng. Ngân hàng nhỏ chưa đủ để quy đổi thành điểm TOEIC.</p></section><section class="card"><h2>Dạng câu cần chú ý</h2>${a.types.length ? a.types.map(t => `<div class="error-type-row"><div><strong>${e(typeLabel(t.key))}</strong><span>${t.total - t.correct}/${t.total} câu sai hoặc bỏ trống</span></div>${t.key !== 'unanswered' ? button('Luyện', 'practice', `data-type="${e(t.key)}"`, 'btn btn-outline btn-sm') : button('Ôn lại', 'review', '', 'btn btn-outline btn-sm')}</div>`).join('') : empty('Sau khi nộp bài, hệ thống nhóm câu sai theo kiến thức được gắn trong bài.')}<p class="learn-meta">Đây là nhóm nội dung của câu hỏi, chưa phải kết luận về nguyên nhân bạn trả lời sai.</p></section></div><div class="learn-actions">${button('Tạo bài AI theo điểm yếu', 'ai', '', 'btn btn-primary')}${button('Nhật ký chi tiết', 'journal')}${button('Cập nhật kế hoạch hôm nay', 'regenerate', `data-date="${localDay()}"`)}</div>`;
  },
  renderReview() {
    const box = $('learningReview'); if (!box) return;
    const questions = reviewQuestions();
    box.innerHTML = `<div class="section-heading"><div><span class="eyebrow">HIỂU LỖI, NHỚ LÂU</span><h1 class="page-title">Sổ câu cần ôn</h1></div>${button('Làm lại tối đa 5 câu →', 'review-start', '', 'btn btn-primary')}</div><p class="page-desc">Câu sai hoặc bỏ trống sẽ ở đây đến khi bạn làm đúng. Câu lưu thủ công được giữ cho đến khi bỏ lưu.</p>${questions.length ? questions.slice(0, 60).map(q => this.reviewCard(q)).join('') : empty('Chưa có câu cần ôn. Bắt đầu làm bài hoặc lưu một câu trong phần kết quả.', button('Kiểm tra đầu vào', 'diagnostic', '', 'btn btn-primary'))}`;
  },
  reviewCard(q) {
    const saved = (Storage.get().reviewIds || []).includes(q.id);
    return `<article class="card review-card"><div class="section-heading"><span class="pill">${e(q.skill || 'Luyện tập')} ${q.part ? `· Part ${e(q.part)}` : ''} · ${e(typeLabel(questionType(q)))}</span><span class="result-state ${q.isCorrect ? 'is-correct' : ''}">${q.isCorrect ? 'Đúng' : q.isAnswered === false ? 'Chưa trả lời' : 'Cần ôn lại'}</span></div>${q.passage ? `<details><summary>Xem ngữ cảnh</summary><p class="learn-passage">${e(q.passage)}</p></details>` : ''}<h3>${e(q.q)}</h3><div class="answer-comparison"><p>Bạn chọn: <strong>${q.isAnswered !== false && Number.isInteger(q.selected) ? e(q.options?.[q.selected]) : 'Chưa trả lời'}</strong></p><p>Đáp án: <strong>${e(q.options?.[q.correct])}</strong></p></div><div class="learn-explanation"><strong>Giải thích</strong><p>${e(q.explanation || 'Bài này chưa có giải thích; bạn có thể bổ sung trong Quản lý nội dung.')}</p>${q.trapType ? `<p>Bẫy được gắn: ${e(typeLabel(q.trapType))}.</p>` : ''}<p>Ôn lại: ${e(typeLabel(questionType(q)))}. Đọc lại bằng chứng trong câu hoặc đoạn trước khi loại phương án.</p></div><div class="learn-actions">${button('Luyện thêm dạng này', 'practice-question', `data-id="${e(q.id)}"`, 'btn btn-outline btn-sm')}${button(saved ? 'Bỏ lưu' : 'Lưu để xem lại', 'save-review', `data-id="${e(q.id)}"`, 'btn btn-secondary btn-sm')}${button('Ôn kiến thức liên quan', 'theory', `data-type="${e(questionType(q))}"`, 'text-button')}</div></article>`;
  },
  renderJournal() {
    const box = $('learningJournal'); if (!box) return;
    const history = Storage.get().history || []; const a = analyze();
    const days = [...new Set(history.map(h => h.localDate || localDay(new Date(h.timestamp))))];
    box.innerHTML = `<div class="section-heading"><div><span class="eyebrow">MỖI LẦN HỌC ĐỀU CÓ Ý NGHĨA</span><h1 class="page-title">Nhật ký học tập</h1></div>${button('Xem phân tích', 'analysis', '', 'btn btn-outline')}</div><p class="page-desc">${a.weekMinutes} phút đã ghi nhận trong 7 ngày qua. Dữ liệu từ các lượt làm bài đã nộp.</p>${days.length ? days.map(day => `<section class="journal-day"><h2>${e(dateLabel(day))}</h2>${history.filter(h => (h.localDate || localDay(new Date(h.timestamp))) === day).map(h => `<details class="card journal-entry"><summary><div><strong>${e(h.title || h.skill)}${h.part ? ` · Part ${e(h.part)}` : ''}</strong><span>${e(new Date(h.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))} · ${formatSeconds(h.durationSeconds || 0)}${h.assisted ? ' · có hỗ trợ transcript' : ''}</span></div><strong>${h.correct || 0}/${h.total || 0}</strong></summary>${h.breakdown?.length ? `<div class="journal-detail">${h.breakdown.map(q => `<p>${q.isCorrect ? '✓' : q.isAnswered === false ? '○' : '×'} ${e(q.q)} <span>· ${e(typeLabel(questionType(q)))}</span></p>`).join('')}${button('Mở sổ câu cần ôn', 'review', '', 'text-button')}</div>` : '<p class="learn-meta">Bản ghi này chưa có chi tiết từng câu.</p>'}</details>`).join('')}</section>`).join('') : empty('Chưa có nhật ký. Hoàn thành một bài luyện tập để bắt đầu.', button('Bắt đầu khảo sát', 'diagnostic', '', 'btn btn-primary'))}`;
  },
  async showDiagnostic() {
    await this.loadBank();
    const items = diagnosticItems(bank); const total = countQuestions(items); const missing = items.some(q => q.skill === 'listening' && !safeAudio(q.audioUrl));
    setPage('practice');
    $('learningSession').innerHTML = `<section class="card diagnostic-intro"><span class="eyebrow">BÀI KHẢO SÁT ĐẦU VÀO</span><h1 class="page-title">Tìm điểm xuất phát của bạn.</h1><p>${total} câu thuộc các Part đang có trong ngân hàng · 25 phút. Có thể xem lại câu trước khi nộp.</p><div class="learning-stats">${stat('Số câu', total)}${stat('Thời gian', '25 phút')}${stat('Nội dung', 'Listening + Reading')}</div>${missing ? '<div class="learn-notice">Ngân hàng hiện có bài nghe chưa có audio. Bạn có thể đọc transcript để luyện nội dung; kết quả sẽ ghi rõ có hỗ trợ và không được xem là đánh giá khả năng nghe hay điểm TOEIC.</div>' : ''}<p>Kết quả gồm độ chính xác, Part cần luyện và gợi ý tuần đầu. Câu hỏi tự biên soạn dùng để ôn tập.</p><div class="learn-actions">${total ? button('Bắt đầu khảo sát →', 'diagnostic-start', '', 'btn btn-primary') : button('Thêm bài tập', 'admin', '', 'btn btn-primary')}${button('Học theo kế hoạch trước', 'plan')}</div></section>`;
  },
  async startPractice(filter = {}, task = null) {
    await this.loadBank();
    const items = selectPractice(bank, filter);
    if (!items.length) { setPage('practice'); $('learningSession').innerHTML = empty('Chưa có bài đã duyệt phù hợp với dạng này. Bạn có thể tạo thêm và duyệt trong ngân hàng.', button('Tạo bài phù hợp bằng AI', 'ai', `data-part="${e(filter.part || 5)}" data-type="${e(filter.questionType || filter.grammarPoint || 'general')}"`, 'btn btn-primary')); return; }
    this.begin(items, { kind: 'practice', title: filter.part ? `Luyện Part ${filter.part}` : `Luyện ${typeLabel(filter.questionType || filter.grammarPoint || 'general')}`, task });
  },
  practiceType(q) { return this.startPractice({ skill: q.skill, part: q.part, questionType: q.questionType, grammarPoint: q.grammarPoint }); },
  begin(items, options = {}) {
    if (run && !run.result && !confirm('Bạn đang có một bài làm dở. Bắt đầu bài mới sẽ thay lượt làm dở đó. Tiếp tục?')) { setPage('practice'); this.renderSession(); return; }
    clearInterval(timer);
    const session = new QuizSession(items); const id = session.id || newId('attempt');
    run = { id, items, session, questions: session.getFlattenedQuestions(), current: 0, result: null, deadline: Date.now() + (options.kind === 'diagnostic' ? 25 : 30) * 60 * 1000, kind: options.kind || 'practice', title: options.title || 'Luyện tập', task: options.task || null, assisted: items.some(q => q.skill === 'listening' && !safeAudio(q.audioUrl)) };
    persistRun(); setPage('practice'); this.renderSession(); this.startClock();
  },
  startClock() {
    clearInterval(timer); if (!run || run.result) return;
    timer = setInterval(() => {
      if (!run || run.result) { clearInterval(timer); return; }
      const seconds = Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000));
      if ($('learningTimer')) $('learningTimer').textContent = formatSeconds(seconds);
      if (seconds <= 0) this.finish(true);
    }, 1000);
  },
  renderSession() {
    const box = $('learningSession'); if (!box) return;
    if (!run) { box.innerHTML = empty('Chọn một bài trong kế hoạch hoặc bắt đầu bài khảo sát.', button('Kiểm tra đầu vào', 'diagnostic', '', 'btn btn-primary')); return; }
    if (run.result) { this.renderResult(); return; }
    const q = run.questions[run.current]; if (!q) return;
    const parent = run.items.find(item => item.id === (q.parentId || q.id)) || q;
    const transcript = parent.transcript || parent.audio || q.transcript || (q.skill === 'listening' ? q.passage : '');
    const audio = parent.audioUrl || q.audioUrl;
    const selected = run.session.getAnswer(q.id);
    box.innerHTML = `<div class="section-heading"><div><span class="eyebrow">${e(run.title)}</span><h1 class="page-title">Câu ${run.current + 1} <span class="muted">/ ${run.questions.length}</span></h1></div><div class="exam-actions"><span class="exam-clock" id="learningTimer" aria-label="Thời gian còn lại">${formatSeconds(Math.max(0, Math.ceil((run.deadline - Date.now()) / 1000)))}</span>${button('Nộp bài', 'submit', '', 'btn btn-primary')}</div></div><div class="exam-layout"><section class="card exam-question"><span class="pill">${e(q.skill || parent.skill)} ${q.part || parent.part ? `· Part ${e(q.part || parent.part)}` : ''}</span>${q.skill === 'listening' ? `<div class="learn-listening">${safeAudio(audio) ? `<audio controls preload="metadata" src="${e(audio)}"></audio>` : '<p class="learn-notice">Chưa có audio. Bài này dùng transcript để luyện nội dung.</p>'}${transcript ? `<details data-transcript="true"><summary data-learn="transcript">Xem transcript (ghi nhận có hỗ trợ)</summary><p class="learn-passage">${e(transcript)}</p></details>` : ''}</div>` : parent.passage || q.passage ? `<div class="learn-passage">${e(parent.passage || q.passage)}</div>` : ''}<h2>${e(q.skill === 'listening' && !parent.q && !q.parentId ? 'Chọn câu trả lời phù hợp với phần nghe.' : q.q)}</h2><div class="learn-options">${q.options.map((option, index) => `<button type="button" class="learn-option ${selected === index ? 'selected' : ''}" data-learn="answer" data-index="${index}" aria-pressed="${selected === index}"><span>${String.fromCharCode(65 + index)}</span>${e(option)}</button>`).join('')}</div><div class="learn-actions">${button('← Câu trước', 'question', `data-index="${run.current - 1}" ${run.current === 0 ? 'disabled' : ''}`)}${run.current < run.questions.length - 1 ? button('Câu tiếp →', 'question', `data-index="${run.current + 1}"`, 'btn btn-primary') : button('Kiểm tra & nộp bài', 'submit', '', 'btn btn-primary')}</div></section><aside class="card question-map"><h2>Bài làm của bạn</h2><p>${run.session.answers.size}/${run.questions.length} câu đã chọn</p><div class="question-numbers">${run.questions.map((item, i) => button(String(i + 1), 'question', `data-index="${i}" aria-label="Câu ${i + 1}${run.session.answers.has(item.id) ? ', đã trả lời' : ''}"`, `question-number ${run.session.answers.has(item.id) ? 'answered' : ''} ${i === run.current ? 'current' : ''}`)).join('')}</div><p class="learn-meta">Câu trống được ghi riêng. Lượt làm được lưu để tiếp tục sau khi tải lại trang.</p></aside></div>`;
  },
  finish(timedOut = false) {
    if (!run || run.result || busy) return;
    const unanswered = run.questions.length - run.session.answers.size;
    if (!timedOut && unanswered && !confirm(`Còn ${unanswered} câu chưa trả lời. Nộp bài và ghi nhận các câu này là bỏ trống?`)) return;
    busy = true;
    try {
      if (timedOut && !run.session.submitted) { run.session.submitted = true; run.session.endTime = run.deadline; }
      const result = run.session.evaluate();
      Progress.recordQuizResult({ ...result, id: run.id, skill: run.kind === 'diagnostic' ? 'diagnostic' : run.items.every(q => q.skill === run.items[0].skill) ? run.items[0].skill : 'practice', part: run.items.every(q => q.part === run.items[0].part) ? run.items[0].part : 0, title: run.title, kind: run.kind, assisted: run.assisted });
      run.result = result; clearInterval(timer); persistRun();
      if (run.task) updateTask(run.task.date, run.task.id, 'completed');
      lastRecordedId = run.id;
      ensurePlan(bank, localDay(), true);
      if (run.kind === 'diagnostic') for (let i = 0; i < 7; i++) ensurePlan(bank, offsetDay(localDay(), i), true);
      this.renderResult(); status(timedOut ? 'Hết giờ. Bài đã được nộp và lưu.' : 'Đã lưu kết quả. Xem câu cần ôn và bước tiếp theo bên dưới.');
    } catch (err) { status(`Chưa lưu được kết quả: ${err.message}`, true); }
    finally { busy = false; }
  },
  renderResult() {
    const box = $('learningSession'); if (!box || !run?.result) return;
    const r = run.result; const recs = recommendations(bank);
    box.innerHTML = `<section class="card learning-result"><span class="eyebrow">ĐÃ HOÀN THÀNH · ${e(run.title)}</span><h1>Hiểu rõ hơn sau mỗi bài.</h1><div class="result-big">${r.correct}<span> / ${r.total}</span></div><div class="learning-stats">${stat('Độ chính xác', `${r.accuracy}%`)}${stat('Chưa trả lời', r.unanswered)}${stat('Listening', `${r.listening.correct}/${r.listening.total}`)}${stat('Reading', `${r.reading.correct}/${r.reading.total}`)}</div><p>${run.assisted ? 'Bài có hỗ trợ transcript hoặc thiếu audio; kết quả chưa đánh giá khả năng nghe độc lập.' : 'Kết quả luyện tập trên nhóm câu hỏi này, không phải điểm TOEIC chính thức.'}</p><div class="learn-actions">${button('Xem lộ trình của tôi →', 'plan', '', 'btn btn-primary')}${button('Phân tích theo Part', 'analysis')}${button('Tạo thêm bài theo điểm yếu', 'ai')}</div></section><section class="card"><h2>Ba việc nên luyện tiếp</h2>${recs.slice(0, 3).map(rec => `<div class="error-type-row"><div><strong>${e(rec.title)}</strong><span>${e(rec.reason)}</span></div>${button('Luyện', rec.kind === 'review' ? 'review-start' : 'practice', `data-part="${e(rec.part || '')}" data-type="${e(rec.questionType || '')}"`, 'btn btn-outline btn-sm')}</div>`).join('') || '<p>Chưa có đủ bài phù hợp trong ngân hàng. Bạn có thể thêm bài ở trang quản lý.</p>'}</section><h2 class="section-title">Đáp án & giải thích từng câu</h2>${r.breakdown.map(q => this.reviewCard(q)).join('')}`;
  },
  saveReview(id) {
    const state = Storage.get(); state.reviewIds ||= [];
    if (state.reviewIds.includes(id)) state.reviewIds = state.reviewIds.filter(x => x !== id); else state.reviewIds.push(id);
    Storage.save(state); status(state.reviewIds.includes(id) ? 'Đã lưu vào sổ câu cần ôn.' : 'Đã bỏ lưu câu hỏi. Câu sai vẫn ở sổ cho đến khi làm đúng.');
    if (run?.result && document.querySelector('.page.active')?.id === 'page-practice') this.renderResult();
  },
  async openAI(filter = {}) {
    const context = generationContext(filter);
    AdminUI.setGenerationContext?.(context); setPage('admin');
    status('Đã điền gợi ý theo điểm yếu. Xem lại cấu hình trước khi yêu cầu AI tạo bài.');
  },
  async action(action, d) {
    if (action === 'navigate') return setPage(d.page);
    if (['home', 'profile', 'review', 'journal', 'admin'].includes(action)) return setPage(action);
    if (action === 'analysis') return setPage('progress');
    if (action === 'plan') return setPage('roadmap');
    if (action === 'plan-date') { selectedPlanDate = d.date; return this.renderPlan(); }
    if (action === 'diagnostic') return this.showDiagnostic();
    if (action === 'diagnostic-start') return this.begin(diagnosticItems(bank), { kind: 'diagnostic', title: 'Khảo sát đầu vào' });
    if (action === 'practice') return this.startPractice({ part: d.part ? Number(d.part) : undefined, questionType: d.type || undefined });
    if (action === 'practice-question') { const q = analyze().latest.find(q => q.id === d.id); if (q) return this.practiceType(q); }
    if (action === 'ai') return this.openAI({ ...(d.part ? { part: Number(d.part) } : {}), ...(d.type ? { errorTypes: [d.type], questionType: d.type } : {}) });
    if (action === 'regenerate') { await this.loadBank(); ensurePlan(bank, d.date || localDay(), true); this.renderPlan(); status('Đã cập nhật gợi ý từ kết quả gần nhất. Nhiệm vụ hoàn thành được giữ lại.'); return; }
    if (action === 'task-state') { updateTask(d.date, d.id, d.state); this.renderPlan(); return; }
    if (action === 'task-start') {
      const task = Storage.get().dailyPlans?.[d.date]?.find(t => t.id === d.id); if (!task) return;
      if (task.kind === 'vocabulary') { setPage('vocabulary'); window.switchVocabTopic(task.topic || 'business'); return; }
      if (task.kind === 'review') return this.startReview(task);
      return this.startPractice(task, { date: d.date, id: d.id });
    }
    if (action === 'review-start') return this.startReview();
    if (action === 'save-review') return this.saveReview(d.id);
    if (action === 'resume') { setPage('practice'); this.renderSession(); return; }
    if (action === 'question' && run) { const i = Number(d.index); if (i >= 0 && i < run.questions.length) { run.current = i; persistRun(); this.renderSession(); } return; }
    if (action === 'answer' && run) { if (Date.now() >= run.deadline) return this.finish(true); run.session.selectAnswer(run.questions[run.current].id, Number(d.index)); persistRun(); this.renderSession(); return; }
    if (action === 'submit') return this.finish();
    if (action === 'transcript' && run) { run.assisted = true; persistRun(); return; }
    if (action === 'theory') { const map = { 'word-form': 'wordform', 'verb-tense': 'tenses', passive: 'passive', conditional: 'condition', 'relative-clause': 'relative' }; setPage('grammar'); window.switchGrammarTopic(map[d.type] || 'tenses'); }
  },
  startReview(task = null) {
    const questions = reviewQuestions().slice(0, 5);
    if (!questions.length) { status('Chưa có câu cần ôn.'); setPage('review'); return; }
    const items = questions.map(q => ({ ...q, type: 'single-choice', status: 'approved', transcript: q.transcript || (q.skill === 'listening' ? q.passage : ''), passage: q.skill !== 'listening' ? q.passage : null }));
    this.begin(items, { title: 'Ôn lại câu cần nhớ', kind: 'review', task: task ? { date: task.date, id: task.id } : null });
  }
};
window.PersonalLearningUI = PersonalLearningUI;
