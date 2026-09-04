/**
 * Progress Module - Streak Calculation, Lifetime Stats & Activity Tracking
 */
import { Storage } from './storage.js';

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export const Progress = {
  get() {
    return Storage.get();
  },

  /**
   * Calculates and updates real daily consecutive streak
   */
  updateStreak() {
    const data = Storage.get();
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (!data.lastActiveDate) {
      data.streak = 1;
      data.lastActiveDate = today;
    } else if (data.lastActiveDate === today) {
      // Already active today, streak stays intact
      if (!data.streak || data.streak < 1) data.streak = 1;
    } else if (data.lastActiveDate === yesterday) {
      // Continued from yesterday!
      data.streak = (data.streak || 0) + 1;
      data.lastActiveDate = today;
    } else {
      // Missed more than 1 day: reset streak to 1
      data.streak = 1;
      data.lastActiveDate = today;
    }

    Storage.save(data);
    return data.streak;
  },

  /**
   * Completes a lesson activity
   */
  completeLesson(skill = null) {
    const data = Storage.get();
    const today = getTodayString();

    if (!data.dailyLessons) data.dailyLessons = {};
    data.dailyLessons[today] = (data.dailyLessons[today] || 0) + 1;
    data.totalLessons = (data.totalLessons || 0) + 1;

    if (skill) {
      const skillKey = 'skill' + skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
      if (typeof data[skillKey] === 'number') {
        data[skillKey] = (data[skillKey] || 0) + 1;
      }
    }

    this.updateStreak();
    Storage.save(data);
  },

  /**
   * Record Quiz / Practice result with exact answer counts
   */
  recordQuizResult({ id, skill, part, total, correct, durationSeconds = 0 }) {
    if (typeof total !== 'number' || total <= 0) return;
    const safeCorrect = Math.min(Math.max(parseInt(correct, 10) || 0, 0), total);

    const data = Storage.get();
    data.totalAnswered = (data.totalAnswered || 0) + total;
    data.totalCorrect = (data.totalCorrect || 0) + safeCorrect;

    if (skill) {
      const skillKey = 'skill' + skill.charAt(0).toUpperCase() + skill.slice(1).toLowerCase();
      if (typeof data[skillKey] === 'number') {
        data[skillKey] = (data[skillKey] || 0) + 1;
      }
    }

    const today = getTodayString();
    if (!data.dailyLessons) data.dailyLessons = {};
    data.dailyLessons[today] = (data.dailyLessons[today] || 0) + 1;
    data.totalLessons = (data.totalLessons || 0) + 1;

    // Append to history
    if (!Array.isArray(data.history)) data.history = [];
    const historyItem = {
      id: id || `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      skill: skill || 'quiz',
      part: part || 0,
      total: total,
      correct: safeCorrect,
      scorePct: Math.round((safeCorrect / total) * 100),
      durationSeconds: durationSeconds || 0
    };
    data.history.unshift(historyItem);

    // Limit history size to 100 entries
    if (data.history.length > 100) {
      data.history = data.history.slice(0, 100);
    }

    this.updateStreak();
    Storage.save(data);
  },

  /**
   * Record a vocabulary word as learned
   */
  recordWordLearned(word) {
    if (!word) return;
    const data = Storage.get();
    if (!data.learnedWords) data.learnedWords = {};
    data.learnedWords[word] = true;
    this.completeLesson('vocabulary');
    Storage.save(data);
  },

  /**
   * Record completed mock test
   */
  recordMockTest({ total, correct, durationSeconds = 0 }) {
    const data = Storage.get();
    data.mockTests = (data.mockTests || 0) + 1;
    Storage.save(data);
    this.recordQuizResult({
      id: `mock-${Date.now()}`,
      skill: 'mocktest',
      part: 'Full',
      total,
      correct,
      durationSeconds
    });
  },

  getStats() {
    const data = Storage.get();
    const today = getTodayString();
    const todayLessons = (data.dailyLessons && data.dailyLessons[today]) || 0;
    const accuracy = data.totalAnswered > 0
      ? Math.round((data.totalCorrect / data.totalAnswered) * 100)
      : 0;

    return {
      totalLessons: data.totalLessons || 0,
      totalAnswered: data.totalAnswered || 0,
      totalCorrect: data.totalCorrect || 0,
      accuracy: accuracy,
      streak: data.streak || 0,
      todayLessons: todayLessons,
      todayGoal: 5,
      todayProgressPct: Math.min(Math.round((todayLessons / 5) * 100), 100),
      vocabCount: Object.keys(data.learnedWords || {}).length,
      mockTests: data.mockTests || 0,
      skills: {
        listening: data.skillListening || 0,
        reading: data.skillReading || 0,
        speaking: data.skillSpeaking || 0,
        writing: data.skillWriting || 0
      },
      history: data.history || []
    };
  }
};
