import { Storage } from './storage.js';

export const TYPE_LABELS = {
  general: 'Tổng hợp', infinitive: 'Động từ nguyên mẫu', tenses: 'Thì động từ', conditionals: 'Điều kiện', grammar: 'Ngữ pháp', vocabulary: 'Từ vựng', 'word-form': 'Từ loại',
  'verb-tense': 'Thì động từ', preposition: 'Giới từ', detail: 'Thông tin chi tiết',
  'main-idea': 'Ý chính', inference: 'Suy luận', paraphrase: 'Diễn đạt tương đương',
  'relative-clause': 'Mệnh đề quan hệ', passive: 'Bị động', conditional: 'Điều kiện',
  'question-response': 'Hỏi & đáp', photograph: 'Mô tả hình ảnh', comparison: 'So sánh',
  'negative-question': 'Câu hỏi phủ định', distractor: 'Đáp án nhiễu', unanswered: 'Chưa trả lời'
};
export const typeLabel = value => TYPE_LABELS[value] || value || 'Chưa phân loại';
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function offsetDay(day, offset) {
  const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + offset); return localDay(d);
}
export const newId = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const stamp = h => h.localDate || (h.timestamp && localDay(new Date(h.timestamp)));
const percentage = (correct, total) => total ? Math.round(correct / total * 100) : null;
export function getProfile(state = Storage.get()) {
  return { currentScore: null, targetScore: 750, examDate: '', dailyMinutes: 30, weakParts: [], onboarded: false, ...state.profile };
}
export function validateProfile(profile, now = new Date()) {
  const errors = [];
  if (!Number.isInteger(profile.targetScore) || profile.targetScore < 10 || profile.targetScore > 990) errors.push('Điểm mục tiêu phải từ 10 đến 990.');
  if (profile.currentScore !== null && (!Number.isInteger(profile.currentScore) || profile.currentScore < 10 || profile.currentScore > 990)) errors.push('Điểm hiện tại phải từ 10 đến 990, hoặc để trống.');
  if (!Number.isInteger(profile.dailyMinutes) || profile.dailyMinutes < 10 || profile.dailyMinutes > 180) errors.push('Thời gian học mỗi ngày phải từ 10 đến 180 phút.');
  if (profile.examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(profile.examDate) || Number.isNaN(Date.parse(profile.examDate)) || localDay(new Date(`${profile.examDate}T12:00:00`)) !== profile.examDate || profile.examDate < localDay(now))) errors.push('Chọn ngày thi hợp lệ từ hôm nay trở đi.');
  if (!Array.isArray(profile.weakParts) || profile.weakParts.some(p => !Number.isInteger(p) || p < 1 || p > 7)) errors.push('Part cần luyện phải từ 1 đến 7.');
  return errors;
}
export function saveProfile(profile) {
  const errors = validateProfile(profile); if (errors.length) return { success: false, errors };
  const state = Storage.get();
  state.profile = { ...profile, onboarded: true, updatedAt: new Date().toISOString() };
  Storage.save(state); return { success: true };
}
export function analyze(state = Storage.get(), now = new Date()) {
  const history = state.history || [];
  const parts = new Map(); const types = new Map(); const skills = new Map(); const latest = new Map();
  const today = localDay(now); const week = Array.from({ length: 7 }, (_, i) => ({ date: offsetDay(today, i - 6), lessons: 0, seconds: 0, correct: 0, total: 0 }));
  let previousTotal = 0, previousCorrect = 0;
  const add = (map, key, q) => {
    const row = map.get(key) || { key, total: 0, correct: 0, unanswered: 0, assisted: 0 };
    row.total++; row.correct += Number(q.isCorrect === true); row.unanswered += Number(q.isAnswered === false); row.assisted += Number(q.assisted === true);
    row.accuracy = percentage(row.correct, row.total); map.set(key, row);
  };
  [...history].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).forEach(h => {
    const day = stamp(h); const w = week.find(d => d.date === day);
    if (w) { w.lessons++; w.seconds += h.durationSeconds || 0; w.correct += h.correct || 0; w.total += h.total || 0; }
    if (day >= offsetDay(today, -13) && day < offsetDay(today, -6)) { previousTotal += h.total || 0; previousCorrect += h.correct || 0; }
    (h.breakdown || []).forEach(raw => {
      const q = { ...raw, assisted: raw.skill === 'listening' && Boolean(raw.assisted || h.assisted), timestamp: h.timestamp };
      if (q.part >= 1 && q.part <= 7) add(parts, String(q.part), q);
      if (q.skill) add(skills, q.skill, q);
      add(types, q.isAnswered === false ? 'unanswered' : (q.grammarPoint || q.questionType || 'general'), q);
      if (!latest.has(q.id)) latest.set(q.id, q);
    });
  });
  const weekTotal = week.reduce((n, d) => n + d.total, 0);
  const weekCorrect = week.reduce((n, d) => n + d.correct, 0);
  return {
    parts: [...parts.values()].sort((a, b) => a.accuracy - b.accuracy),
    types: [...types.values()].sort((a, b) => (b.total - b.correct) - (a.total - a.correct)),
    skills: [...skills.values()], week, latest: [...latest.values()],
    mistakes: [...latest.values()].filter(q => !q.isCorrect),
    weekMinutes: Math.round(week.reduce((n, d) => n + d.seconds, 0) / 60),
    weekAccuracy: percentage(weekCorrect, weekTotal), previousAccuracy: percentage(previousCorrect, previousTotal),
    latestTest: history.find(h => ['diagnostic', 'mocktest'].includes(h.skill) || h.kind === 'diagnostic') || null
  };
}
export function questionType(item) { return item.grammarPoint || item.questionType || 'general'; }
export function getScorableItems(bank) {
  return bank.filter(q => q.status === 'approved' && ['listening', 'reading', 'grammar'].includes(q.skill) && (Array.isArray(q.options) || Array.isArray(q.questions)));
}
export function countQuestions(items) { return items.reduce((n, q) => n + (q.questions?.length || 1), 0); }
export function selectPractice(bank, filter = {}, state = Storage.get()) {
  const latest = new Map(analyze(state).latest.map(q => [q.parentId || q.id, q]));
  const candidates = getScorableItems(bank).filter(item => {
    if (filter.skill && item.skill !== filter.skill) return false;
    if (filter.part && Number(item.part) !== Number(filter.part)) return false;
    const requested = filter.grammarPoint || filter.questionType;
    if (requested && requested !== 'general' && questionType(item) !== requested && !(item.questions || []).some(q => questionType({ ...item, ...q }) === requested)) return false;
    return true;
  });
  // Unseen questions first, then older attempts. Preserve whole passages and their context.
  candidates.sort((a, b) => String(latest.get(a.id)?.timestamp || '').localeCompare(String(latest.get(b.id)?.timestamp || '')));
  const selected = []; let count = 0;
  for (const item of candidates) { if (count >= (filter.count || 10)) break; selected.push(item); count += item.questions?.length || 1; }
  return selected;
}
export function diagnosticItems(bank) {
  const eligible = getScorableItems(bank); const selected = [];
  for (let part = 1; part <= 7; part++) {
    const items = eligible.filter(q => Number(q.part) === part);
    selected.push(...items.slice(0, [1, 2, 5].includes(part) ? 2 : 1));
  }
  return selected;
}
export function recommendations(bank, state = Storage.get(), now = new Date()) {
  const a = analyze(state, now); const profile = getProfile(state); const today = localDay(now);
  const examDays = profile.examDate ? Math.ceil((new Date(`${profile.examDate}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000) : null;
  const availableParts = [...new Set(getScorableItems(bank).map(q => Number(q.part)).filter(p => p >= 1 && p <= 7))];
  const ranked = availableParts.map(part => {
    const row = a.parts.find(p => p.key === String(part));
    const recent = a.latest.filter(q => Number(q.part) === part);
    const type = recent.filter(q => !q.isCorrect).map(questionType).find(t => t !== 'general' && !t.startsWith('part-'));
    const doneToday = (state.history || []).some(h => stamp(h) === today && (h.breakdown || []).some(q => Number(q.part) === part));
    const priority = (row ? 100 - row.accuracy : part === 5 ? 60 : part === 2 ? 58 : 55) + (profile.weakParts.includes(part) ? 15 : 0) - (doneToday ? 45 : 0);
    const skill = part <= 4 ? 'listening' : 'reading';
    let reason = row ? `Bạn đúng ${row.correct}/${row.total} câu Part ${part}${row.total < 5 ? ' — dữ liệu còn ít' : ''}.` : `Chưa có kết quả Part ${part}; luyện một nhóm nhỏ để có điểm xuất phát.`;
    if (type) reason += ` Ôn ${typeLabel(type).toLowerCase()} từ các câu vừa sai.`;
    if (row?.assisted) reason += ' Có lượt xem transcript; chưa dùng để đánh giá năng lực nghe.';
    const level = row?.total >= 5 ? (row.accuracy >= 85 ? 'advanced' : row.accuracy < 50 ? 'beginner' : 'intermediate') : (profile.targetScore >= 800 ? 'advanced' : profile.targetScore < 500 ? 'beginner' : 'intermediate');
    return { kind: 'practice', part, skill, questionType: type || 'general', level, title: `Part ${part} · ${typeLabel(type || 'general')}`, reason, priority, minutes: part >= 3 && part !== 5 ? 10 : 6, count: 10 };
  }).sort((a, b) => b.priority - a.priority);
  const items = [];
  if (a.mistakes.length) items.push({ kind: 'review', title: `Làm lại ${Math.min(5, a.mistakes.length)} câu cần ôn`, reason: 'Dựa trên đáp án sai hoặc bỏ trống trong lần làm gần nhất của mỗi câu.', count: 5, minutes: 5 });
  items.push(...ranked.slice(0, 3));
  const vocab = bank.filter(q => q.skill === 'vocabulary' && q.status === 'approved' && !state.learnedWords?.[q.word]);
  if (vocab.length) items.push({ kind: 'vocabulary', topic: vocab[0].topic || 'business', title: `Ôn từ vựng · ${vocab[0].topic || 'business'}`, reason: `${vocab.length} từ trong ngân hàng chưa được đánh dấu thuộc.`, minutes: 5 });
  let remaining = profile.dailyMinutes;
  return items.filter(item => { if (remaining < Math.min(5, item.minutes)) return false; item.minutes = Math.min(item.minutes, remaining); remaining -= item.minutes; return true; }).map(item => ({ ...item, reason: item.reason + (examDays !== null && examDays <= 14 ? ` Còn ${examDays} ngày đến ngày thi; ưu tiên bài ngắn và sửa lỗi.` : '') }));
}
export function ensurePlan(bank, date = localDay(), regenerate = false) {
  const state = Storage.get(); state.dailyPlans ||= {};
  if (state.dailyPlans[date] && !regenerate) return state.dailyPlans[date];
  const preserved = (state.dailyPlans[date] || []).filter(t => t.status !== 'pending');
  const recs = recommendations(bank, state, new Date(`${date}T12:00:00`));
  state.dailyPlans[date] = [...preserved, ...recs.filter(r => !preserved.some(t => t.kind === r.kind && t.part === r.part)).map(r => ({ ...r, id: newId('task'), date, status: 'pending', createdAt: new Date().toISOString() }))];
  Storage.save(state); return state.dailyPlans[date];
}
export function updateTask(date, id, action) {
  const state = Storage.get(); const task = state.dailyPlans?.[date]?.find(t => t.id === id); if (!task) return false;
  if (action === 'postpone') {
    const tomorrow = offsetDay(date, 1); state.dailyPlans[tomorrow] ||= [];
    if (!state.dailyPlans[tomorrow].some(t => t.movedFrom === id)) state.dailyPlans[tomorrow].push({ ...task, id: newId('task'), movedFrom: id, date: tomorrow, status: 'pending' });
    task.status = 'postponed';
  } else if (['completed', 'skipped', 'pending'].includes(action)) task.status = action;
  else return false;
  task.updatedAt = new Date().toISOString(); Storage.save(state); return true;
}
export function reviewQuestions(state = Storage.get()) {
  const a = analyze(state); const ids = new Set(state.reviewIds || []);
  return a.latest.filter(q => !q.isCorrect || ids.has(q.id));
}
export function generationContext(filter = {}, state = Storage.get()) {
  const a = analyze(state); const profile = getProfile(state);
  const part = Number(filter.part || a.parts[0]?.key || profile.weakParts[0] || 5);
  const mistakes = a.mistakes.filter(q => Number(q.part) === part);
  return {
    skill: part <= 4 ? 'listening' : 'reading', part, topic: mistakes[0]?.topic || 'business',
    level: filter.level || 'intermediate', targetScore: profile.targetScore, count: 3,
    errorTypes: [...new Set(mistakes.map(questionType).filter(t => t !== 'general'))],
    recentMistakes: mistakes.slice(0, 5).map(q => ({ q: q.q, selectedAnswer: q.options?.[q.selected] || null, correctAnswer: q.options?.[q.correct], questionType: questionType(q) })),
    ...filter
  };
}
