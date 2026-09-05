/**
 * TOEIC Master - Main Application Entry Point
 * Modern Modular Architecture using ES Modules
 */
import { Storage } from './modules/storage.js';
import { Progress } from './modules/progress.js';
import { ContentLoader } from './modules/content-loader.js';
import { Validator } from './modules/validation.js';
import { ListeningUI } from './modules/listening.js';
import { ReadingUI } from './modules/reading.js';
import { SpeakingUI } from './modules/speaking.js';
import { WritingUI } from './modules/writing.js';
import { VocabUI } from './modules/vocabulary.js';
import { GrammarUI } from './modules/grammar.js';
import { MockTestUI } from './modules/mock-test.js';
import { AdminUI } from './modules/admin.js';
import { PersonalLearningUI } from './modules/personal-learning-ui.js';

// State variables for subtabs
let currentListeningPart = 1;
let currentReadingPart = 5;
let currentSpeakingType = 1;
let currentWritingType = 1;
let currentVocabTopic = 'business';
let currentGrammarTopic = 'tenses';

/* === NAVIGATION === */
export function navigateTo(pageId) {
  if (!document.getElementById('page-' + pageId)) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const targetPage = document.getElementById('page-' + pageId);
  const targetNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);

  if (targetPage) targetPage.classList.add('active');
  if (targetNav) targetNav.classList.add('active');

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('show');
    document.querySelector('.mobile-menu-btn')?.setAttribute('aria-expanded', 'false');
  }
  document.querySelectorAll('audio').forEach(audio => audio.pause());
  document.querySelector('.main-content')?.scrollTo({ top: 0 });
  document.querySelectorAll('.nav-item').forEach(nav => nav.setAttribute('aria-current', nav === targetNav ? 'page' : 'false'));

  // Update daily progress on any navigation
  updateDailyProgress();

  // Initialize corresponding page content
  switch (pageId) {
    case 'home':
      updateHomeStats();
      PersonalLearningUI.renderHome();
      break;
    case 'roadmap':
      selectLevel(1);
      PersonalLearningUI.renderPlan();
      break;
    case 'profile': PersonalLearningUI.renderProfile(); break;
    case 'practice': PersonalLearningUI.renderSession(); break;
    case 'review': PersonalLearningUI.renderReview(); break;
    case 'journal': PersonalLearningUI.renderJournal(); break;
    case 'listening':
      ListeningUI.init(currentListeningPart);
      break;
    case 'reading':
      ReadingUI.init(currentReadingPart);
      break;
    case 'speaking':
      SpeakingUI.init(currentSpeakingType);
      break;
    case 'writing':
      WritingUI.init(currentWritingType);
      break;
    case 'vocabulary':
      VocabUI.init(currentVocabTopic);
      refreshTopicTabs('vocabulary');
      break;
    case 'grammar':
      switchGrammarTopic(currentGrammarTopic);
      refreshTopicTabs('grammar');
      break;
    case 'mocktest':
      MockTestUI.init();
      break;
    case 'progress':
      updateProgressPage();
      PersonalLearningUI.renderAnalysis();
      break;
    case 'admin':
      AdminUI.init();
      break;
  }
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show');
  document.querySelector('.mobile-menu-btn')?.setAttribute('aria-expanded', String(sidebar?.classList.contains('open') || false));
}

/* === STATS & PROGRESS TRACKING === */
export function updateDailyProgress() {
  const stats = Progress.getStats();
  const bar = document.getElementById('dailyProgress');
  const text = document.getElementById('dailyProgressText');

  if (bar) bar.style.width = stats.todayProgressPct + '%';
  if (text) text.textContent = `${stats.todayLessons} / ${stats.todayGoal} bài học`;
}

export function updateHomeStats() {
  const stats = Progress.getStats();
  const totalEl = document.getElementById('homeTotalLessons');
  const streakEl = document.getElementById('homeStreak');
  const vocabEl = document.getElementById('homeVocab');
  const accEl = document.getElementById('homeAccuracy');

  if (totalEl) totalEl.textContent = stats.totalLessons;
  if (streakEl) streakEl.textContent = stats.streak;
  if (vocabEl) vocabEl.textContent = stats.vocabCount;
  if (accEl) accEl.textContent = stats.totalAnswered > 0 ? `${stats.accuracy}%` : '—';
}

