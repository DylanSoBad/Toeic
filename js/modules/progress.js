/** Activity counters and history share a single persistent commit. */
import { Storage } from './storage.js';

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const nonnegative = value => Math.max(0, Math.floor(Number(value) || 0));
export function createAttemptId(prefix = 'attempt') {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
export function calculateStreak(dailyLessons, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!(dailyLessons?.[localDateKey(day)] > 0)) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (dailyLessons?.[localDateKey(day)] > 0) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
function recordActivity(data, entry, now) {
  const date = localDateKey(now);
  data.totalLessons = nonnegative(data.totalLessons) + 1;
  data.dailyLessons[date] = nonnegative(data.dailyLessons[date]) + 1;
  data.lastActiveDate = date;
  data.streak = calculateStreak(data.dailyLessons, now);
  const key = `skill${entry.skill[0]?.toUpperCase()}${entry.skill.slice(1)}`;
  if (['skillListening', 'skillReading', 'skillSpeaking', 'skillWriting'].includes(key)) data[key]++;
  data.processedAttemptIds.push(entry.id);
  data.history.unshift({ ...entry, attemptId: entry.id, timestamp: now.toISOString(), localDate: date });
}
function summarize(rows, selectKey) {
  const groups = Object.create(null);
  for (const row of rows) {
    const key = selectKey(row);
    if (key === null || key === undefined || key === '') continue;
    const group = groups[key] ||= { total: 0, answered: 0, correct: 0, unanswered: 0, wrong: 0, accuracy: 0 };
    group.total++;
    if (row.isAnswered) group.answered++; else group.unanswered++;
    if (row.isCorrect) group.correct++; else if (row.isAnswered) group.wrong++;
    group.accuracy = Math.round(group.correct / group.total * 100);
  }
  return groups;
}

export const Progress = {
  get() { return Storage.get(); },
  // Reading a dashboard must not count as studying.
  updateStreak() { return calculateStreak(Storage.get().dailyLessons); },

  completeLesson(skill = 'lesson', options = {}) {
    const id = options.id || options.attemptId || createAttemptId(skill);
    return Storage.update(data => {
      if (data.processedAttemptIds.includes(id)) return false;
      recordActivity(data, { ...options, id, skill: skill || 'lesson', kind: 'self-practice',
        total: 0, answered: 0, correct: 0, unanswered: 0, scorePct: null,
        durationSeconds: nonnegative(options.durationSeconds) }, new Date());
      return true;
    });
  },

  recordQuizResult(result) {
    if (!result || !Number.isInteger(result.total) || result.total <= 0) return false;
    const id = result.attemptId || result.id || createAttemptId('quiz');
    const breakdown = Array.isArray(result.breakdown) ? result.breakdown : [];
    const hasBreakdown = breakdown.length === result.total;
    const answered = hasBreakdown ? breakdown.filter(q => q.isAnswered).length
      : Math.min(result.total, nonnegative(result.answered ?? result.total));
    const correct = hasBreakdown ? breakdown.filter(q => q.isAnswered && q.isCorrect).length
      : Math.min(answered, nonnegative(result.correct));
    return Storage.update(data => {
      if (data.processedAttemptIds.includes(id)) return false;
      data.totalAnswered += answered;
      data.totalSubmitted += result.total;
      data.totalCorrect += correct;
      data.totalUnanswered += result.total - answered;
      if (result.skill === 'mocktest') data.mockTests++;
      const entry = { ...result, id, skill: result.skill || 'quiz', part: result.part ?? null,
        answered, correct, unanswered: result.total - answered, breakdown,
        scorePct: Math.round(correct / result.total * 100), durationSeconds: nonnegative(result.durationSeconds) };
      recordActivity(data, entry, new Date());
      return true;
    });
  },

  recordWordLearned(word) {
    if (typeof word !== 'string' || !word.trim()) return false;
    const normalized = word.trim();
    return Storage.update(data => {
      if (Object.hasOwn(data.learnedWords, normalized) && data.learnedWords[normalized]) return false;
      Object.defineProperty(data.learnedWords, normalized, { value: true, enumerable: true, writable: true, configurable: true });
      recordActivity(data, { id: createAttemptId('word'), skill: 'vocabulary', kind: 'word', word: normalized,
        total: 0, answered: 0, correct: 0, unanswered: 0, scorePct: null, durationSeconds: 0 }, new Date());
      return true;
    });
  },

  recordMockTest(result) { return this.recordQuizResult({ ...result, skill: 'mocktest', part: 'Full' }); },

  getStats() {
    const data = Storage.get();
    const todayLessons = nonnegative(data.dailyLessons[localDateKey()]);
    const rows = data.history.flatMap(entry => Array.isArray(entry.breakdown) ? entry.breakdown : []);
    return {
      totalLessons: data.totalLessons, totalAnswered: data.totalAnswered, totalCorrect: data.totalCorrect,
      totalSubmitted: data.totalSubmitted, unanswered: data.totalUnanswered,
      accuracy: data.totalAnswered ? Math.round(data.totalCorrect / data.totalAnswered * 100) : 0,
      streak: calculateStreak(data.dailyLessons), todayLessons, todayGoal: 5,
      todayProgressPct: Math.min(Math.round(todayLessons / 5 * 100), 100),
      vocabCount: Object.keys(data.learnedWords).filter(word => data.learnedWords[word]).length,
      mockTests: data.mockTests, history: data.history,
      studySeconds: data.history.reduce((total, entry) => total + nonnegative(entry.durationSeconds), 0),
      skills: { listening: data.skillListening, reading: data.skillReading,
        speaking: data.skillSpeaking, writing: data.skillWriting },
      bySkill: summarize(rows, q => q.skill), byPart: summarize(rows, q => q.part),
      byErrorType: summarize(rows, q => q.grammarPoint || q.questionType || q.trapType || 'unclassified')
    };
  }
};