export function updateProgressPage() {
  const stats = Progress.getStats();

  const totalEl = document.getElementById('progTotal');
  const quizEl = document.getElementById('progQuiz');
  const vocabEl = document.getElementById('progVocab');
  const streakEl = document.getElementById('progStreak');

  if (totalEl) totalEl.textContent = stats.totalLessons;
  if (quizEl) quizEl.textContent = stats.mockTests;
  if (vocabEl) vocabEl.textContent = stats.vocabCount;
  if (streakEl) streakEl.textContent = stats.streak;

  const maxSkill = 20;
  const skills = stats.skills;

  Object.entries(skills).forEach(([skill, count]) => {
    const capitalized = skill.charAt(0).toUpperCase() + skill.slice(1);
    const labelEl = document.getElementById('prog' + capitalized);
    const barEl = document.getElementById('prog' + capitalized + 'Bar');

    if (labelEl) labelEl.textContent = `${count} bài`;
    if (barEl) barEl.style.width = Math.min(Math.round((count / maxSkill) * 100), 100) + '%';
  });

  // Render history list
  const historyContainer = document.getElementById('progHistory');
  if (historyContainer) {
    if (!stats.history || stats.history.length === 0) {
      historyContainer.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--text-muted)">
          Chưa có dữ liệu. Bắt đầu học để xem tiến độ!
        </div>
      `;
    } else {
      let hHtml = `
        <div class="history-list-table-wrapper" style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:var(--bg-secondary); border-bottom:1px solid var(--border);">
                <th style="padding:10px 14px; text-align:left;">Thời gian</th>
                <th style="padding:10px 14px; text-align:left;">Kỹ năng / Part</th>
                <th style="padding:10px 14px; text-align:center;">Số câu đúng</th>
                <th style="padding:10px 14px; text-align:center;">Độ chính xác</th>
              </tr>
            </thead>
            <tbody>
      `;

      stats.history.slice(0, 15).forEach(h => {
        const timeStr = new Date(h.timestamp).toLocaleDateString('vi-VN', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
        });
        hHtml += `
          <tr style="border-bottom:1px solid var(--border-light);">
            <td style="padding:10px 14px; color:var(--text-secondary);">${timeStr}</td>
            <td style="padding:10px 14px; font-weight:500;">
              <span class="badge ${h.skill === 'listening' ? 'badge-info' : 'badge-accent'}">
                ${Validator.sanitizeHtml(String(h.skill || 'quiz').toUpperCase())} ${h.part ? `P${Validator.sanitizeHtml(String(h.part))}` : ''}
              </span>
            </td>
            <td style="padding:10px 14px; text-align:center; font-weight:600;">${h.correct} / ${h.total}</td>
            <td style="padding:10px 14px; text-align:center;">
              <span style="color:${h.scorePct >= 70 ? 'var(--success)' : 'var(--accent)'}; font-weight:600;">
                ${h.scorePct}%
              </span>
            </td>
          </tr>
        `;
      });

      hHtml += `
            </tbody>
          </table>
        </div>
      `;
      historyContainer.innerHTML = hHtml;
    }
  }
}

/* === SUBTAB SWITCHERS === */
export function switchListeningPart(part) {
  currentListeningPart = parseInt(part, 10) || 1;
  const tabs = document.querySelectorAll('#listeningTabs .tab');
  tabs.forEach((tab, idx) => {
    tab.classList.toggle('active', idx + 1 === currentListeningPart);
  });

  const partDescs = {
    1: { title: 'Part 1: Mô tả hình ảnh (Photographs)', desc: 'Nghe một mô tả ngắn về một bức tranh và chọn câu mô tả đúng nhất. 6 câu hỏi.' },
    2: { title: 'Part 2: Hỏi & Đáp (Question-Response)', desc: 'Nghe một câu hỏi và ba câu trả lời. Chọn câu trả lời phù hợp nhất. 25 câu hỏi.' },
    3: { title: 'Part 3: Hội thoại ngắn (Short Conversations)', desc: 'Nghe một đoạn hội thoại ngắn giữa 2 người và trả lời 3 câu hỏi. 39 câu hỏi.' },
    4: { title: 'Part 4: Bài nói ngắn (Short Talks)', desc: 'Nghe một bài nói ngắn (thông báo, quảng cáo, tin tức) và trả lời 3 câu hỏi. 30 câu hỏi.' }
  };

  const meta = partDescs[currentListeningPart];
  if (meta) {
    const titleEl = document.getElementById('listeningPartTitle');
    const descEl = document.getElementById('listeningPartDesc');
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
  }

  ListeningUI.init(currentListeningPart);
}

export function switchReadingPart(part) {
  currentReadingPart = parseInt(part, 10) || 5;
  const tabs = document.querySelectorAll('#readingTabs .tab');
  tabs.forEach(tab => {
    const match = tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(currentReadingPart.toString());
    tab.classList.toggle('active', !!match);
  });

  const partDescs = {
    5: { title: 'Part 5: Hoàn thành câu (Incomplete Sentences)', desc: 'Chọn từ hoặc cụm từ đúng để hoàn thành câu. 30 câu hỏi — tập trung ngữ pháp và từ vựng.' },
    6: { title: 'Part 6: Hoàn thành đoạn văn (Text Completion)', desc: 'Điền từ hoặc câu thích hợp vào 4 chỗ trống trong một đoạn văn ngắn. 16 câu hỏi.' },
    7: { title: 'Part 7: Đọc hiểu văn bản (Reading Comprehension)', desc: 'Đọc các văn bản (email, thông báo, bài báo, hợp đồng) và trả lời câu hỏi đọc hiểu. 54 câu hỏi.' }
  };

  const meta = partDescs[currentReadingPart];
  if (meta) {
    const titleEl = document.getElementById('readingPartTitle');
    const descEl = document.getElementById('readingPartDesc');
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
  }

  ReadingUI.init(currentReadingPart);
}

export function switchSpeakingType(typeId) {
  currentSpeakingType = parseInt(typeId, 10) || 1;
  const tabs = document.querySelectorAll('#speakingTabs .tab');
  tabs.forEach((tab, idx) => {
    tab.classList.toggle('active', idx + 1 === currentSpeakingType);
  });
  SpeakingUI.init(currentSpeakingType);
}

export function switchWritingType(typeId) {
  currentWritingType = parseInt(typeId, 10) || 1;
  const tabs = document.querySelectorAll('#writingTabs .tab');
  tabs.forEach((tab, idx) => {
    tab.classList.toggle('active', idx + 1 === currentWritingType);
  });
  WritingUI.init(currentWritingType);
}

export function switchVocabTopic(topic) {
  currentVocabTopic = topic;
  const tabs = document.querySelectorAll('#vocabTabs .tab');
  tabs.forEach(tab => {
    const match = tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(topic);
    tab.classList.toggle('active', !!match);
  });
  VocabUI.init(currentVocabTopic);
}

export function switchGrammarTopic(topic) {
  currentGrammarTopic = topic;
  const tabs = document.querySelectorAll('#grammarTabs .tab');
  tabs.forEach(tab => {
    const match = tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(topic);
    tab.classList.toggle('active', !!match);
  });
  const aliases = { relative: 'relative-clauses', condition: 'conditionals', wordform: 'word-form' };
  GrammarUI.init(aliases[currentGrammarTopic] || currentGrammarTopic);
}

async function refreshTopicTabs(skill) {
  const parent = document.getElementById(skill === 'vocabulary' ? 'vocabTabs' : 'grammarTabs');
  const builtIn = skill === 'vocabulary' ? ['business','office','travel','finance','health'] : ['tenses','passive','relative-clauses','conditionals','word-form'];
  const topics = await ContentLoader.getTopics(skill);
  parent?.querySelectorAll('[data-custom-topic]').forEach(el => el.remove());
  topics.filter(topic => !builtIn.includes(topic)).forEach(topic => {
    const button = document.createElement('button'); button.className = 'tab'; button.textContent = topic; button.dataset.customTopic = topic;
    button.onclick = () => { (skill === 'vocabulary' ? switchVocabTopic : switchGrammarTopic)(topic); parent.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === button)); };
    parent.append(button);
  });
}

/* === ROADMAP DATA & LOGIC === */
const roadmapData = {
  1: [
    { title: 'Làm quen phát âm cơ bản', desc: 'Học bảng IPA, nguyên âm, phụ âm cơ bản. Luyện nghe các âm tiếng Anh.', status: 'current' },
    { title: 'Từ vựng nền tảng (500 từ)', desc: 'Học 500 từ vựng cơ bản nhất theo chủ đề: gia đình, công việc, mua sắm.', status: 'pending' },
    { title: 'Ngữ pháp cốt lõi', desc: '12 thì cơ bản, câu bị động, mệnh đề quan hệ, word form.', status: 'pending' },
    { title: 'Listening Part 1 & 2', desc: 'Luyện nghe mô tả hình ảnh và hỏi-đáp cơ bản.', status: 'pending' },
    { title: 'Reading Part 5 cơ bản', desc: 'Hoàn thành câu — tập trung ngữ pháp và từ loại.', status: 'pending' },
    { title: 'Kiểm tra trình độ #1', desc: 'Làm bài test 20 câu để đánh giá mức tiến bộ.', status: 'pending' }
  ],
  2: [
    { title: 'Mở rộng từ vựng (+500 từ)', desc: 'Từ vựng chủ đề kinh doanh, văn phòng, du lịch, tài chính.', status: 'current' },
    { title: 'Ngữ pháp nâng cao', desc: 'Câu điều kiện, câu ước, đảo ngữ, liên từ & mệnh đề.', status: 'pending' },
    { title: 'Listening Part 3 & 4', desc: 'Luyện nghe hội thoại và bài nói ngắn. Ghi chú thông tin chính.', status: 'pending' },
    { title: 'Reading Part 5-6 nâng cao', desc: 'Hoàn thành đoạn văn, sửa lỗi ngữ pháp trong ngữ cảnh.', status: 'pending' },
    { title: 'Reading Part 7 đơn', desc: 'Đọc hiểu đoạn đơn: email, quảng cáo, thông báo.', status: 'pending' },
    { title: 'Speaking: Đọc to & mô tả', desc: 'Luyện phát âm, ngữ điệu, mô tả tranh.', status: 'pending' },
    { title: 'Writing: Viết câu & email', desc: 'Viết câu dựa trên hình ảnh, trả lời email ngắn.', status: 'pending' },
    { title: 'Kiểm tra trình độ #2', desc: 'Mock test 40 câu — mục tiêu 500+ điểm.', status: 'pending' }
  ],
  3: [
    { title: 'Từ vựng nâng cao (+500 từ)', desc: 'Collocations, phrasal verbs, từ vựng học thuật.', status: 'current' },
    { title: 'Listening tốc độ thật', desc: 'Luyện nghe với tốc độ tự nhiên, nhiều accent khác nhau.', status: 'pending' },
    { title: 'Reading Part 7 kép', desc: 'Đọc hiểu đoạn kép: so sánh, liên kết thông tin.', status: 'pending' },
    { title: 'Chiến thuật làm bài', desc: 'Quản lý thời gian, kỹ năng loại trừ, mẹo làm từng Part.', status: 'pending' },
    { title: 'Speaking nâng cao', desc: 'Trả lời câu hỏi phức tạp, đưa ra ý kiến có lập luận.', status: 'pending' },
    { title: 'Writing: Bài luận', desc: 'Viết bài luận 300 từ bày tỏ ý kiến với lập luận rõ ràng.', status: 'pending' },
    { title: 'Full Mock Test', desc: 'Thi thử đầy đủ 200 câu L&R — mục tiêu 750+ điểm.', status: 'pending' }
  ]
};

export function selectLevel(level) {
  document.querySelectorAll('.level-card').forEach((c, i) => {
    c.style.border = (i + 1 === level) ? '2px solid var(--accent)' : '2px solid transparent';
  });
  renderRoadmap(level);
}

export function renderRoadmap(level) {
  const items = roadmapData[level] || [];
  const container = document.getElementById('roadmapContent');
  if (!container) return;

  container.innerHTML = '<div class="roadmap">' + items.map(item => `
    <div class="roadmap-item ${item.status}">
      <div class="roadmap-dot"></div>
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div class="roadmap-title">${Validator.sanitizeHtml(item.title)}</div>
          <div class="roadmap-desc">${Validator.sanitizeHtml(item.desc)}</div>
        </div>
        <span class="badge ${item.status === 'completed' ? 'badge-success' : item.status === 'current' ? 'badge-accent' : 'badge-info'}">
          ${item.status === 'completed' ? 'Hoàn thành' : item.status === 'current' ? 'Đang học' : 'Chưa bắt đầu'}
        </span>
      </div>
    </div>
  `).join('') + '</div>';
}

/* === EXPOSE GLOBALS FOR INLINE EVENT HANDLERS === */
window.navigateTo = navigateTo;
window.toggleSidebar = toggleSidebar;
window.switchListeningPart = switchListeningPart;
window.switchReadingPart = switchReadingPart;
window.switchSpeakingType = switchSpeakingType;
window.switchWritingType = switchWritingType;
window.switchVocabTopic = switchVocabTopic;
window.switchGrammarTopic = switchGrammarTopic;
window.selectLevel = selectLevel;
window.resetLearningProgress = () => {
  if (!confirm('Đặt lại tiến độ và lịch sử? Ngân hàng bài tập và mục tiêu của bạn được giữ.')) return;
  const data = Storage.get();
  const keep = { customExercises: data.customExercises, deletedExerciseIds: data.deletedExerciseIds, profile: data.profile };
  // Clear only this app's progress; never clear unrelated origin storage.
  const reset = Storage.migrate({}, 1);
  Storage.save({ ...reset, ...keep });
  location.reload();
};

// Initial application boot
document.addEventListener('DOMContentLoaded', async () => {
  Storage.init();
  updateDailyProgress();
  updateHomeStats();
  selectLevel(1);
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.setAttribute('role', 'button'); nav.tabIndex = 0;
    nav.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); nav.click(); } });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('sidebar')?.classList.contains('open')) toggleSidebar();
  });
  Storage.subscribe(() => { updateDailyProgress(); updateHomeStats(); if (document.getElementById('page-progress')?.classList.contains('active')) updateProgressPage(); });
  try { await PersonalLearningUI.init(); }
  catch (error) { const box = document.getElementById('learningHome'); if (box) { box.textContent = 'Không tải được nội dung: ' + error.message + '. Hãy tải lại trang hoặc mở Quản lý nội dung.'; } }
});
